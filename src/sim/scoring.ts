/**
 * Mission scoring. Derived only from values the simulation actually recorded.
 *
 * Weights: science delivered 60%, data delivered 25%, resource stewardship 15%.
 * The grade is a teaching signal, not a competition score. S is reserved for a
 * mission that meets both targets and scores 95 or more.
 */
import type { MissionResult, MissionState } from './types';
import { clamp } from './resources';

const WEIGHTS = { science: 0.6, data: 0.25, resources: 0.15 };

export function evaluateMission(state: MissionState): MissionResult {
  const scienceRatio = state.scienceTarget > 0 ? state.scienceDelivered / state.scienceTarget : 0;
  const dataRatio = state.dataTargetMb > 0 ? state.dataDeliveredMb / state.dataTargetMb : 0;

  const massMarginRatio = clamp(
    state.budgets.massMarginKg / Math.max(0.01, state.budgets.massLimitKg),
    0,
    1,
  );
  const energyTargetW = Math.max(0.1, state.budgets.avgLoadW * 0.15);
  const energyRatio = clamp(state.budgets.energyMarginW / energyTargetW, 0, 1);
  const batteryRatio = clamp(state.batteryWh / Math.max(0.01, state.batteryCapacityWh), 0, 1);
  const resourceScore = (massMarginRatio + energyRatio + batteryRatio) / 3;

  const components = {
    science: round(clamp(scienceRatio, 0, 1) * 100, 1),
    data: round(clamp(dataRatio, 0, 1) * 100, 1),
    resources: round(resourceScore * 100, 1),
  };

  const score = round(
    (components.science * WEIGHTS.science + components.data * WEIGHTS.data + components.resources * WEIGHTS.resources),
    1,
  );

  const status: MissionResult['status'] =
    state.status === 'failed'
      ? 'FAILURE'
      : scienceRatio >= 1 && dataRatio >= 1
        ? 'SUCCESS'
        : scienceRatio >= 0.5
          ? 'PARTIAL'
          : 'FAILURE';

  return {
    status,
    grade: gradeFor(score, status),
    score,
    scienceDelivered: round(state.scienceDelivered, 2),
    scienceTarget: state.scienceTarget,
    scienceCollected: round(state.scienceCollected, 2),
    dataDeliveredMb: round(state.dataDeliveredMb, 2),
    dataTargetMb: state.dataTargetMb,
    dataGeneratedMb: round(state.dataGeneratedMb, 2),
    scenesStored: state.scenes.filter((scene) => scene.status === 'stored').length,
    scenesLost: state.scenes.filter((scene) => scene.status === 'lost').length,
    scenesSkipped: state.scenes.filter((scene) => scene.status === 'skipped').length,
    batteryFinalRatio: round(batteryRatio, 3),
    faults: state.faults,
    salvage: state.salvage,
    failureReason: state.failureReason,
    components,
  };
}

function gradeFor(score: number, status: MissionResult['status']): MissionResult['grade'] {
  if (status === 'SUCCESS' && score >= 95) return 'S';
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
