import { describe, expect, it } from 'vitest';
import { evaluateMission } from '../sim/scoring';
import type { MissionState } from '../sim/types';
import { launch } from './helpers';

const base = launch();

function withOutcome(overrides: Partial<MissionState>): MissionState {
  return { ...base, ...overrides };
}

/** Resource component is maximised when mass and energy margins are full and the battery is charged. */
function fullResources(state: MissionState): MissionState {
  return {
    ...state,
    batteryWh: state.batteryCapacityWh,
    budgets: {
      ...state.budgets,
      massMarginKg: state.budgets.massLimitKg,
      energyMarginW: Math.max(0.1, state.budgets.avgLoadW * 0.15),
    },
  };
}

describe('mission scoring', () => {
  it('awards 100 for full science, full data and full margins', () => {
    const state = fullResources(
      withOutcome({
        scienceDelivered: base.scienceTarget,
        dataDeliveredMb: base.dataTargetMb,
        status: 'complete',
      }),
    );
    const result = evaluateMission(state);
    expect(result.status).toBe('SUCCESS');
    expect(result.components).toEqual({ science: 100, data: 100, resources: 100 });
    expect(result.score).toBe(100);
    expect(result.grade).toBe('S');
  });

  it('reports PARTIAL at half the science target', () => {
    const state = withOutcome({
      scienceDelivered: base.scienceTarget * 0.6,
      dataDeliveredMb: base.dataTargetMb * 0.4,
      status: 'complete',
    });
    const result = evaluateMission(state);
    expect(result.status).toBe('PARTIAL');
    expect(result.components.science).toBe(60);
    expect(result.components.data).toBe(40);
    expect(result.grade).not.toBe('A');
  });

  it('reports FAILURE when the spacecraft is lost, whatever was delivered', () => {
    const state = fullResources(
      withOutcome({
        status: 'failed',
        failureReason: 'Battery depleted',
        scienceDelivered: base.scienceTarget,
        dataDeliveredMb: base.dataTargetMb,
      }),
    );
    const result = evaluateMission(state);
    expect(result.status).toBe('FAILURE');
    expect(result.failureReason).toBe('Battery depleted');
  });

  it('reports FAILURE below half the science target', () => {
    const result = evaluateMission(
      withOutcome({ scienceDelivered: base.scienceTarget * 0.2, dataDeliveredMb: base.dataTargetMb, status: 'complete' }),
    );
    expect(result.status).toBe('FAILURE');
  });

  it('never exceeds the component bounds or returns NaN', () => {
    const result = evaluateMission(
      withOutcome({ scienceDelivered: base.scienceTarget * 4, dataDeliveredMb: base.dataTargetMb * 4 }),
    );
    for (const value of Object.values(result.components)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('derives scene counts and battery ratio from the recorded state', () => {
    const scenes = base.scenes.map((scene, i) => ({
      ...scene,
      status: (i < 3 ? 'stored' : i < 5 ? 'lost' : i < 7 ? 'skipped' : 'pending') as MissionState['scenes'][number]['status'],
    }));
    const result = evaluateMission({ ...base, scenes });
    expect(result.scenesStored).toBe(3);
    expect(result.scenesLost).toBe(2);
    expect(result.scenesSkipped).toBe(2);
    expect(result.batteryFinalRatio).toBeCloseTo(base.batteryWh / base.batteryCapacityWh, 2);
  });

  it('grades monotonically', () => {
    const gradeOf = (score: number) =>
      evaluateMission(
        withOutcome({
          scienceDelivered: (score / 100) * base.scienceTarget,
          dataDeliveredMb: (score / 100) * base.dataTargetMb,
          status: 'complete',
        }),
      );
    const order = ['F', 'D', 'C', 'B', 'A'];
    const low = gradeOf(10).grade;
    const high = gradeOf(95).grade;
    expect(order.indexOf(low)).toBeLessThan(order.indexOf(high));
    expect(high).toBe('A');
  });
});
