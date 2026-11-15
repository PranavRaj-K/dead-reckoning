/**
 * Resource accounting. Pure functions only: no React, no timers, no globals.
 *
 * Every numeric constant here is an educational game assumption and is listed
 * in docs/ASSUMPTIONS.md. None of it is a flight model.
 */
import { BEACON_SPEC, componentById, launchById, orbitById } from './catalogue';
import type {
  BudgetIssue,
  Budgets,
  Design,
  DesignSlot,
  MissionScenario,
  RiskPosture,
  Validation,
} from './types';

/** Panel orientation + conversion + wiring loss, game assumption. */
export const PANEL_LOSS_FACTOR = 0.9;
/** OBC, receiver, thermistors, deployment keeps. */
export const HOUSEKEEPING_W = 1.2;
/** Survival heater while in eclipse. */
export const HEATER_ECLIPSE_W = 3.5;
/** Fraction of the mission the radio is expected to transmit (pass estimate). */
export const RADIO_DUTY_ESTIMATE = 0.11;
/** Battery usable fraction (depth-of-discharge limit). */
export const BATTERY_DOD_LIMIT = 0.8;
/** Reduced discharge capability after battery degradation, W. */
export const DEGRADED_DISCHARGE_LIMIT_W = 12;
/** Capacity multiplier after the battery degradation fault. */
export const DEGRADED_CAPACITY_FACTOR = 0.6;

export interface PostureRule {
  label: string;
  minEnergyMarginRatio: number;
  eclipseReserveRatio: number;
  description: string;
}

export const POSTURE_RULES: Record<RiskPosture, PostureRule> = {
  conservative: {
    label: 'Conservative',
    minEnergyMarginRatio: 0.15,
    eclipseReserveRatio: 0.3,
    description: 'Requires 15% spare generation and 30% battery reserve. Survives a bad environment.',
  },
  balanced: {
    label: 'Balanced',
    minEnergyMarginRatio: 0.05,
    eclipseReserveRatio: 0.2,
    description: 'Requires 5% spare generation and 20% battery reserve.',
  },
  aggressive: {
    label: 'Aggressive',
    minEnergyMarginRatio: 0,
    eclipseReserveRatio: 0.1,
    description: 'Accepts zero spare generation and 10% battery reserve. Fastest to fail in a storm.',
  },
};

export function slotSpecs(design: Design): Record<DesignSlot, ReturnType<typeof componentById>> {
  return {
    bus: componentById(design.ids.bus),
    power: componentById(design.ids.power),
    battery: componentById(design.ids.battery),
    radio: componentById(design.ids.radio),
    antenna: componentById(design.ids.antenna),
    adcs: componentById(design.ids.adcs),
    instrument: componentById(design.ids.instrument),
  };
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export interface BudgetInputs {
  design: Design;
  scenario: MissionScenario;
  sunlitFraction: number;
  eclipseMinutes: number;
}

/**
 * Derives every budget shown in the workbench. `sunlitFraction` must come from
 * propagated orbital geometry (see orbit.ts), not from a guess.
 */
export function computeBudgets({ design, scenario, sunlitFraction, eclipseMinutes }: BudgetInputs): Budgets {
  const specs = slotSpecs(design);
  const sceneCount = scenario.scenes.length;
  const sceneSeconds = scenario.scenes.reduce((sum, scene) => sum + (scene.endSec - scene.startSec), 0);

  // The launch sets the mass limit and spends from the same mission budget as the parts.
  const launch = launchById(design.mission.launch);
  const massKg = round(Object.values(specs).reduce((sum, spec) => sum + spec.massKg, 0) + (design.beacon ? BEACON_SPEC.massKg : 0), 2);
  const costUsd = Object.values(specs).reduce((sum, spec) => sum + spec.costUsd, 0) + (design.beacon ? BEACON_SPEC.costUsd : 0) + launch.costUsd;

  const generationW = specs.power.generationW ?? 0;
  const avgLoadW = round(
    HOUSEKEEPING_W +
      specs.adcs.powerW +
      (specs.instrument.powerW * sceneSeconds) / scenario.durationSec +
      (specs.radio.powerW * RADIO_DUTY_ESTIMATE) +
      HEATER_ECLIPSE_W * (1 - sunlitFraction),
    2,
  );

  const avgGenerationW = generationW * PANEL_LOSS_FACTOR * sunlitFraction;
  const energyMarginW = round(avgGenerationW - avgLoadW, 2);

  const batteryCapacityWh = specs.battery.capacityWh ?? 0;
  const batteryUsableWh = round(batteryCapacityWh * BATTERY_DOD_LIMIT, 1);
  const eclipseHours = eclipseMinutes / 60;
  const eclipseEnergyNeedWh = round((avgLoadW + HEATER_ECLIPSE_W) * eclipseHours, 2);

  const pointingAccuracyDeg = specs.adcs.pointingAccuracyDeg ?? 99;
  const requiredPointing = specs.antenna.requiresPointingDeg ?? 99;
  const pointingOk = pointingAccuracyDeg <= requiredPointing;
  const effectiveGain = round((specs.antenna.gainFactor ?? 1) * (pointingOk ? 1 : 0.55), 2);

  const sceneDataMb = specs.instrument.dataMbPerScene ?? 0;
  const sciencePotential = (specs.instrument.scienceValue ?? 0) * sceneCount;

  return {
    massKg,
    massLimitKg: launch.massCapacityKg,
    massMarginKg: round(launch.massCapacityKg - massKg, 2),
    costUsd,
    costLimitUsd: scenario.costLimitUsd,
    costMarginUsd: scenario.costLimitUsd - costUsd,
    generationW,
    avgLoadW,
    energyMarginW,
    energyMarginRatio: avgLoadW > 0 ? round(energyMarginW / avgLoadW, 3) : 0,
    sunlitFraction: round(sunlitFraction, 3),
    eclipseMinutes: round(eclipseMinutes, 1),
    batteryCapacityWh,
    batteryUsableWh,
    eclipseEnergyNeedWh,
    storageMb: specs.bus.storageMb ?? 0,
    downlinkKbps: round((specs.radio.downlinkKbps ?? 0) * effectiveGain, 1),
    pointingAccuracyDeg,
    effectiveGain,
    sceneDataMb,
    totalSceneDataMb: round(sceneDataMb * sceneCount, 1),
    sciencePotential,
  };
}

/** Estimated data that can be downlinked across the mission, for warning purposes only. */
export function estimatedThroughputMb(budgets: Budgets): number {
  const assumedPasses = 5;
  const assumedPassSec = 420;
  const linkQuality = 0.8;
  return round((budgets.downlinkKbps * linkQuality * assumedPasses * assumedPassSec) / 8000, 1);
}

export function validateDesign(design: Design, budgets: Budgets): Validation {
  const issues: BudgetIssue[] = [];
  const specs = slotSpecs(design);
  const rule = POSTURE_RULES[design.riskPosture];

  const launch = launchById(design.mission.launch);
  if (!launch.orbits.includes(design.mission.orbit)) {
    issues.push({
      id: 'launch-orbit',
      severity: 'error',
      message: `The ${launch.name.toLowerCase()} cannot reach the ${orbitById(design.mission.orbit).name} orbit. Pick another launch or orbit.`,
    });
  }

  if (budgets.massKg > budgets.massLimitKg) {
    issues.push({
      id: 'mass',
      severity: 'error',
      message: `Over the ${budgets.massLimitKg} kg launch limit by ${round(budgets.massKg - budgets.massLimitKg, 2)} kg. Remove mass, pick the lighter bus, or buy a bigger launch.`,
    });
  } else if (budgets.massMarginKg < 0.1) {
    issues.push({
      id: 'mass-thin',
      severity: 'warning',
      message: `Only ${budgets.massMarginKg} kg of mass margin left. No room for growth.`,
    });
  }

  if (budgets.costUsd > budgets.costLimitUsd) {
    issues.push({
      id: 'cost',
      severity: 'error',
      message: `Over the $${budgets.costLimitUsd.toLocaleString('en-US')} budget by $${(budgets.costUsd - budgets.costLimitUsd).toLocaleString('en-US')}.`,
    });
  }

  const requiredMarginW = budgets.avgLoadW * rule.minEnergyMarginRatio;
  if (budgets.energyMarginW < requiredMarginW) {
    issues.push({
      id: 'energy',
      severity: 'error',
      message: `${rule.label} posture needs ${round(requiredMarginW, 1)} W of spare generation, but this design averages ${budgets.energyMarginW} W. Imagery and downlink will drain the battery.`,
    });
  }

  const requiredEclipseWh = budgets.eclipseEnergyNeedWh * (1 + rule.eclipseReserveRatio);
  if (budgets.batteryUsableWh < requiredEclipseWh) {
    issues.push({
      id: 'battery',
      severity: 'error',
      message: `Battery covers ${budgets.batteryUsableWh} Wh usable but the eclipse needs ${round(requiredEclipseWh, 1)} Wh including the ${rule.label.toLowerCase()} reserve.`,
    });
  }

  const requiredPointing = specs.antenna.requiresPointingDeg ?? 99;
  if (budgets.pointingAccuracyDeg > requiredPointing) {
    issues.push({
      id: 'antenna-pointing',
      severity: 'warning',
      message: `${specs.antenna.name} needs ${requiredPointing}° pointing, but ${specs.adcs.name} provides ${budgets.pointingAccuracyDeg}°. Link gain is halved.`,
    });
  }

  const maxPointing = specs.instrument.maxPointingDeg ?? 99;
  if (budgets.pointingAccuracyDeg > maxPointing) {
    issues.push({
      id: 'instrument-pointing',
      severity: 'warning',
      message: `${specs.instrument.name} is only rated to ${maxPointing}° pointing. Scenes will be captured at 50% science quality.`,
    });
  }

  const throughput = estimatedThroughputMb(budgets);
  if (throughput < budgets.totalSceneDataMb * 0.5) {
    issues.push({
      id: 'downlink',
      severity: 'warning',
      message: `Estimated downlink capacity is ${throughput} MB against ${budgets.totalSceneDataMb} MB of imagery. Expect a data backlog and lost scenes.`,
    });
  }

  if (budgets.storageMb < budgets.sceneDataMb * 3) {
    issues.push({
      id: 'storage',
      severity: 'warning',
      message: `Recorder holds ${budgets.storageMb} MB, about ${Math.floor(budgets.storageMb / Math.max(1, budgets.sceneDataMb))} scenes. Data may overwrite before a pass arrives.`,
    });
  }

  if (!design.beacon) {
    issues.push({
      id: 'beacon',
      severity: 'warning',
      message: 'No backup beacon. If the main radio fails, there is almost no way to get data down.',
    });
  }

  return { ok: !issues.some((issue) => issue.severity === 'error'), issues };
}

export interface PowerStepInput {
  generationW: number;
  sunlit: boolean;
  weatherPenaltyW: number;
  housekeepingW: number;
  adcsW: number;
  radioTxW: number;
  instrumentW: number;
  beaconW: number;
  heaterW: number;
  batteryWh: number;
  capacityWh: number;
  dtSec: number;
  /** null when the battery is healthy. */
  dischargeLimitW: number | null;
}

export interface PowerStepResult {
  batteryWh: number;
  generationW: number;
  loadW: number;
  brownout: boolean;
  shedInstrument: boolean;
  shedRadio: boolean;
}

/**
 * One power step. Load shedding is explicit: a degraded battery cannot supply
 * the instrument (and then the radio) above its discharge limit.
 */
export function powerStep(input: PowerStepInput): PowerStepResult {
  const generationW = input.sunlit ? Math.max(0, input.generationW * PANEL_LOSS_FACTOR - input.weatherPenaltyW) : 0;
  let instrumentW = input.instrumentW;
  let radioTxW = input.radioTxW;
  let loadW =
    input.housekeepingW + input.adcsW + radioTxW + instrumentW + input.beaconW + (input.sunlit ? 0 : input.heaterW);

  let shedInstrument = false;
  let shedRadio = false;

  if (input.dischargeLimitW !== null && loadW > input.dischargeLimitW) {
    if (instrumentW > 0) {
      loadW -= instrumentW;
      instrumentW = 0;
      shedInstrument = true;
    }
    if (loadW > input.dischargeLimitW && radioTxW > 0) {
      loadW -= radioTxW;
      radioTxW = 0;
      shedRadio = true;
    }
  }

  const nextWh = clamp(input.batteryWh + ((generationW - loadW) * input.dtSec) / 3600, 0, input.capacityWh);

  return {
    batteryWh: round(nextWh, 3),
    generationW: round(generationW, 2),
    loadW: round(loadW, 2),
    brownout: nextWh <= 0.02,
    shedInstrument,
    shedRadio,
  };
}

export function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/** kbps -> MB per second. */
export function kbpsToMbPerSec(kbps: number): number {
  return kbps / 8000;
}
