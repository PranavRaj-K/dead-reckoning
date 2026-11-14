/**
 * Space-weather mapping layer.
 *
 * DONKI is an event/analysis database. It does NOT measure radiation at the
 * player's spacecraft. This module turns event records into bounded, clearly
 * labelled game modifiers. Every rule below is documented in docs/ASSUMPTIONS.md
 * and surfaced in the app, because an unexplained number is a lie in a teaching
 * tool.
 */
import type {
  FlareRecord,
  SpaceWeather,
  StormRecord,
  WeatherModifiers,
} from './types';
import { clamp } from './resources';

/** NOAA flare classes, mapped to a 0..1 severity index. */
export function flareSeverity(classType: string): number {
  const letter = classType.trim().charAt(0).toUpperCase();
  const major = Number.parseFloat(classType.slice(1)) || 1;
  const base: Record<string, number> = { X: 0.75, M: 0.5, C: 0.25, B: 0.1, A: 0 };
  const value = (base[letter] ?? 0) + Math.min(0.25, (major / 10) * 0.25);
  return clamp(value, 0, 1);
}

export function strongestFlare(flares: FlareRecord[]): FlareRecord | null {
  if (flares.length === 0) return null;
  return flares.reduce((best, flare) =>
    flareSeverity(flare.classType) > flareSeverity(best.classType) ? flare : best,
  );
}

export function strongestStorm(storms: StormRecord[]): StormRecord | null {
  if (storms.length === 0) return null;
  return storms.reduce((best, storm) => (storm.maxKp > best.maxKp ? storm : best));
}

/**
 * Rules (all bounded and deliberately simple):
 *   radiationNoise       = max(flare severity, SEP present ? 0.65 : 0)
 *                          -> up to -25% science quality (sensor noise)
 *   powerPenaltyW        = Kp >= 7 ? 2.0 : Kp >= 5 ? 1.2 : Kp >= 4 ? 0.6 : 0.2
 *                          -> subtracted from solar generation (heater + array derate)
 *   pointingPenaltyDeg   = Kp >= 7 ? 0.5 : Kp >= 5 ? 0.35 : 0
 *                          -> added to attitude error (drag / disturbance torque)
 */
export function deriveWeatherModifiers(weather: SpaceWeather): WeatherModifiers {
  const flare = strongestFlare(weather.flares);
  const storm = strongestStorm(weather.storms);
  const hasSep = weather.seps.length > 0;
  const kp = storm?.maxKp ?? 0;

  const flareNoise = flare ? flareSeverity(flare.classType) : 0;
  const sepNoise = hasSep ? 0.65 : 0;
  const radiationNoise = round(clamp(Math.max(flareNoise, sepNoise), 0, 1), 3);

  const powerPenaltyW = kp >= 7 ? 2 : kp >= 5 ? 1.2 : kp >= 4 ? 0.6 : 0.2;
  const pointingPenaltyDeg = kp >= 7 ? 0.5 : kp >= 5 ? 0.35 : 0;

  const notes: string[] = [];
  notes.push(
    flare
      ? `Strongest flare in the DONKI window: ${flare.classType} at ${flare.beginUtc}. Game effect: sensor noise factor ${radiationNoise} (up to -25% science quality).`
      : 'No solar flares in the DONKI window. Game effect: baseline sensor noise only.',
  );
  notes.push(
    storm
      ? `Geomagnetic storm peak Kp ${storm.maxKp} (${storm.startUtc}). Game effect: ${powerPenaltyW} W generation penalty, ${pointingPenaltyDeg}° attitude disturbance.`
      : 'No geomagnetic storm in the DONKI window. Game effect: minimum 0.2 W shipkeeping penalty.',
  );
  if (hasSep) {
    notes.push(
      `${weather.seps.length} solar energetic particle event(s). Game effect: radiation noise floor raised to 0.65.`,
    );
  }
  notes.push(
    `Window: ${weather.windowStartUtc} to ${weather.windowEndUtc}. These are bounded educational effects, not a radiation dose or a spacecraft-environment prediction.`,
  );

  return { radiationNoise, powerPenaltyW, pointingPenaltyDeg, notes };
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
