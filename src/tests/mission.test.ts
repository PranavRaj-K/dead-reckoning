import { describe, expect, it } from 'vitest';
import { advanceMission, createMission, resolveSalvage, setSceneSkipped } from '../sim/mission';
import { evaluateMission } from '../sim/scoring';
import { getRecoveryActions } from '../sim/salvage';
import { DEFAULT_DESIGN, SCENARIO, design } from '../sim/catalogue';
import type { Design, MissionState } from '../sim/types';
import { calmWeather, launch, playThrough, reference } from './helpers';

function firstAvailable(state: MissionState): string {
  const actions = getRecoveryActions(state, state.activeFault!);
  const action = actions.find((entry) => !entry.unavailableReason);
  if (!action) throw new Error('no available action');
  return action.id;
}

/** Advances until `done` is true, resolving salvage prompts with the first available action. */
function runUntil(state: MissionState, done: (state: MissionState) => boolean, maxSteps = 4000): MissionState {
  let next = state;
  for (let i = 0; i < maxSteps; i += 1) {
    if (done(next)) return next;
    next =
      next.status === 'awaiting-salvage'
        ? resolveSalvage(next, firstAvailable(next))
        : advanceMission(next, 60);
  }
  throw new Error('condition not reached');
}

describe('launch gating', () => {
  it('refuses a design that fails validation', () => {
    const overweight: Design = design(
      {
        bus: 'bus-3u-hd',
        power: 'power-3u-hi',
        battery: 'batt-40',
        radio: 'radio-xband',
        antenna: 'ant-hga',
        adcs: 'adcs-rw-star',
        instrument: 'cam-hr',
      },
      true,
      'balanced',
    );
    expect(() => launch(overweight)).toThrow(/not launchable/i);
  });

  it('starts at t=0 with a charged battery and a real orbit state', () => {
    const state = launch();
    expect(state.t).toBe(0);
    expect(state.status).toBe('running');
    expect(state.batteryWh).toBe(state.batteryCapacityWh);
    expect(state.orbit.altitudeKm).toBeGreaterThan(750);
    expect(state.contacts.length).toBeGreaterThan(0);
    expect(state.scenes.every((scene) => scene.status === 'pending')).toBe(true);
    expect(state.telemetry.length).toBe(1);
  });

  it('adds the storm pointing penalty to the design pointing error', () => {
    const storm = createMission({
      design: DEFAULT_DESIGN,
      seed: 1,
      reference,
      weather: { ...calmWeather, storms: [{ id: 's', startUtc: calmWeather.windowStartUtc, maxKp: 8 }] },
      scenario: SCENARIO,
      provenance: ['test'],
    });
    expect(storm.pointingErrorDeg).toBeCloseTo(launch().pointingErrorDeg + 0.5, 2);
  });
});

describe('deterministic simulation', () => {
  it('reproduces the same run from the same seed', () => {
    const a = playThrough(DEFAULT_DESIGN, 777);
    const b = playThrough(DEFAULT_DESIGN, 777);
    expect(a.status).toBe('complete');
    expect(a.t).toBe(SCENARIO.durationSec);
    expect(a.scienceDelivered).toBe(b.scienceDelivered);
    expect(a.dataDeliveredMb).toBe(b.dataDeliveredMb);
    expect(a.batteryWh).toBe(b.batteryWh);
    expect(a.causal.map((event) => event.title)).toEqual(b.causal.map((event) => event.title));
    expect(a.salvage.map((entry) => entry.outcome)).toEqual(b.salvage.map((entry) => entry.outcome));
  });

  it('changes cloud-limited science with a different seed', () => {
    const a = playThrough(DEFAULT_DESIGN, 1);
    const b = playThrough(DEFAULT_DESIGN, 2);
    expect(a.scienceCollected).not.toBe(b.scienceCollected);
  });

  it('is invariant to how time is chunked', () => {
    let a = launch();
    a = advanceMission(a, 300);
    a = advanceMission(a, 300);
    a = advanceMission(a, 300);

    let b = launch();
    for (let i = 0; i < 30; i += 1) b = advanceMission(b, 30);

    expect(a).toEqual(b);
  });

  it('does not advance while waiting for a salvage decision', () => {
    const state = runUntil(launch(), (next) => next.status === 'awaiting-salvage');
    expect(advanceMission(state, 600)).toBe(state);
  });
});

describe('fault timeline', () => {
  it('applies the radio failure at 6480 s and blocks downlink', () => {
    const state = runUntil(launch(), (next) => next.status === 'awaiting-salvage');
    expect(state.activeFault).toBe('radio-failure');
    expect(state.t).toBe(6_480);
    expect(state.radioOperational).toBe(false);
    expect(state.faults[0].status).toBe('active');

    const after = advanceMission(resolveSalvage(state, 'switch-beacon'), 600);
    expect(after.status).toBe('running');
    expect(after.beaconActive).toBe(true);
    expect(after.faults[0].status).toBe('mitigated');
    expect(after.salvage).toHaveLength(1);
    expect(after.salvage[0].outcome).toBe('applied');
  });

  it('ignores salvage while no decision is pending', () => {
    const running = launch();
    expect(resolveSalvage(running, 'switch-beacon')).toBe(running);
  });

  it('degrades attitude control at 11880 s and restores pointing in magnetic mode', () => {
    let state = runUntil(launch(), (next) => next.status === 'awaiting-salvage');
    state = resolveSalvage(state, 'switch-beacon');
    state = runUntil(state, (next) => next.status === 'awaiting-salvage' && next.activeFault === 'adcs-degradation');

    expect(state.t).toBe(11_880);
    expect(state.adcsMode).toBe('degraded');
    expect(state.pointingErrorDeg).toBeGreaterThan(launch().pointingErrorDeg);

    const recovered = resolveSalvage(state, 'magnetic-mode');
    expect(recovered.adcsMode).toBe('magnetic');
    expect(recovered.pointingErrorDeg).toBeCloseTo(2.5, 2);
  });

  it('loses 40% of battery capacity at 16848 s', () => {
    let state = runUntil(launch(), (next) => next.status === 'awaiting-salvage');
    state = resolveSalvage(state, 'switch-beacon');
    state = runUntil(state, (next) => next.status === 'awaiting-salvage' && next.activeFault === 'adcs-degradation');
    state = resolveSalvage(state, 'magnetic-mode');
    state = runUntil(state, (next) => next.status === 'awaiting-salvage' && next.activeFault === 'battery-degradation');

    expect(state.t).toBe(16_850);
    expect(state.faults[2].appliedAtSec).toBe(state.t);
    expect(state.batteryDegraded).toBe(true);
    expect(state.batteryCapacityWh).toBeCloseTo(state.budgets.batteryCapacityWh * 0.6, 1);
    expect(state.batteryWh).toBeLessThanOrEqual(state.batteryCapacityWh);
  });

  it('reaches a terminal state with every fault resolved', () => {
    const state = playThrough(DEFAULT_DESIGN, 20_261_115);
    expect(['complete', 'failed']).toContain(state.status);
    expect(state.faults.every((fault) => fault.status !== 'pending' && fault.status !== 'active')).toBe(true);
    expect(state.salvage).toHaveLength(3);
  });
});

describe('scene operations', () => {
  it('captures the first scene when its window closes', () => {
    const state = advanceMission(launch(), 490);
    expect(state.scenes[0].status).toBe('stored');
    expect(state.scenes[0].quality).toBeGreaterThan(0);
    expect(state.scenes[0].quality).toBeLessThanOrEqual(1);
    expect(state.dataStoredMb).toBeGreaterThan(0);
    expect(state.scienceCollected).toBeGreaterThan(0);
    expect(state.causal.some((event) => event.title === 'Scene 1 captured')).toBe(true);
  });

  it('toggles a planned skip and keeps it after the window closes', () => {
    const state = launch();
    const sceneId = state.scenes[1].id;
    const skipped = setSceneSkipped(state, sceneId, true);
    expect(skipped.scenes[1].status).toBe('skipped');
    expect(setSceneSkipped(skipped, sceneId, false).scenes[1].status).toBe('pending');

    let later = setSceneSkipped(state, sceneId, true);
    later = advanceMission(later, 2_000);
    expect(later.scenes[1].status).toBe('skipped');
    expect(later.scenes[1].note).toContain('operator');
  });

  it('overwrites the oldest imagery when the recorder fills', () => {
    const smallRecorder = design(
      { ...DEFAULT_DESIGN.ids, radio: 'radio-uhf', instrument: 'cam-hr' },
      true,
      'balanced',
    );
    const state = advanceMission(launch(smallRecorder), 3_500);
    expect(state.scenes[0].status).toBe('lost');
    expect(state.scenes[0].note).toContain('Overwritten');
    expect(state.dataStoredMb).toBeLessThanOrEqual(state.budgets.storageMb);
  });
});

describe('debrief derivation', () => {
  it('produces a bounded, explained result for a full run', () => {
    const state = playThrough(DEFAULT_DESIGN, 20_261_115);
    const result = evaluateMission(state);
    expect(['SUCCESS', 'PARTIAL', 'FAILURE']).toContain(result.status);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.scienceTarget).toBe(SCENARIO.scienceTarget);
    expect(result.dataTargetMb).toBe(SCENARIO.dataTargetMb);
    expect(result.faults).toHaveLength(3);
    expect(result.salvage).toHaveLength(3);
  });

  it('records an operator-aborted mission honestly', () => {
    const state = playThrough(DEFAULT_DESIGN, 5, { chooseAction: () => 'cease-ops' });
    const result = evaluateMission(state);
    expect(state.failureReason).toContain('ended by the operator');
    expect(state.t).toBe(6_480);
    expect(result.status).not.toBe('SUCCESS');
  });
});

describe('brownout and load shedding', () => {
  it('clears the brownout once the battery recharges instead of latching to failure', () => {
    let state = launch();
    while (!state.inSunlight || state.t < 2_000) state = advanceMission(state, 10);
    state = { ...state, batteryWh: 0, brownout: true, brownoutSec: 10 };
    state = advanceMission(state, 100);
    expect(state.status).toBe('running');
    expect(state.brownout).toBe(false);
    expect(state.brownoutSec).toBe(0);
    expect(state.batteryWh).toBeGreaterThan(0);
  });

  it('scores a scene whose instrument lost power at minimum quality and logs it once', () => {
    let state = launch();
    // Find an imaging window that opens in eclipse, then drain the battery inside it.
    const index = state.sceneWindows.findIndex((window) => {
      let probe = state;
      while (probe.t < window.startSec + 10) probe = advanceMission(probe, 10);
      return !probe.inSunlight;
    });
    expect(index).toBeGreaterThanOrEqual(0);
    const window = state.sceneWindows[index];
    while (state.t < window.startSec + 10) state = advanceMission(state, 10);
    state = advanceMission({ ...state, batteryWh: 0 }, 10);
    expect(state.scenes[index].shed).toBe(true);

    while (state.t < window.endSec + 10 && state.status === 'running') state = advanceMission(state, 10);
    expect(state.scenes[index].quality).toBe(0.05);
    expect(state.scenes[index].note).toContain('lost power');
    const label = state.scenes[index].label;
    const logs = state.causal.filter((event) => event.title === 'Instrument shed to protect power' && event.detail.includes(`scene: ${label} `));
    expect(logs).toHaveLength(1);
  });
});
