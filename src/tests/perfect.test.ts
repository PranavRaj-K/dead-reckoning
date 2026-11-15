import { describe, expect, it } from 'vitest';
import { PERFECT_RUN, isPerfectDesign, isPerfectRun } from '../sim/perfect';
import { getRecoveryActions } from '../sim/salvage';
import { evaluateMission } from '../sim/scoring';
import { playThrough, reference } from './helpers';

function fly(stepSec: number) {
  return playThrough(PERFECT_RUN.design, PERFECT_RUN.seed, {
    stepSec,
    chooseAction: (state) => (state.activeFault ? PERFECT_RUN.flight[state.activeFault].actionId : null),
  });
}

describe('Grade S plan', () => {
  it('replays to the advertised score and grade S, at any clock speed', () => {
    for (const stepSec of [10, 60, 90]) {
      const state = fly(stepSec);
      const result = evaluateMission(state);
      expect(result.status).toBe('SUCCESS');
      expect(result.grade).toBe('S');
      expect(result.score).toBe(PERFECT_RUN.score);
      expect(isPerfectRun(state)).toBe(true);
    }
  });

  it('names a recovery that exists and is available at each fault', () => {
    const state = fly(60);
    for (const decision of state.salvage) {
      expect(decision.actionId).toBe(PERFECT_RUN.flight[decision.faultId].actionId);
    }
    expect(state.salvage).toHaveLength(3);
    for (const [faultId, step] of Object.entries(PERFECT_RUN.flight)) {
      const ids = getRecoveryActions(state, faultId as keyof typeof PERFECT_RUN.flight).map((action) => action.id);
      expect(ids).toContain(step.actionId);
    }
  });

  it('flies the same bundled element set the plan was optimised on', () => {
    expect(PERFECT_RUN.reference).toEqual(reference);
  });

  it('stops matching once any part or the seed changes', () => {
    expect(isPerfectDesign(PERFECT_RUN.design, PERFECT_RUN.seed)).toBe(true);
    expect(isPerfectDesign(PERFECT_RUN.design, PERFECT_RUN.seed + 1)).toBe(false);
    expect(isPerfectDesign({ ...PERFECT_RUN.design, beacon: true }, PERFECT_RUN.seed)).toBe(false);
    expect(isPerfectDesign({ ...PERFECT_RUN.design, ids: { ...PERFECT_RUN.design.ids, battery: 'batt-28' } }, PERFECT_RUN.seed)).toBe(false);
  });
});
