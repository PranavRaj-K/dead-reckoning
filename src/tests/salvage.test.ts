import { describe, expect, it } from 'vitest';
import { FAULTS, RADIO_RESET_SUCCESS_CHANCE, faultCopy, getRecoveryActions, upcomingScenes } from '../sim/salvage';
import type { FaultId, MissionState, SalvageDecision, SceneRecord } from '../sim/types';
import { launch } from './helpers';

const base = launch();

function actionsFor(state: MissionState, faultId: FaultId) {
  return getRecoveryActions(state, faultId);
}

function attemptedReset(): SalvageDecision {
  return {
    faultId: 'radio-failure',
    actionId: 'radio-reset',
    actionLabel: 'Attempt a radio reset',
    atSec: 6_480,
    outcome: 'applied',
    note: 'attempted',
  };
}

describe('radio failure salvage', () => {
  it('offers a beacon, a risky reset and an exit', () => {
    const actions = actionsFor(base, 'radio-failure');
    expect(actions.map((action) => action.id)).toEqual(['switch-beacon', 'radio-reset', 'cease-ops']);
    expect(actions.find((action) => action.id === 'switch-beacon')?.unavailableReason).toBeUndefined();
    expect(actions.find((action) => action.id === 'radio-reset')?.risk?.successChance).toBe(
      RADIO_RESET_SUCCESS_CHANCE,
    );
    expect(actions.find((action) => action.id === 'cease-ops')?.endsMission).toBe(true);
  });

  it('blocks the beacon when the design never carried one', () => {
    const actions = actionsFor({ ...base, design: { ...base.design, beacon: false } }, 'radio-failure');
    expect(actions.find((action) => action.id === 'switch-beacon')?.unavailableReason).toContain('no backup beacon');
  });

  it('blocks a second reset once one has been attempted', () => {
    const actions = actionsFor({ ...base, salvage: [attemptedReset()] }, 'radio-failure');
    expect(actions.find((action) => action.id === 'radio-reset')?.unavailableReason).toContain('already attempted');
  });
});

describe('attitude-control salvage', () => {
  it('offers magnetic mode, degraded pointing and schedule trimming', () => {
    const actions = actionsFor(base, 'adcs-degradation');
    expect(actions.map((action) => action.id)).toEqual(['magnetic-mode', 'accept-degraded', 'trim-schedule']);
    expect(actions.every((action) => action.unavailableReason === undefined)).toBe(true);
  });

  it('blocks magnetic mode when already running magnetic', () => {
    const actions = actionsFor({ ...base, adcsMode: 'magnetic' }, 'adcs-degradation');
    expect(actions.find((action) => action.id === 'magnetic-mode')?.unavailableReason).toContain('Already running');
  });

  it('blocks schedule trimming when fewer than three windows remain', () => {
    const scenes: SceneRecord[] = base.scenes.map((scene, i) =>
      i < base.scenes.length - 2 ? { ...scene, status: 'skipped' } : scene,
    );
    const state: MissionState = { ...base, scenes };
    expect(upcomingScenes(state, 3)).toHaveLength(2);
    const actions = actionsFor(state, 'adcs-degradation');
    expect(actions.find((action) => action.id === 'trim-schedule')?.unavailableReason).toContain('Fewer than three');
  });
});

describe('battery salvage', () => {
  it('offers a sun-safe pause and a shed-and-continue path', () => {
    const actions = actionsFor(base, 'battery-degradation');
    expect(actions.map((action) => action.id)).toEqual(['sun-safe', 'accept-degraded']);
    expect(actions.every((action) => action.unavailableReason === undefined)).toBe(true);
  });

  it('blocks the sun-safe skip when fewer than two windows remain', () => {
    const scenes: SceneRecord[] = base.scenes.map((scene, i) =>
      i < base.scenes.length - 1 ? { ...scene, status: 'skipped' } : scene,
    );
    const actions = actionsFor({ ...base, scenes }, 'battery-degradation');
    expect(actions.find((action) => action.id === 'sun-safe')?.unavailableReason).toContain('Fewer than two');
  });
});

describe('fault copy', () => {
  it('has a title, symptoms and cause hint for every fault', () => {
    for (const id of Object.keys(FAULTS) as FaultId[]) {
      const copy = faultCopy(id);
      expect(copy.id).toBe(id);
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.symptoms.length).toBeGreaterThanOrEqual(2);
      expect(copy.causeHint.length).toBeGreaterThan(20);
    }
  });

  it('states a trade-off for every recovery action', () => {
    for (const id of ['radio-failure', 'adcs-degradation', 'battery-degradation'] as FaultId[]) {
      for (const action of actionsFor(base, id)) {
        expect(action.tradeoff.length).toBeGreaterThan(10);
        expect(action.description.length).toBeGreaterThan(10);
      }
    }
  });
});
