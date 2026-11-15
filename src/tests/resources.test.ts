import { describe, expect, it } from 'vitest';
import {
  BATTERY_DOD_LIMIT,
  PANEL_LOSS_FACTOR,
  clamp,
  computeBudgets,
  estimatedThroughputMb,
  kbpsToMbPerSec,
  powerStep,
  validateDesign,
} from '../sim/resources';
import { DEFAULT_DESIGN, OBJECTIVES, PRESETS, SCENARIO, design, launchById, scenarioFor } from '../sim/catalogue';
import type { Design } from '../sim/types';

const geometry = { sunlitFraction: 0.66, eclipseMinutes: 34 };

function budgetsFor(input: Design, geometryOverride = geometry) {
  return computeBudgets({ design: input, scenario: SCENARIO, ...geometryOverride });
}

describe('budget accounting', () => {
  it('fits the balanced preset inside the launch limits', () => {
    const budgets = budgetsFor(DEFAULT_DESIGN);
    expect(budgets.massKg).toBeLessThan(budgets.massLimitKg);
    expect(budgets.costUsd).toBeLessThan(budgets.costLimitUsd);
    expect(budgets.massMarginKg).toBeGreaterThan(0);
    expect(budgets.energyMarginW).toBeGreaterThan(0);
    expect(validateDesign(DEFAULT_DESIGN, budgets)).toEqual({ ok: true, issues: [] });
  });

  it('charges the beacon only when it is fitted', () => {
    const without = budgetsFor({ ...DEFAULT_DESIGN, beacon: false });
    const withBeacon = budgetsFor({ ...DEFAULT_DESIGN, beacon: true });
    expect(withBeacon.massKg).toBeCloseTo(without.massKg + 0.05, 2);
    expect(withBeacon.costUsd).toBe(without.costUsd + 1_200);
  });

  it('reports every preset without throwing', () => {
    for (const preset of PRESETS) {
      const budgets = budgetsFor(preset.design);
      expect(budgets.massKg).toBeGreaterThan(0);
      expect(budgets.avgLoadW).toBeGreaterThan(0);
      expect(Number.isFinite(budgets.energyMarginRatio)).toBe(true);
    }
  });

  it('derives usable battery from the depth-of-discharge limit', () => {
    const budgets = budgetsFor(DEFAULT_DESIGN);
    expect(budgets.batteryUsableWh).toBeCloseTo(budgets.batteryCapacityWh * BATTERY_DOD_LIMIT, 1);
  });

  it('halves antenna gain when pointing misses the requirement', () => {
    const coarse = design({ ...DEFAULT_DESIGN.ids, adcs: 'adcs-mag', antenna: 'ant-hga' }, true, 'balanced');
    const budgets = budgetsFor(coarse);
    expect(budgets.effectiveGain).toBeCloseTo(1.3 * 0.55, 2);
    expect(budgets.downlinkKbps).toBeCloseTo(1024 * budgets.effectiveGain, 1);
  });

  it('estimates downlink throughput from the effective rate', () => {
    const budgets = budgetsFor(DEFAULT_DESIGN);
    expect(estimatedThroughputMb(budgets)).toBeGreaterThan(budgets.totalSceneDataMb * 0.5);
  });
});

describe('design validation', () => {
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

  it('blocks an overweight design', () => {
    const result = validateDesign(overweight, budgetsFor(overweight));
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.id === 'mass' && issue.severity === 'error')).toBe(true);
  });

  it('blocks an over-budget design and warns about thin mass margin', () => {
    const pricey: Design = design(
      {
        bus: 'bus-3u-std',
        power: 'power-3u-hi',
        battery: 'batt-40',
        radio: 'radio-xband',
        antenna: 'ant-hga',
        adcs: 'adcs-rw-star',
        instrument: 'cam-ms',
      },
      true,
      'balanced',
    );
    const budgets = budgetsFor(pricey);
    const result = validateDesign(pricey, budgets);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.id === 'cost' && issue.severity === 'error')).toBe(true);
    expect(budgets.massMarginKg).toBeLessThan(0.1);
    expect(result.issues.some((issue) => issue.id === 'mass-thin')).toBe(true);
  });

  it('warns when the design carries no backup beacon', () => {
    const result = validateDesign({ ...DEFAULT_DESIGN, beacon: false }, budgetsFor(DEFAULT_DESIGN));
    expect(result.issues.some((issue) => issue.id === 'beacon' && issue.severity === 'warning')).toBe(true);
  });

  it('applies posture rules in the documented order', () => {
    const thin: Design = design(
      { ...DEFAULT_DESIGN.ids, power: 'power-3u', radio: 'radio-sband' },
      true,
      'balanced',
    );
    const budgets = budgetsFor(thin, { sunlitFraction: 0.75, eclipseMinutes: 25 });
    expect(budgets.energyMarginRatio).toBeGreaterThan(0.05);
    expect(budgets.energyMarginRatio).toBeLessThan(0.15);

    const conservative = validateDesign({ ...thin, riskPosture: 'conservative' }, budgets);
    const balanced = validateDesign({ ...thin, riskPosture: 'balanced' }, budgets);
    const aggressive = validateDesign({ ...thin, riskPosture: 'aggressive' }, budgets);

    expect(conservative.issues.some((issue) => issue.id === 'energy')).toBe(true);
    expect(balanced.issues.some((issue) => issue.id === 'energy')).toBe(false);
    expect(aggressive.issues.some((issue) => issue.id === 'energy')).toBe(false);
  });

  it('rejects an undersized battery for the eclipse load', () => {
    const budgets = budgetsFor(DEFAULT_DESIGN);
    const undersized = { ...budgets, batteryUsableWh: 1, eclipseEnergyNeedWh: 10 };
    const result = validateDesign({ ...DEFAULT_DESIGN, riskPosture: 'conservative' }, undersized);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.id === 'battery')).toBe(true);
  });
});

describe('power step', () => {
  const base = {
    generationW: 13,
    sunlit: true,
    weatherPenaltyW: 0,
    housekeepingW: 1.2,
    adcsW: 2.1,
    radioTxW: 0,
    instrumentW: 0,
    beaconW: 0,
    heaterW: 3.5,
    batteryWh: 10,
    capacityWh: 40,
    dtSec: 10,
    dischargeLimitW: null,
  };

  it('charges in sunlight with panel losses applied', () => {
    const result = powerStep({ ...base, weatherPenaltyW: 1.2 });
    expect(result.generationW).toBeCloseTo(13 * PANEL_LOSS_FACTOR - 1.2, 2);
    expect(result.loadW).toBeCloseTo(3.3, 2);
    expect(result.batteryWh).toBeGreaterThan(base.batteryWh);
  });

  it('never charges above capacity', () => {
    const result = powerStep({ ...base, batteryWh: 39.99, dtSec: 3600 });
    expect(result.batteryWh).toBe(40);
  });

  it('drains the battery and adds the heater in eclipse', () => {
    const result = powerStep({ ...base, sunlit: false, batteryWh: 10, dtSec: 3600 });
    expect(result.generationW).toBe(0);
    expect(result.loadW).toBeCloseTo(1.2 + 2.1 + 3.5, 2);
    expect(result.batteryWh).toBeCloseTo(10 - 6.8, 1);
    expect(result.brownout).toBe(false);
  });

  it('flags a brownout when the battery is empty', () => {
    const result = powerStep({ ...base, sunlit: false, batteryWh: 0.01, dtSec: 60 });
    expect(result.batteryWh).toBe(0);
    expect(result.brownout).toBe(true);
  });

  it('sheds the instrument first, then the radio, under a discharge limit', () => {
    const load = { ...base, instrumentW: 3.2, radioTxW: 7.4 };
    const first = powerStep({ ...load, dischargeLimitW: 12 });
    expect(first.shedInstrument).toBe(true);
    expect(first.shedRadio).toBe(false);
    expect(first.loadW).toBeCloseTo(1.2 + 2.1 + 7.4, 2);

    const second = powerStep({ ...load, dischargeLimitW: 5 });
    expect(second.shedInstrument).toBe(true);
    expect(second.shedRadio).toBe(true);
    expect(second.loadW).toBeCloseTo(1.2 + 2.1, 2);
  });

  it('does not shed anything with a healthy battery', () => {
    const result = powerStep({ ...base, instrumentW: 3.2, radioTxW: 7.4 });
    expect(result.shedInstrument).toBe(false);
    expect(result.shedRadio).toBe(false);
  });
});

describe('unit helpers', () => {
  it('clamps into range', () => {
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(2, 0, 1)).toBe(1);
    expect(clamp(0.4, 0, 1)).toBe(0.4);
  });

  it('converts kbps to MB per second', () => {
    expect(kbpsToMbPerSec(8_192)).toBeCloseTo(1.024, 6);
    expect(kbpsToMbPerSec(0)).toBe(0);
  });
});

describe('mission choices', () => {
  const geometry = { sunlitFraction: 0.66, eclipseMinutes: 34 };

  it('takes the mass limit and part of the budget from the launch', () => {
    const rideshare = computeBudgets({ design: DEFAULT_DESIGN, scenario: SCENARIO, ...geometry });
    const dedicated = computeBudgets({
      design: { ...DEFAULT_DESIGN, mission: { ...DEFAULT_DESIGN.mission, launch: 'dedicated' } },
      scenario: SCENARIO,
      ...geometry,
    });
    expect(rideshare.massLimitKg).toBe(launchById('rideshare-sso').massCapacityKg);
    expect(dedicated.massLimitKg).toBe(launchById('dedicated').massCapacityKg);
    expect(dedicated.costUsd - rideshare.costUsd).toBe(launchById('dedicated').costUsd - launchById('rideshare-sso').costUsd);
  });

  it('blocks a launch that cannot reach the chosen orbit', () => {
    const stranded = { ...DEFAULT_DESIGN, mission: { ...DEFAULT_DESIGN.mission, orbit: 'iss-420' as const } };
    const validation = validateDesign(stranded, computeBudgets({ design: stranded, scenario: SCENARIO, ...geometry }));
    expect(validation.ok).toBe(false);
    expect(validation.issues.some((issue) => issue.id === 'launch-orbit')).toBe(true);
  });

  it('sets the mission targets from the objective', () => {
    for (const objective of OBJECTIVES) {
      const scenario = scenarioFor({ ...DEFAULT_DESIGN.mission, objective: objective.id });
      expect(scenario.scienceTarget).toBe(objective.scienceTarget);
      expect(scenario.dataTargetMb).toBe(objective.dataTargetMb);
      expect(scenario.faults).toEqual(SCENARIO.faults);
    }
  });
});
