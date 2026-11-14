import { describe, expect, it } from 'vitest';
import {
  SUNLIGHT_SHADOW_THRESHOLD,
  createSatrec,
  dateAt,
  estimateSunlight,
  findContactWindows,
  orbitalPeriodMinutes,
  orbitStateAt,
  sunUnitEci,
} from '../sim/orbit';
import { SCENARIO } from '../sim/catalogue';
import { reference } from './helpers';

const satrec = createSatrec(reference);
const periodMinutes = orbitalPeriodMinutes(reference);
const start = dateAt(reference.epochUtc, 0);

describe('SGP4 propagation of the real reference elements', () => {
  it('has a low-Earth orbital period', () => {
    expect(periodMinutes).toBeGreaterThan(95);
    expect(periodMinutes).toBeLessThan(105);
  });

  it('places the reference object at a plausible sun-synchronous altitude', () => {
    const state = orbitStateAt(satrec, start);
    expect(state).not.toBeNull();
    expect(state!.altitudeKm).toBeGreaterThan(750);
    expect(state!.altitudeKm).toBeLessThan(810);
    expect(state!.speedKmPerSec).toBeGreaterThan(7.2);
    expect(state!.speedKmPerSec).toBeLessThan(7.8);
    expect(state!.radiusEarthRadii).toBeGreaterThan(1.1);
    expect(state!.radiusEarthRadii).toBeLessThan(1.15);
  });

  it('keeps the ground track inside the inclination envelope', () => {
    for (let t = 0; t < 6 * 3600; t += 600) {
      const state = orbitStateAt(satrec, dateAt(reference.epochUtc, t));
      expect(state).not.toBeNull();
      expect(Math.abs(state!.latDeg)).toBeLessThanOrEqual(reference.inclinationDeg + 0.5);
      expect(Math.abs(state!.lonDeg)).toBeLessThanOrEqual(180);
    }
  });

  it('derives sunlight from geometry rather than a constant', () => {
    const state = orbitStateAt(satrec, start)!;
    expect(state.shadowFraction).toBeGreaterThanOrEqual(0);
    expect(state.shadowFraction).toBeLessThanOrEqual(1);
    expect(state.inSunlight).toBe(state.shadowFraction < SUNLIGHT_SHADOW_THRESHOLD);
  });

  it('finds a plausible eclipse fraction for a mid-morning sun-synchronous orbit', () => {
    const { sunlitFraction, eclipseMinutes } = estimateSunlight(satrec, start, periodMinutes);
    expect(sunlitFraction).toBeGreaterThan(0.5);
    expect(sunlitFraction).toBeLessThan(0.85);
    expect(eclipseMinutes).toBeGreaterThan(25);
    expect(eclipseMinutes).toBeLessThan(45);
  });

  it('normalises the solar position vector', () => {
    const sun = sunUnitEci(start);
    expect(Math.hypot(sun.x, sun.y, sun.z)).toBeCloseTo(1, 6);
  });

  it('maps mission time onto the element epoch', () => {
    expect(dateAt(reference.epochUtc, 0).toISOString()).toBe(reference.epochUtc);
    expect(dateAt(reference.epochUtc, 3600).getTime() - dateAt(reference.epochUtc, 0).getTime()).toBe(3_600_000);
  });
});

describe('ground-station contact windows', () => {
  const windows = findContactWindows(satrec, start, SCENARIO.durationSec, SCENARIO.stations);

  it('finds passes for the modelled stations over six hours', () => {
    expect(windows.length).toBeGreaterThan(0);
  });

  it('returns ordered, bounded windows above the elevation mask', () => {
    for (let i = 0; i < windows.length; i += 1) {
      const window = windows[i];
      expect(window.endSec).toBeGreaterThan(window.startSec);
      expect(window.startSec).toBeGreaterThanOrEqual(0);
      expect(window.endSec).toBeLessThanOrEqual(SCENARIO.durationSec);
      expect(window.peakElevationDeg).toBeGreaterThanOrEqual(5);
      expect(window.linkQuality).toBeGreaterThan(0.55);
      expect(window.linkQuality).toBeLessThanOrEqual(1);
      if (i > 0) expect(window.startSec).toBeGreaterThanOrEqual(windows[i - 1].startSec);
    }
  });

  it('only names stations from the scenario', () => {
    const ids = new Set(SCENARIO.stations.map((station) => station.id));
    for (const window of windows) expect(ids.has(window.stationId)).toBe(true);
  });
});
