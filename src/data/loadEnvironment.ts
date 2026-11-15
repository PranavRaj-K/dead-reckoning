/**
 * Environment loading: live -> local cache -> bundled snapshot.
 *
 * The order matters. A live response is always preferred; if it fails the app
 * says CACHED and shows the real age, and only if nothing usable exists does it
 * report ERROR. The demo works offline without ever implying stale data is live.
 */
import gpBundle from './snapshots/celestrak-gp.json';
import issBundle from './snapshots/celestrak-gp-25544.json';
import landsatBundle from './snapshots/celestrak-gp-49260.json';
import flrBundle from './snapshots/donki-flr.json';
import gstBundle from './snapshots/donki-gst.json';
import sepBundle from './snapshots/donki-sep.json';
import type { DataSnapshot, GpElements, OrbitId, SpaceWeather } from '../sim/types';
import { ORBITS, REFERENCE_NORAD_ID } from '../sim/catalogue';
import { CELESTRAK_SOURCE, celestrakGpUrl, fetchGp } from './celestrak';
import { DONKI_SOURCE, fetchWeather } from './nasaDonki';
import { buildSpaceWeather, normalizeFlares, normalizeGp, normalizeSeps, normalizeStorms } from './normalize';
import { readCache, writeCache } from './cache';

export interface EnvironmentBundle {
  /** The default orbit's element set (Sentinel-2A); kept for the badges and briefing. */
  gp: DataSnapshot<GpElements>;
  /** One real element set per selectable orbit. */
  orbits: Record<OrbitId, DataSnapshot<GpElements>>;
  weather: DataSnapshot<SpaceWeather>;
  loadedAtUtc: string;
}

interface Envelope {
  fetchedAtUtc: string;
  sourceUrl: string;
  payload: unknown;
}

/** Cached entries are re-checked: storage can hold an old format or a hand-edited value. */
function isGpElements(value: unknown, noradId: number): value is GpElements {
  const gp = value as GpElements | null;
  return (
    typeof gp === 'object' &&
    gp !== null &&
    typeof gp.objectName === 'string' &&
    typeof gp.epochUtc === 'string' &&
    Number.isFinite(Date.parse(gp.epochUtc)) &&
    gp.noradId === noradId &&
    gp.meanMotionRevPerDay > 0 &&
    gp.eccentricity >= 0 &&
    gp.eccentricity < 1 &&
    [gp.inclinationDeg, gp.raanDeg, gp.argPerigeeDeg, gp.meanAnomalyDeg, gp.bstar].every(Number.isFinite)
  );
}

function isSpaceWeather(value: unknown): value is SpaceWeather {
  const weather = value as SpaceWeather | null;
  return (
    typeof weather === 'object' &&
    weather !== null &&
    Array.isArray(weather.flares) &&
    weather.flares.every((flare) => typeof flare?.classType === 'string' && typeof flare.beginUtc === 'string') &&
    Array.isArray(weather.storms) &&
    weather.storms.every((storm) => Number.isFinite(storm?.maxKp) && typeof storm.startUtc === 'string') &&
    Array.isArray(weather.seps) &&
    typeof weather.windowStartUtc === 'string' &&
    typeof weather.windowEndUtc === 'string'
  );
}

/**
 * Polite polling. CelesTrak refreshes elements every 2 hours and answers 403 to
 * clients that re-download sooner; DEMO_KEY allows about 30 DONKI calls an hour.
 * A recent good copy is reused instead of fetched, and labelled as stored.
 */
const GP_REUSE_SEC = 2 * 3600;
const WEATHER_REUSE_SEC = 3600;

function ageSec(fetchedAtUtc: string): number {
  return (Date.now() - Date.parse(fetchedAtUtc)) / 1000;
}

/** The default orbit keeps its original cache key so existing caches stay valid. */
const gpCacheKey = (noradId: number) => (noradId === REFERENCE_NORAD_ID ? GP_CACHE_KEY : `${GP_CACHE_KEY}-${noradId}`);

const GP_BUNDLES: Record<number, Envelope> = {
  40697: gpBundle as Envelope,
  25544: issBundle as Envelope,
  49260: landsatBundle as Envelope,
};

function storedGp(noradId: number) {
  const stored = readCache<unknown>(gpCacheKey(noradId));
  return stored && isGpElements(stored.payload, noradId) ? { fetchedAtUtc: stored.fetchedAtUtc, sourceUrl: stored.sourceUrl, payload: stored.payload } : null;
}

function storedWeather() {
  const stored = readCache<unknown>(WEATHER_CACHE_KEY);
  return stored && isSpaceWeather(stored.payload) ? { fetchedAtUtc: stored.fetchedAtUtc, sourceUrl: stored.sourceUrl, payload: stored.payload } : null;
}

const GP_CACHE_KEY = 'celestrak-gp';
const WEATHER_CACHE_KEY = 'donki-weather';

function snapshot<T>(
  status: DataSnapshot<T>['status'],
  sourceName: string,
  sourceUrl: string,
  fetchedAtUtc: string,
  payload: T | null,
  error?: string,
): DataSnapshot<T> {
  const ageSeconds = Math.max(0, Math.round((Date.now() - Date.parse(fetchedAtUtc)) / 1000));
  return { status, sourceName, sourceUrl, fetchedAtUtc, ageSeconds, payload, error };
}

function bundledGp(noradId: number): { fetchedAtUtc: string; sourceUrl: string; payload: GpElements } | null {
  const envelope = GP_BUNDLES[noradId];
  if (!envelope) return null;
  try {
    return {
      fetchedAtUtc: envelope.fetchedAtUtc,
      sourceUrl: envelope.sourceUrl,
      payload: normalizeGp(envelope.payload, noradId),
    };
  } catch {
    return null;
  }
}

function bundledWeather(): { fetchedAtUtc: string; sourceUrl: string; payload: SpaceWeather } | null {
  const [gst, sep, flr] = [gstBundle, sepBundle, flrBundle] as Envelope[];
  try {
    return {
      fetchedAtUtc: gst.fetchedAtUtc,
      sourceUrl: gst.sourceUrl,
      payload: buildSpaceWeather({
        flares: flr.payload ? normalizeFlares(flr.payload) : [],
        storms: gst.payload ? normalizeStorms(gst.payload) : [],
        seps: sep.payload ? normalizeSeps(sep.payload) : [],
        windowStartUtc: `${gst.fetchedAtUtc.slice(0, 10)}T00:00:00.000Z`,
        windowEndUtc: gst.fetchedAtUtc,
      }),
    };
  } catch {
    return null;
  }
}

function newerOf<T>(
  a: { fetchedAtUtc: string; payload: T; sourceUrl: string } | null,
  b: { fetchedAtUtc: string; payload: T; sourceUrl: string } | null,
): { fetchedAtUtc: string; payload: T; sourceUrl: string } | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a.fetchedAtUtc) >= Date.parse(b.fetchedAtUtc) ? a : b;
}

async function loadGp(noradId: number): Promise<DataSnapshot<GpElements>> {
  const url = celestrakGpUrl(noradId);
  const recent = storedGp(noradId);
  if (recent && ageSec(recent.fetchedAtUtc) < GP_REUSE_SEC) {
    return snapshot('cached', CELESTRAK_SOURCE, recent.sourceUrl, recent.fetchedAtUtc, recent.payload, 'Reusing the live copy from under 2 hours ago. CelesTrak updates every 2 hours and blocks faster re-downloads.');
  }
  try {
    const elements = await fetchGp(noradId);
    if (elements.noradId !== noradId) throw new Error(`CelesTrak returned NORAD ${elements.noradId}, not ${noradId}`);
    const fetchedAtUtc = new Date().toISOString();
    writeCache<GpElements>(gpCacheKey(noradId), { fetchedAtUtc, sourceUrl: url, payload: elements });
    return snapshot('live', CELESTRAK_SOURCE, url, fetchedAtUtc, elements);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const chosen = newerOf(storedGp(noradId), bundledGp(noradId));
    if (chosen) {
      return snapshot('cached', CELESTRAK_SOURCE, chosen.sourceUrl, chosen.fetchedAtUtc, chosen.payload, `Live fetch failed (${reason}). Using a stored snapshot.`);
    }
    return snapshot<GpElements>('error', CELESTRAK_SOURCE, url, new Date(0).toISOString(), null, `Live fetch failed (${reason}) and no snapshot is available.`);
  }
}

async function loadWeather(): Promise<DataSnapshot<SpaceWeather>> {
  const apiKey = import.meta.env.VITE_NASA_API_KEY ?? 'DEMO_KEY';
  const recent = storedWeather();
  if (recent && ageSec(recent.fetchedAtUtc) < WEATHER_REUSE_SEC) {
    return snapshot('cached', DONKI_SOURCE, recent.sourceUrl, recent.fetchedAtUtc, recent.payload, 'Reusing the live copy from under an hour ago, to stay inside the NASA API rate limit.');
  }
  try {
    const result = await fetchWeather(apiKey);
    const fetchedAtUtc = new Date().toISOString();
    const sourceUrl = `https://api.nasa.gov/DONKI (FLR, GST, SEP)`;
    writeCache<SpaceWeather>(WEATHER_CACHE_KEY, { fetchedAtUtc, sourceUrl, payload: result.weather });
    return snapshot(
      'live',
      DONKI_SOURCE,
      sourceUrl,
      fetchedAtUtc,
      result.weather,
      result.failed.length > 0 ? `Partial: ${result.failed.join(', ')} did not respond.` : undefined,
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const chosen = newerOf(storedWeather(), bundledWeather());
    if (chosen) {
      return snapshot('cached', DONKI_SOURCE, chosen.sourceUrl, chosen.fetchedAtUtc, chosen.payload, `Live fetch failed (${reason}). Using a stored snapshot.`);
    }
    return snapshot<SpaceWeather>('error', DONKI_SOURCE, 'https://api.nasa.gov/DONKI', new Date(0).toISOString(), null, `Live fetch failed (${reason}) and no snapshot is available.`);
  }
}

let inFlight: Promise<EnvironmentBundle> | null = null;

/** Loads once per page load; repeated callers share the same promise. */
export function loadEnvironment(): Promise<EnvironmentBundle> {
  if (!inFlight) {
    inFlight = Promise.all([Promise.all(ORBITS.map((orbit) => loadGp(orbit.noradId))), loadWeather()]).then(([gps, weather]) => {
      const orbits = Object.fromEntries(ORBITS.map((orbit, i) => [orbit.id, gps[i]])) as Record<OrbitId, DataSnapshot<GpElements>>;
      return { gp: orbits[ORBITS[0].id], orbits, weather, loadedAtUtc: new Date().toISOString() };
    });
  }
  return inFlight;
}

/** Drops the memoised promise so a manual retry actually hits the network again. */
export function resetEnvironment(): void {
  inFlight = null;
}

/** Text lines used by the briefing and the debrief. Never claims stale data is live. */
export function provenanceLines(bundle: EnvironmentBundle, orbit?: OrbitId): string[] {
  const lines: string[] = [];
  const gp = (orbit && bundle.orbits?.[orbit]) || bundle.gp;
  lines.push(
    gp.payload
      ? `${CELESTRAK_SOURCE}: ${gp.payload.objectName} (NORAD ${gp.payload.noradId}), element epoch ${gp.payload.epochUtc}. Snapshot ${gp.status.toUpperCase()}, fetched ${gp.fetchedAtUtc}.`
      : `${CELESTRAK_SOURCE}: unavailable.`,
  );
  const weather = bundle.weather;
  lines.push(
    weather.payload
      ? `${DONKI_SOURCE}: ${weather.payload.flares.length} flare(s), ${weather.payload.storms.length} storm(s), ${weather.payload.seps.length} SEP event(s) in the ${weather.payload.windowStartUtc.slice(0, 10)} to ${weather.payload.windowEndUtc.slice(0, 10)} window. Snapshot ${weather.status.toUpperCase()}, fetched ${weather.fetchedAtUtc}.`
      : `${DONKI_SOURCE}: unavailable.`,
  );
  return lines;
}
