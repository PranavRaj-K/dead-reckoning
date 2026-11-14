import { afterEach, describe, expect, it, vi } from 'vitest';
import flrBundle from '../data/snapshots/donki-flr.json';
import gpBundle from '../data/snapshots/celestrak-gp.json';
import gstBundle from '../data/snapshots/donki-gst.json';
import sepBundle from '../data/snapshots/donki-sep.json';
import {
  buildSpaceWeather,
  normalizeFlares,
  normalizeGp,
  normalizeSeps,
  normalizeStorms,
  toUtcIso,
} from '../data/normalize';
import { donkiUrl } from '../data/nasaDonki';
import { celestrakGpUrl } from '../data/celestrak';
import { loadEnvironment, provenanceLines, resetEnvironment } from '../data/loadEnvironment';
import { REFERENCE_NORAD_ID } from '../sim/catalogue';

interface Envelope {
  payload: unknown;
}

const gpPayload = (gpBundle as Envelope).payload;

afterEach(() => {
  vi.unstubAllGlobals();
  resetEnvironment();
});

describe('timestamp normalisation', () => {
  it('treats a zone-less CelesTrak epoch as UTC', () => {
    expect(toUtcIso('2026-11-14T11:51:46.523808', 'EPOCH')).toBe('2026-11-14T11:51:46.523Z');
  });

  it('keeps explicit offsets', () => {
    expect(toUtcIso('2026-11-14T11:51:46Z', 'EPOCH')).toBe('2026-11-14T11:51:46.000Z');
    expect(toUtcIso('2026-11-14T13:51:46+02:00', 'EPOCH')).toBe('2026-11-14T11:51:46.000Z');
  });

  it('rejects unparseable timestamps', () => {
    expect(() => toUtcIso('not a date', 'EPOCH')).toThrow(/unparseable/);
  });
});

describe('CelesTrak GP normalisation', () => {
  it('extracts the fields the simulation needs', () => {
    const elements = normalizeGp(gpPayload, REFERENCE_NORAD_ID);
    expect(elements.objectName).toBe('SENTINEL-2A');
    expect(elements.noradId).toBe(REFERENCE_NORAD_ID);
    expect(elements.epochUtc).toMatch(/Z$/);
    expect(elements.meanMotionRevPerDay).toBeGreaterThan(14);
    expect(elements.eccentricity).toBeGreaterThanOrEqual(0);
    expect(elements.eccentricity).toBeLessThan(1);
    expect(elements.inclinationDeg).toBeGreaterThan(97);
  });

  it('accepts a bare object as well as an array', () => {
    const record = (gpPayload as Record<string, unknown>[])[0];
    expect(normalizeGp(record, REFERENCE_NORAD_ID).objectName).toBe('SENTINEL-2A');
  });

  it('selects the matching NORAD id from a multi-record response', () => {
    const record = (gpPayload as Record<string, unknown>[])[0];
    const other = { ...record, NORAD_CAT_ID: 25544, OBJECT_NAME: 'ISS' };
    expect(normalizeGp([other, record], REFERENCE_NORAD_ID).objectName).toBe('SENTINEL-2A');
  });

  it('fails loudly on malformed payloads instead of guessing', () => {
    expect(() => normalizeGp([], REFERENCE_NORAD_ID)).toThrow(/empty/);
    const record = (gpPayload as Record<string, unknown>[])[0];
    expect(() => normalizeGp({ ...record, MEAN_MOTION: 'x' }, REFERENCE_NORAD_ID)).toThrow(/finite number/);
    expect(() => normalizeGp({ ...record, ECCENTRICITY: 1 }, REFERENCE_NORAD_ID)).toThrow(/eccentricity/);
    expect(() => normalizeGp({ ...record, MEAN_MOTION: -1 }, REFERENCE_NORAD_ID)).toThrow(/mean motion/);
    expect(() => normalizeGp({ ...record, OBJECT_NAME: '  ' }, REFERENCE_NORAD_ID)).toThrow(/non-empty string/);
  });
});

describe('DONKI normalisation', () => {
  it('maps storm records to their peak Kp', () => {
    const storms = normalizeStorms((gstBundle as Envelope).payload);
    expect(storms.length).toBeGreaterThan(0);
    expect(storms[0].startUtc).toMatch(/Z$/);
    expect(Math.max(...storms.map((storm) => storm.maxKp))).toBeGreaterThanOrEqual(5);
  });

  it('uses zero Kp when a storm carries no index entries', () => {
    const storms = normalizeStorms([
      { gstID: 'gst-1', startTime: '2026-10-31T18:00Z' },
      { gstID: 'gst-2', startTime: '2026-10-31T18:00Z', allKpIndex: [{ kpIndex: 3 }, { kpIndex: 7 }] },
    ]);
    expect(storms[0].maxKp).toBe(0);
    expect(storms[1].maxKp).toBe(7);
  });

  it('maps SEP records and tolerates the empty bundled window', () => {
    const seps = normalizeSeps((sepBundle as Envelope).payload);
    expect(Array.isArray(seps)).toBe(true);
    for (const sep of seps) expect(sep.eventUtc).toMatch(/Z$/);
  });

  it('keeps the missing FLR payload as a real, empty result', () => {
    expect((flrBundle as Envelope).payload).toBeNull();
  });

  it('rejects a non-array payload', () => {
    expect(() => normalizeStorms({})).toThrow(/expected an array/);
    expect(() => normalizeFlares(null)).toThrow(/expected an array/);
  });

  it('builds a weather window without inventing records', () => {
    const weather = buildSpaceWeather({
      flares: [],
      storms: [],
      seps: [],
      windowStartUtc: '2026-10-15T00:00:00.000Z',
      windowEndUtc: '2026-11-14T23:59:59.999Z',
    });
    expect(weather.flares).toEqual([]);
    expect(weather.storms).toEqual([]);
    expect(weather.seps).toEqual([]);
  });
});

describe('endpoint construction', () => {
  it('asks CelesTrak for OMM JSON by catalogue number', () => {
    expect(celestrakGpUrl(REFERENCE_NORAD_ID)).toContain(`CATNR=${REFERENCE_NORAD_ID}`);
    expect(celestrakGpUrl(REFERENCE_NORAD_ID)).toContain('FORMAT=json');
  });

  it('encodes the DONKI date range and key', () => {
    const url = donkiUrl('GST', '2026-10-15', '2026-11-14', 'DEMO_KEY');
    expect(url).toContain('/DONKI/GST?');
    expect(url).toContain('startDate=2026-10-15');
    expect(url).toContain('api_key=DEMO_KEY');
  });
});

describe('environment loading', () => {
  it('reports LIVE when both sources answer', async () => {
    vi.stubGlobal('fetch', (input: string) => {
      const url = String(input);
      if (url.includes('gp.php')) return Promise.resolve(response(gpPayload));
      if (url.includes('/FLR?')) return Promise.reject(new Error('HTTP 404'));
      if (url.includes('/GST?')) return Promise.resolve(response((gstBundle as Envelope).payload));
      if (url.includes('/SEP?')) return Promise.resolve(response((sepBundle as Envelope).payload));
      return Promise.reject(new Error(`unexpected url ${url}`));
    });

    const bundle = await loadEnvironment();
    expect(bundle.gp.status).toBe('live');
    expect(bundle.gp.payload?.objectName).toBe('SENTINEL-2A');
    expect(bundle.weather.status).toBe('live');
    expect(bundle.weather.error).toContain('FLR');
    expect(bundle.weather.payload?.storms.length).toBeGreaterThan(0);
  });

  it('falls back to the bundled snapshot when the network is down', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
    const bundle = await loadEnvironment();
    expect(bundle.gp.status).toBe('cached');
    expect(bundle.gp.error).toContain('Using a stored snapshot');
    expect(bundle.gp.payload?.noradId).toBe(REFERENCE_NORAD_ID);
    expect(bundle.weather.status).toBe('cached');
    expect(bundle.weather.payload).not.toBeNull();

    const lines = provenanceLines(bundle);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('CACHED');
    expect(lines[0]).toContain('SENTINEL-2A');
    expect(lines[1]).toContain('DONKI');
  });

  it('memoises one load per page and resets on demand', async () => {
    const fetchMock = vi.fn((input: string) => {
      const url = String(input);
      if (url.includes('gp.php')) return Promise.resolve(response(gpPayload));
      return Promise.reject(new Error('HTTP 404'));
    });
    vi.stubGlobal('fetch', fetchMock);

    const first = await loadEnvironment();
    const second = await loadEnvironment();
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(4);

    resetEnvironment();
    await loadEnvironment();
    expect(fetchMock).toHaveBeenCalledTimes(8);
  });

  it('describes unavailable sources without pretending they are live', async () => {
    const lines = provenanceLines({
      gp: {
        status: 'error',
        sourceName: 'CelesTrak',
        sourceUrl: 'x',
        fetchedAtUtc: new Date(0).toISOString(),
        ageSeconds: 0,
        payload: null,
        error: 'offline',
      },
      weather: {
        status: 'error',
        sourceName: 'NASA DONKI',
        sourceUrl: 'x',
        fetchedAtUtc: new Date(0).toISOString(),
        ageSeconds: 0,
        payload: null,
        error: 'offline',
      },
      loadedAtUtc: new Date(0).toISOString(),
    });
    expect(lines.every((line) => line.includes('unavailable'))).toBe(true);
  });
});

function response(payload: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(payload),
  };
}
