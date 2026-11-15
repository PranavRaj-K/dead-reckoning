import { describe, expect, it } from 'vitest';
import { adviseNextRun } from '../sim/advice';
import { PRESETS } from '../sim/catalogue';
import { evaluateMission } from '../sim/scoring';
import type { MissionState } from '../sim/types';
import { playThrough } from './helpers';

const downlinkHeavy = PRESETS.find((preset) => preset.id === 'comms')!.design;

function advise(state: MissionState) {
  return adviseNextRun(state, evaluateMission(state));
}

describe('post-mission advice', () => {
  it('suggests a backup beacon when the radio reset fails on a design without one', () => {
    expect(downlinkHeavy.beacon).toBe(false);
    // Try seeds until the seeded 45% reset roll fails, so the test does not hinge on one seed.
    let state: MissionState | null = null;
    for (let seed = 1; seed < 40 && !state; seed += 1) {
      const run = playThrough(downlinkHeavy, seed, {
        chooseAction: (s) => (s.activeFault === 'radio-failure' ? 'radio-reset' : null),
      });
      if (run.salvage.some((entry) => entry.actionId === 'radio-reset' && entry.outcome === 'risk-failed')) state = run;
    }
    expect(state).not.toBeNull();
    const beacon = advise(state!).find((item) => item.id === 'beacon');
    expect(beacon?.change?.design.beacon).toBe(true);
    expect(beacon?.change?.design.ids).toEqual(downlinkHeavy.ids);
  });

  it('changes exactly one thing per card and re-validates the result', () => {
    for (const preset of PRESETS) {
      const state = playThrough(preset.design, 7);
      const advice = advise(state);
      expect(advice.length).toBeGreaterThan(0);
      expect(advice.length).toBeLessThanOrEqual(4);
      for (const item of advice) {
        if (!item.change) continue;
        const before = state.design;
        const after = item.change.design;
        const changedSlots = (Object.keys(before.ids) as (keyof typeof before.ids)[]).filter(
          (slot) => before.ids[slot] !== after.ids[slot],
        );
        const otherChanges = Number(before.beacon !== after.beacon) + Number(before.riskPosture !== after.riskPosture);
        expect(changedSlots.length + otherChanges).toBe(1);
        if (!item.change.launchable) expect(item.change.blocker).toBeTruthy();
      }
    }
  });

  it('blames the full recorder exactly when scenes were overwritten', () => {
    for (const preset of PRESETS) {
      const state = playThrough(preset.design, 7);
      const result = evaluateMission(state);
      expect(adviseNextRun(state, result).some((item) => item.id === 'recorder')).toBe(result.scenesLost > 0);
    }
  });
});
