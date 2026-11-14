import { describe, expect, it } from 'vitest';
import { deriveWeatherModifiers, flareSeverity, strongestFlare, strongestStorm } from '../sim/events';
import type { FlareRecord, SpaceWeather, StormRecord } from '../sim/types';
import { calmWeather } from './helpers';

function flare(classType: string, id = classType): FlareRecord {
  return { id, beginUtc: '2026-10-31T00:00:00.000Z', classType, strength: 0 };
}

function storm(maxKp: number, id = `kp-${maxKp}`): StormRecord {
  return { id, startUtc: '2026-10-31T00:00:00.000Z', maxKp };
}

function weatherWith(overrides: Partial<SpaceWeather>): SpaceWeather {
  return { ...calmWeather, ...overrides };
}

describe('flare classification', () => {
  it('orders NOAA classes from A to X', () => {
    const a = flareSeverity('A1');
    const b = flareSeverity('B1');
    const c = flareSeverity('C1');
    const m = flareSeverity('M1');
    const x = flareSeverity('X1');
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    expect(c).toBeLessThan(m);
    expect(m).toBeLessThan(x);
  });

  it('scales within a class and clamps at 1', () => {
    expect(flareSeverity('X1')).toBeLessThan(flareSeverity('X9'));
    expect(flareSeverity('X20')).toBe(1);
    expect(flareSeverity('M5')).toBeGreaterThan(flareSeverity('M1'));
  });

  it('treats unknown classes as near zero rather than NaN', () => {
    expect(flareSeverity('?')).toBeLessThan(0.05);
    expect(Number.isFinite(flareSeverity(''))).toBe(true);
  });

  it('picks the strongest flare regardless of order', () => {
    expect(strongestFlare([flare('C3'), flare('X1'), flare('M2')])?.classType).toBe('X1');
    expect(strongestFlare([])).toBeNull();
  });

  it('picks the storm with the highest Kp', () => {
    expect(strongestStorm([storm(5), storm(8), storm(3)])?.maxKp).toBe(8);
    expect(strongestStorm([])).toBeNull();
  });
});

describe('weather modifier mapping', () => {
  it('stays at the floor for a quiet window', () => {
    const modifiers = deriveWeatherModifiers(calmWeather);
    expect(modifiers.radiationNoise).toBe(0);
    expect(modifiers.powerPenaltyW).toBe(0.2);
    expect(modifiers.pointingPenaltyDeg).toBe(0);
    expect(modifiers.notes.some((note) => note.includes('No solar flares'))).toBe(true);
    expect(modifiers.notes.some((note) => note.includes('No geomagnetic storm'))).toBe(true);
  });

  it('applies the severe-storm rule above Kp 7', () => {
    const modifiers = deriveWeatherModifiers(weatherWith({ storms: [storm(8)] }));
    expect(modifiers.powerPenaltyW).toBe(2);
    expect(modifiers.pointingPenaltyDeg).toBe(0.5);
  });

  it('steps the storm rules at Kp 4, 5 and 7', () => {
    expect(deriveWeatherModifiers(weatherWith({ storms: [storm(3)] })).powerPenaltyW).toBe(0.2);
    expect(deriveWeatherModifiers(weatherWith({ storms: [storm(4)] })).powerPenaltyW).toBe(0.6);
    expect(deriveWeatherModifiers(weatherWith({ storms: [storm(5)] })).pointingPenaltyDeg).toBe(0.35);
    expect(deriveWeatherModifiers(weatherWith({ storms: [storm(6)] })).powerPenaltyW).toBe(1.2);
  });

  it('raises sensor noise for a strong flare', () => {
    const modifiers = deriveWeatherModifiers(weatherWith({ flares: [flare('X2')] }));
    expect(modifiers.radiationNoise).toBeCloseTo(0.8, 2);
    expect(modifiers.notes.some((note) => note.includes('X2'))).toBe(true);
  });

  it('floors sensor noise at 0.65 when a SEP event is present', () => {
    const modifiers = deriveWeatherModifiers(
      weatherWith({ seps: [{ id: 'sep-1', eventUtc: '2026-10-31T00:00:00.000Z', protonFlux: null }] }),
    );
    expect(modifiers.radiationNoise).toBe(0.65);
    expect(modifiers.notes.some((note) => note.includes('energetic particle'))).toBe(true);
  });

  it('keeps every modifier bounded', () => {
    const worst = deriveWeatherModifiers(
      weatherWith({
        flares: [flare('X20')],
        storms: [storm(9)],
        seps: [{ id: 'sep-1', eventUtc: '2026-10-31T00:00:00.000Z', protonFlux: null }],
      }),
    );
    expect(worst.radiationNoise).toBeLessThanOrEqual(1);
    expect(worst.powerPenaltyW).toBeLessThanOrEqual(2);
    expect(worst.pointingPenaltyDeg).toBeLessThanOrEqual(0.5);
    expect(worst.notes.length).toBeGreaterThanOrEqual(3);
  });
});
