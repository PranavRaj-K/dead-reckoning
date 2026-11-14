/**
 * Mission simulation. Deterministic, pure and UI-free.
 *
 * Time is advanced in fixed 10 s steps. Everything the debrief reports is
 * derived from this state; nothing is reconstructed after the fact.
 */
import type { SatRec } from 'satellite.js';
import {
  BEACON_SPEC,
  componentById,
} from './catalogue';
import {
  BATTERY_DOD_LIMIT,
  DEGRADED_CAPACITY_FACTOR,
  DEGRADED_DISCHARGE_LIMIT_W,
  HEATER_ECLIPSE_W,
  HOUSEKEEPING_W,
  clamp,
  computeBudgets,
  kbpsToMbPerSec,
  powerStep,
  validateDesign,
} from './resources';
import {
  createSatrec,
  dateAt,
  estimateSunlight,
  findContactWindows,
  orbitalPeriodMinutes,
  orbitStateAt,
} from './orbit';
import { deriveWeatherModifiers } from './events';
import { getRecoveryActions, upcomingScenes } from './salvage';
import { seededUnit } from './rng';
import type {
  CausalEvent,
  ContactWindow,
  Design,
  FaultId,
  FaultInstance,
  GpElements,
  MissionScenario,
  MissionState,
  SceneRecord,
  SpaceWeather,
  TelemetrySample,
} from './types';

export const TICK_SEC = 10;
const TELEMETRY_INTERVAL_SEC = 30;
const BROWNOUT_FAILURE_SEC = 600;
const MAX_TELEMETRY_SAMPLES = 900;

const satrecCache = new Map<string, SatRec>();

function satrecFor(elements: GpElements): SatRec {
  const key = `${elements.noradId}:${elements.epochUtc}`;
  const cached = satrecCache.get(key);
  if (cached) return cached;
  const satrec = createSatrec(elements);
  if (satrecCache.size > 8) satrecCache.clear();
  satrecCache.set(key, satrec);
  return satrec;
}

export interface MissionInput {
  design: Design;
  seed: number;
  reference: GpElements;
  weather: SpaceWeather;
  scenario: MissionScenario;
  provenance: string[];
}

export function createMission(input: MissionInput): MissionState {
  const { design, seed, reference, weather, scenario, provenance } = input;
  const satrec = satrecFor(reference);
  const periodMinutes = orbitalPeriodMinutes(reference);
  const start = dateAt(reference.epochUtc, 0);
  const sunlight = estimateSunlight(satrec, start, periodMinutes);
  const budgets = computeBudgets({
    design,
    scenario,
    sunlitFraction: sunlight.sunlitFraction,
    eclipseMinutes: sunlight.eclipseMinutes,
  });

  const validation = validateDesign(design, budgets);
  if (!validation.ok) {
    const first = validation.issues.find((issue) => issue.severity === 'error');
    throw new Error(`Design is not launchable: ${first?.message ?? 'unknown validation error'}`);
  }

  const contacts = findContactWindows(satrec, start, scenario.durationSec, scenario.stations);
  const weatherModifiers = deriveWeatherModifiers(weather);
  const instrument = componentById(design.ids.instrument);
  const orbit = orbitStateAt(satrec, start);

  const scenes: SceneRecord[] = scenario.scenes.map((window) => ({
    id: window.id,
    index: window.index,
    label: window.label,
    status: 'pending',
    quality: 0,
    dataMb: instrument.dataMbPerScene ?? 0,
    scienceTotal: 0,
    scienceDelivered: 0,
    mbRemaining: 0,
    note: null,
  }));

  const faults: FaultInstance[] = scenario.faults.map((fault) => ({
    id: fault.id,
    atSec: fault.atSec,
    appliedAtSec: null,
    status: 'pending',
    resolvedBy: null,
    note: null,
  }));

  const causal: CausalEvent[] = [];
  const push = (
    kind: CausalEvent['kind'],
    severity: CausalEvent['severity'],
    title: string,
    detail: string,
  ) => {
    causal.push({ id: `c-${causal.length}`, t: 0, kind, severity, title, detail });
  };

  push(
    'design',
    'info',
    `Selected ${instrument.name}`,
    `${instrument.dataMbPerScene} MB per scene, ${instrument.scienceValue} science points per scene, rated to ${instrument.maxPointingDeg}° pointing.`,
  );
  push(
    'design',
    budgets.massMarginKg >= 0.2 ? 'info' : 'warning',
    `Mass ${budgets.massKg} kg of ${budgets.massLimitKg} kg`,
    `${budgets.massMarginKg} kg of margin left after the structure, power, comms, attitude and payload choices.`,
  );
  push(
    'design',
    budgets.energyMarginW > 0 ? 'info' : 'warning',
    `Average energy margin ${budgets.energyMarginW} W`,
    `Generation ${budgets.generationW} W peak x ${Math.round(budgets.sunlitFraction * 100)}% sunlight x panel loss, minus ${budgets.avgLoadW} W average load.`,
  );
  push(
    'design',
    'info',
    `Battery covers the eclipse with ${budgets.batteryUsableWh} Wh usable`,
    `Eclipse loads need ${budgets.eclipseEnergyNeedWh} Wh over ${budgets.eclipseMinutes} minutes of darkness per orbit.`,
  );
  push(
    'design',
    budgets.pointingAccuracyDeg <= (instrument.maxPointingDeg ?? 99) ? 'info' : 'warning',
    `Pointing ${budgets.pointingAccuracyDeg}°`,
    `${componentById(design.ids.adcs).name} against an instrument limit of ${instrument.maxPointingDeg}°.`,
  );
  push(
    'design',
    'info',
    `Downlink ${budgets.downlinkKbps} kbps effective`,
    `${componentById(design.ids.radio).name} x antenna gain ${budgets.effectiveGain} (the gain is halved when pointing misses the antenna requirement).`,
  );
  push(
    'environment',
    'info',
    `Space-weather outlook loaded`,
    weatherModifiers.notes[0],
  );
  push(
    'environment',
    'info',
    `Orbital environment from ${reference.objectName}`,
    `SGP4 propagation of CelesTrak GP elements (epoch ${reference.epochUtc}), NORAD ${reference.noradId}. The spacecraft is fictional; its environment is propagated from this real reference orbit.`,
  );
  if (contacts.length === 0) {
    push(
      'warning',
      'warning',
      'No ground-station passes in this window',
      'No modelled pass exceeds 5° elevation, so nothing can be downlinked. Check the reference element set.',
    );
  }

  const initial: MissionState = {
    seed,
    design,
    budgets,
    weather: weatherModifiers,
    weatherSource: weather,
    reference,
    epochUtc: reference.epochUtc,
    durationSec: scenario.durationSec,
    scienceTarget: scenario.scienceTarget,
    dataTargetMb: scenario.dataTargetMb,
    t: 0,
    status: 'running',
    failureReason: null,
    batteryWh: budgets.batteryCapacityWh,
    batteryCapacityWh: budgets.batteryCapacityWh,
    batteryDegraded: false,
    dataStoredMb: 0,
    dataDeliveredMb: 0,
    dataGeneratedMb: 0,
    scienceCollected: 0,
    scienceDelivered: 0,
    powerGenW: 0,
    powerLoadW: 0,
    inSunlight: orbit?.inSunlight ?? true,
    brownout: false,
    brownoutSec: 0,
    pointingErrorDeg: round(budgets.pointingAccuracyDeg + weatherModifiers.pointingPenaltyDeg, 2),
    adcsMode: 'nominal',
    radioOperational: true,
    beaconActive: false,
    linkGainFactor: budgets.effectiveGain,
    provenance,
    orbit: orbit ?? {
      latDeg: 0,
      lonDeg: 0,
      altitudeKm: 0,
      speedKmPerSec: 0,
      shadowFraction: 0,
      inSunlight: true,
      eciAngleRad: 0,
      sunAngleRad: 0,
      radiusEarthRadii: 1,
    },
    scenes,
    contacts,
    sceneWindows: scenario.scenes,
    faults,
    activeFault: null,
    salvage: [],
    causal,
    telemetry: [],
    lastSampleSec: -TELEMETRY_INTERVAL_SEC,
    lastContactId: null,
    lastContactStation: null,
  };

  return sampleTelemetry(initial);
}

/** Toggle the player's decision to skip a pending observation window. */
export function setSceneSkipped(state: MissionState, sceneId: string, skipped: boolean): MissionState {
  if (state.status !== 'running' && state.status !== 'paused') return state;
  const index = state.scenes.findIndex((scene) => scene.id === sceneId);
  if (index < 0) return state;
  const scene = state.scenes[index];
  const window = state.sceneWindows[index];
  const open =
    scene.status === 'pending' || (scene.status === 'skipped' && state.t < window.endSec);
  if (!open) return state;

  const scenes = state.scenes.map((entry, i) =>
    i === index
      ? {
          ...entry,
          status: (skipped ? 'skipped' : 'pending') as SceneRecord['status'],
          note: skipped ? 'Skipped by the operator' : null,
        }
      : entry,
  );
  return { ...state, scenes };
}

export function advanceMission(state: MissionState, dtSec: number): MissionState {
  if (state.status !== 'running' || dtSec <= 0) return state;
  let next = state;
  let remaining = dtSec;
  let guard = 0;
  while (remaining > 0 && next.status === 'running' && guard < 500) {
    const step = Math.min(TICK_SEC, remaining);
    next = stepOnce(next, step);
    remaining -= step;
    guard += 1;
  }
  return next;
}

function stepOnce(state: MissionState, dtSec: number): MissionState {
  const satrec = satrecFor(state.reference);
  const t = Math.min(state.t + dtSec, state.durationSec);
  const date = dateAt(state.epochUtc, t);
  const orbit = orbitStateAt(satrec, date) ?? state.orbit;
  const contact = state.contacts.find((window) => t >= window.startSec && t < window.endSec) ?? null;

  const activeSceneIndex = state.sceneWindows.findIndex(
    (window, i) => state.scenes[i].status === 'pending' && t >= window.startSec && t < window.endSec,
  );
  const instrumentSpec = componentById(state.design.ids.instrument);
  const adcsSpec = componentById(state.design.ids.adcs);
  const radioSpec = componentById(state.design.ids.radio);

  const connecting = Boolean(contact) && !state.brownout && state.dataStoredMb > 0.0001;
  const usingBeacon = connecting && state.beaconActive;
  const usingRadio = connecting && !state.beaconActive && state.radioOperational;

  const pointing = pointingError(state);
  const power = powerStep({
    generationW: state.budgets.generationW,
    sunlit: orbit.inSunlight,
    weatherPenaltyW: state.weather.powerPenaltyW,
    housekeepingW: HOUSEKEEPING_W,
    adcsW: adcsSpec.powerW,
    radioTxW: usingRadio ? radioSpec.powerW : 0,
    instrumentW: activeSceneIndex >= 0 ? instrumentSpec.powerW : 0,
    beaconW: usingBeacon ? BEACON_SPEC.powerW : 0,
    heaterW: HEATER_ECLIPSE_W,
    batteryWh: state.batteryWh,
    capacityWh: state.batteryCapacityWh,
    dtSec,
    dischargeLimitW: state.batteryDegraded ? DEGRADED_DISCHARGE_LIMIT_W : null,
  });

  let next: MissionState = {
    ...state,
    t,
    orbit,
    inSunlight: orbit.inSunlight,
    powerGenW: power.generationW,
    powerLoadW: power.loadW,
    batteryWh: power.batteryWh,
    brownout: power.brownout || state.brownout,
    pointingErrorDeg: pointing,
    linkGainFactor: state.budgets.effectiveGain,
    lastContactId: contact?.id ?? null,
    lastContactStation: contact?.stationName ?? null,
  };

  if (activeSceneIndex >= 0 && (power.shedInstrument || power.brownout)) {
    next = logCausal(next, 'warning', 'warning', 'Instrument shed to protect power', {
      scene: state.scenes[activeSceneIndex].label,
      reason: power.brownout ? 'battery empty' : 'degraded battery discharge limit',
    });
  }

  // Downlink -----------------------------------------------------------------
  const rateKbps =
    contact && !power.shedRadio && !power.brownout
      ? usingBeacon
        ? BEACON_SPEC.downlinkKbps * contact.linkQuality
        : usingRadio
          ? state.budgets.downlinkKbps * contact.linkQuality
          : 0
      : 0;

  if (rateKbps > 0) {
    next = drainData(next, kbpsToMbPerSec(rateKbps) * dtSec);
  }

  // Scene capture ------------------------------------------------------------
  for (let i = 0; i < state.sceneWindows.length; i += 1) {
    const window = state.sceneWindows[i];
    if (next.scenes[i].status !== 'pending') continue;
    if (t < window.endSec) continue;
    next = captureScene(next, i);
  }

  // Faults -------------------------------------------------------------------
  const faultIndex = next.faults.findIndex((fault) => fault.status === 'pending' && fault.atSec <= t);
  if (faultIndex >= 0) {
    next = applyFault(next, faultIndex);
  }

  // Brownout accounting ------------------------------------------------------
  if (next.brownout) {
    next = { ...next, brownoutSec: state.brownoutSec + dtSec };
    if (next.brownoutSec >= BROWNOUT_FAILURE_SEC && next.status === 'running') {
      next = {
        ...next,
        status: 'failed',
        failureReason: `Battery depleted for ${Math.round(next.brownoutSec / 60)} minutes. The spacecraft lost power and stopped responding.`,
      };
      next = logCausal(next, 'outcome', 'critical', 'Mission lost to power depletion', {
        batteryWh: round(next.batteryWh, 2),
      });
    }
  } else if (state.brownoutSec > 0) {
    next = { ...next, brownoutSec: 0 };
  }

  // Mission end --------------------------------------------------------------
  if (accruedTelemetry(next)) {
    next = sampleTelemetry(next);
  }
  if (t >= state.durationSec && next.status === 'running') {
    next = { ...next, status: 'complete' };
    next = logCausal(next, 'outcome', 'success', 'Mission window closed', {
      scienceDelivered: round(next.scienceDelivered, 1),
      dataDeliveredMb: round(next.dataDeliveredMb, 1),
    });
  }

  return next;
}

function accruedTelemetry(state: MissionState): boolean {
  return state.t - state.lastSampleSec >= TELEMETRY_INTERVAL_SEC;
}

function pointingError(state: MissionState): number {
  const base = state.budgets.pointingAccuracyDeg;
  const modePenalty =
    state.adcsMode === 'magnetic' ? Math.max(0, 2.5 - base) : state.adcsMode === 'degraded' ? 1.2 : 0;
  return round(base + modePenalty + state.weather.pointingPenaltyDeg, 2);
}

function captureScene(state: MissionState, index: number): MissionState {
  const instrument = componentById(state.design.ids.instrument);
  const dataMb = instrument.dataMbPerScene ?? 0;
  const cloud = 0.65 + 0.35 * seededUnit(state.seed, 'cloud', index);
  const pointingFactor = state.pointingErrorDeg > (instrument.maxPointingDeg ?? 99) ? 0.5 : 1;
  const radiationFactor = 1 - 0.25 * state.weather.radiationNoise;
  const quality = state.brownout ? 0.05 : clamp(cloud * pointingFactor * radiationFactor, 0.05, 1);
  const scienceTotal = round((instrument.scienceValue ?? 0) * quality, 2);

  let scenes = state.scenes.map((scene, i) =>
    i === index
      ? {
          ...scene,
          status: 'stored' as const,
          quality: round(quality, 3),
          scienceTotal,
          mbRemaining: dataMb,
          note:
            pointingFactor < 1
              ? 'Captured outside the instrument pointing spec (50% science)'
              : state.brownout
                ? 'Captured during a brownout'
                : null,
        }
      : scene,
  );

  // FIFO overwrite: the recorder keeps the newest imagery.
  let storedMb = scenes.reduce((sum, scene) => sum + scene.mbRemaining, 0);
  let guard = 0;
  while (storedMb > state.budgets.storageMb && guard < 100) {
    const oldest = scenes.findIndex((scene) => scene.status === 'stored' && scene.mbRemaining > 0);
    if (oldest < 0) break;
    storedMb -= scenes[oldest].mbRemaining;
    scenes = scenes.map((scene, i) =>
      i === oldest
        ? { ...scene, mbRemaining: 0, status: 'lost' as const, note: 'Overwritten before it could be downlinked' }
        : scene,
    );
    guard += 1;
  }

  let next: MissionState = {
    ...state,
    scenes,
    dataStoredMb: round(scenes.reduce((sum, scene) => sum + scene.mbRemaining, 0), 3),
    dataGeneratedMb: round(state.dataGeneratedMb + dataMb, 3),
    scienceCollected: round(state.scienceCollected + scienceTotal, 3),
  };

  next = logCausal(next, 'outcome', quality >= 0.8 ? 'success' : 'warning', `${next.scenes[index].label} captured`, {
    quality: round(quality, 2),
    science: scienceTotal,
    dataMb,
    cloud: round(cloud, 2),
  });

  return next;
}

function drainData(state: MissionState, amountMb: number): MissionState {
  if (amountMb <= 0) return state;
  let remaining = amountMb;
  let deliveredMb = 0;
  let deliveredScience = 0;

  const scenes = state.scenes.map((scene) => {
    if (remaining <= 0 || scene.status !== 'stored' || scene.mbRemaining <= 0) return scene;
    const take = Math.min(scene.mbRemaining, remaining);
    const science = scene.dataMb > 0 ? scene.scienceTotal * (take / scene.dataMb) : 0;
    remaining -= take;
    deliveredMb += take;
    deliveredScience += science;
    return {
      ...scene,
      mbRemaining: round(scene.mbRemaining - take, 4),
      scienceDelivered: round(scene.scienceDelivered + science, 4),
    };
  });

  return {
    ...state,
    scenes,
    dataStoredMb: round(scenes.reduce((sum, scene) => sum + scene.mbRemaining, 0), 3),
    dataDeliveredMb: round(state.dataDeliveredMb + deliveredMb, 3),
    scienceDelivered: round(state.scienceDelivered + deliveredScience, 3),
  };
}

function applyFault(state: MissionState, faultIndex: number): MissionState {
  const fault = state.faults[faultIndex];
  const faults = state.faults.map((entry, i) =>
    i === faultIndex ? { ...entry, status: 'active' as const, appliedAtSec: state.t } : entry,
  );

  let next: MissionState = { ...state, faults, status: 'awaiting-salvage', activeFault: fault.id };

  if (fault.id === 'radio-failure') {
    next = { ...next, radioOperational: false };
  } else if (fault.id === 'adcs-degradation') {
    next = { ...next, adcsMode: 'degraded' };
  } else if (fault.id === 'battery-degradation') {
    const capacity = round(state.budgets.batteryCapacityWh * DEGRADED_CAPACITY_FACTOR, 2);
    next = {
      ...next,
      batteryDegraded: true,
      batteryCapacityWh: capacity,
      batteryWh: Math.min(state.batteryWh, capacity),
    };
  }

  next = logCausal(next, 'fault', 'critical', faultTitle(fault.id), {
    at: formatMissionTime(state.t),
    tiny: 'See the salvage panel for the available recovery paths.',
  });

  // The fault changes the attitude mode, so refresh the error immediately rather
  // than showing a pre-fault value until the next tick.
  next = { ...next, pointingErrorDeg: pointingError(next) };

  return sampleTelemetry(next);
}

/** Resolve the active salvage decision. Returns the same state if unavailable. */
export function resolveSalvage(state: MissionState, actionId: string): MissionState {
  if (state.status !== 'awaiting-salvage' || !state.activeFault) return state;
  const faultId = state.activeFault;
  const actions = getRecoveryActions(state, faultId);
  const action = actions.find((entry) => entry.id === actionId);
  if (!action || action.unavailableReason) return state;

  const faultIndex = state.faults.findIndex((fault) => fault.id === faultId);
  let faults = state.faults.map((fault, i) =>
    i === faultIndex
      ? { ...fault, resolvedBy: actionId, status: 'mitigated' as const, note: action.label }
      : fault,
  );

  let next: MissionState = { ...state, faults, activeFault: null, status: 'running' as const };
  let outcome: 'applied' | 'risk-succeeded' | 'risk-failed' | 'ended-mission' = 'applied';
  let note = action.label;

  if (faultId === 'radio-failure' && actionId === 'switch-beacon') {
    next = { ...next, beaconActive: true };
    note = 'Backup beacon active at 0.4 kbps.';
  } else if (faultId === 'radio-failure' && actionId === 'radio-reset') {
    const roll = seededUnit(state.seed, 'radio-reset', faultId);
    if (roll < (action.risk?.successChance ?? 0)) {
      outcome = 'risk-succeeded';
      next = { ...next, radioOperational: true, beaconActive: false };
      note = action.risk?.successText ?? 'Radio recovered.';
    } else {
      outcome = 'risk-failed';
      faults = faults.map((fault, i) => (i === faultIndex ? { ...fault, status: 'lost' as const } : fault));
      next = { ...next, faults, radioOperational: false };
      note = action.risk?.failureText ?? 'Radio did not respond.';
    }
  } else if (faultId === 'adcs-degradation' && actionId === 'magnetic-mode') {
    next = { ...next, adcsMode: 'magnetic' };
    note = 'Magnetorquer mode. Pointing is now about 2.5°.';
  } else if (faultId === 'adcs-degradation' && actionId === 'trim-schedule') {
    next = skipNextScenes(next, 3, 'Skipped to let the attitude control system settle');
    next = { ...next, adcsMode: 'nominal' };
    note = 'Three scenes skipped; attitude control settled back inside spec.';
  } else if (faultId === 'battery-degradation' && actionId === 'sun-safe') {
    next = skipNextScenes(next, 2, 'Skipped for a sun-safe recharge');
    note = 'Two scenes skipped to recharge the degraded battery.';
  } else if (actionId === 'cease-ops') {
    outcome = 'ended-mission';
    next = {
      ...next,
      status: 'complete',
      failureReason: 'Mission ended by the operator after the radio failure.',
    };
    note = 'Mission ended by the operator.';
  }

  if (next.status === 'running' && next.t >= next.durationSec) {
    next = { ...next, status: 'complete' };
  }

  next = {
    ...next,
    salvage: [
      ...state.salvage,
      { faultId, actionId, actionLabel: action.label, atSec: state.t, outcome, note },
    ],
  };

  next = logCausal(next, 'action', outcome === 'risk-failed' ? 'warning' : 'info', `Salvage: ${action.label}`, {
    at: formatMissionTime(state.t),
    outcome,
    note,
  });

  // Recovery actions can change the attitude mode; keep the reported error in sync.
  next = { ...next, pointingErrorDeg: pointingError(next) };

  return sampleTelemetry(next);
}

function skipNextScenes(state: MissionState, count: number, reason: string): MissionState {
  const targets = new Set(upcomingScenes(state, count).map((scene) => scene.id));
  return {
    ...state,
    scenes: state.scenes.map((scene) =>
      targets.has(scene.id) ? { ...scene, status: 'skipped' as const, note: reason } : scene,
    ),
  };
}

function sampleTelemetry(state: MissionState): MissionState {
  const sample: TelemetrySample = {
    t: state.t,
    batteryWh: round(state.batteryWh, 2),
    batteryCapacityWh: round(state.batteryCapacityWh, 2),
    powerGenW: round(state.powerGenW, 2),
    powerLoadW: round(state.powerLoadW, 2),
    dataStoredMb: round(state.dataStoredMb, 2),
    dataDeliveredMb: round(state.dataDeliveredMb, 2),
    inSunlight: state.inSunlight,
    pointingErrorDeg: round(state.pointingErrorDeg, 2),
    downlinkKbps: state.lastContactId ? round(downlinkState(state), 1) : 0,
  };
  const telemetry = [...state.telemetry, sample].slice(-MAX_TELEMETRY_SAMPLES);
  return { ...state, telemetry, lastSampleSec: state.t };
}

function downlinkState(state: MissionState): number {
  if (state.beaconActive) return BEACON_SPEC.downlinkKbps;
  if (!state.radioOperational) return 0;
  return state.budgets.downlinkKbps;
}

function logCausal(
  state: MissionState,
  kind: CausalEvent['kind'],
  severity: CausalEvent['severity'],
  title: string,
  data: Record<string, unknown>,
): MissionState {
  const detail = Object.entries(data)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' · ');
  const event: CausalEvent = {
    id: `c-${state.causal.length}-${Math.round(state.t)}`,
    t: state.t,
    kind,
    severity,
    title,
    detail,
  };
  return { ...state, causal: [...state.causal, event] };
}

function faultTitle(id: FaultId): string {
  switch (id) {
    case 'radio-failure':
      return 'Fault: main radio failed';
    case 'adcs-degradation':
      return 'Fault: attitude control degraded';
    case 'battery-degradation':
      return 'Fault: battery capacity lost';
  }
}

export function formatMissionTime(tSec: number): string {
  const total = Math.max(0, Math.round(tSec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function missionClockUtc(state: MissionState): string {
  return new Date(Date.parse(state.epochUtc) + state.t * 1000).toISOString();
}

export function currentContact(state: MissionState): ContactWindow | null {
  return state.contacts.find((window) => state.t >= window.startSec && state.t < window.endSec) ?? null;
}

export function nextScene(state: MissionState): SceneRecord | null {
  const index = state.scenes.findIndex((scene) => scene.status === 'pending');
  return index >= 0 ? state.scenes[index] : null;
}

export function batteryUsableWh(state: MissionState): number {
  return round(state.batteryCapacityWh * BATTERY_DOD_LIMIT, 2);
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
