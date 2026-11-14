/**
 * NASA DONKI adapter.
 *
 * DONKI is an event and analysis database, not a spacecraft radiation measurement.
 * The game only uses event classes and Kp indices as bounded scenario modifiers.
 *
 * The FLR endpoint has been observed returning HTTP 404 from the public API, so a
 * partial failure is a normal state: the remaining sources still produce a usable
 * weather snapshot and the UI reports which source was unavailable.
 */
import type { SpaceWeather } from '../sim/types';
import { fetchJson } from './http';
import { buildSpaceWeather, normalizeFlares, normalizeSeps, normalizeStorms } from './normalize';

export const DONKI_SOURCE = 'NASA DONKI';

export function donkiUrl(path: string, startDate: string, endDate: string, apiKey: string): string {
  const params = new URLSearchParams({
    startDate,
    endDate,
    api_key: apiKey,
  });
  return `https://api.nasa.gov/DONKI/${path}?${params.toString()}`;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Normalise one settled source; record its name in `failed` if it did not work. */
function pick<T>(
  result: PromiseSettledResult<unknown>,
  name: string,
  normalize: (payload: unknown) => T[],
  failed: string[],
): T[] {
  if (result.status !== 'fulfilled') {
    failed.push(name);
    return [];
  }
  try {
    return normalize(result.value);
  } catch {
    failed.push(name);
    return [];
  }
}

export interface DonkiResult {
  weather: SpaceWeather;
  /** Sources that failed; empty when every source answered. */
  failed: string[];
}

export async function fetchWeather(apiKey: string, days = 30, timeoutMs = 8000): Promise<DonkiResult> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  const startDate = isoDay(start);
  const endDate = isoDay(end);

  const [flr, gst, sep] = await Promise.allSettled([
    fetchJson(donkiUrl('FLR', startDate, endDate, apiKey), timeoutMs),
    fetchJson(donkiUrl('GST', startDate, endDate, apiKey), timeoutMs),
    fetchJson(donkiUrl('SEP', startDate, endDate, apiKey), timeoutMs),
  ]);

  const failed: string[] = [];
  const flares = pick(flr, 'FLR', normalizeFlares, failed);
  const storms = pick(gst, 'GST', normalizeStorms, failed);
  const seps = pick(sep, 'SEP', normalizeSeps, failed);

  if (failed.length === 3) {
    const reason = [flr, gst, sep]
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map((result) => (result.reason instanceof Error ? result.reason.message : String(result.reason)))
      .join('; ');
    throw new Error(`DONKI unavailable: ${reason}`);
  }

  return {
    weather: buildSpaceWeather({
      flares,
      storms,
      seps,
      windowStartUtc: `${startDate}T00:00:00.000Z`,
      windowEndUtc: `${endDate}T23:59:59.999Z`,
    }),
    failed,
  };
}
