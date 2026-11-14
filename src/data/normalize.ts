/**
 * Validation and normalisation of public API payloads.
 *
 * Raw responses never reach the simulation. Only the fields the game needs are
 * extracted, and anything malformed fails loudly with a readable message so the
 * UI can show a genuine ERROR state instead of half-real data.
 */
import type { FlareRecord, GpElements, SepRecord, SpaceWeather, StormRecord } from '../sim/types';

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label}: expected an object`);
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label}: expected an array`);
  return value;
}

function asNumber(value: unknown, label: string): number {
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed)) {
    throw new Error(`${label}: expected a finite number, received ${JSON.stringify(value)}`);
  }
  return parsed;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label}: expected a non-empty string`);
  }
  return value;
}

/** ISO-8601 UTC. CelesTrak omits the trailing Z on EPOCH, so normalise it. */
export function toUtcIso(value: string, label: string): string {
  const trimmed = value.trim();
  const hasZone = /(z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  const date = new Date(hasZone ? trimmed : `${trimmed}Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`${label}: unparseable timestamp ${JSON.stringify(value)}`);
  return date.toISOString();
}

/**
 * CelesTrak GP in OMM JSON. Accepts an array (gp.php) or a single object and
 * picks the record matching `noradId` when several are present.
 */
export function normalizeGp(payload: unknown, noradId: number): GpElements {
  const records = Array.isArray(payload) ? payload : [payload];
  if (records.length === 0) throw new Error('CelesTrak: empty element set response');

  let chosen: Record<string, unknown> | null = null;
  for (const raw of records) {
    const record = asRecord(raw, 'CelesTrak record');
    const id = asNumber(record.NORAD_CAT_ID, 'CelesTrak NORAD_CAT_ID');
    if (id === noradId) {
      chosen = record;
      break;
    }
    if (!chosen) chosen = record;
  }
  if (!chosen) throw new Error(`CelesTrak: no record for NORAD ${noradId}`);

  const elements: GpElements = {
    objectName: asString(chosen.OBJECT_NAME, 'CelesTrak OBJECT_NAME'),
    objectId: typeof chosen.OBJECT_ID === 'string' ? chosen.OBJECT_ID : '',
    noradId: asNumber(chosen.NORAD_CAT_ID, 'CelesTrak NORAD_CAT_ID'),
    epochUtc: toUtcIso(asString(chosen.EPOCH, 'CelesTrak EPOCH'), 'CelesTrak EPOCH'),
    meanMotionRevPerDay: asNumber(chosen.MEAN_MOTION, 'CelesTrak MEAN_MOTION'),
    eccentricity: asNumber(chosen.ECCENTRICITY, 'CelesTrak ECCENTRICITY'),
    inclinationDeg: asNumber(chosen.INCLINATION, 'CelesTrak INCLINATION'),
    raanDeg: asNumber(chosen.RA_OF_ASC_NODE, 'CelesTrak RA_OF_ASC_NODE'),
    argPerigeeDeg: asNumber(chosen.ARG_OF_PERICENTER, 'CelesTrak ARG_OF_PERICENTER'),
    meanAnomalyDeg: asNumber(chosen.MEAN_ANOMALY, 'CelesTrak MEAN_ANOMALY'),
    bstar: asNumber(chosen.BSTAR, 'CelesTrak BSTAR'),
  };

  if (elements.eccentricity < 0 || elements.eccentricity >= 1) {
    throw new Error(`CelesTrak: eccentricity ${elements.eccentricity} is outside [0, 1)`);
  }
  if (elements.meanMotionRevPerDay <= 0) {
    throw new Error('CelesTrak: mean motion must be positive');
  }
  return elements;
}

export function normalizeFlares(payload: unknown): FlareRecord[] {
  return asArray(payload, 'DONKI FLR').map((raw, i) => {
    const record = asRecord(raw, `DONKI FLR[${i}]`);
    return {
      id: asString(record.flrID, 'DONKI flrID'),
      beginUtc: toUtcIso(asString(record.beginTime, 'DONKI beginTime'), 'DONKI beginTime'),
      classType: asString(record.classType, 'DONKI classType'),
      strength: 0,
    };
  });
}

export function normalizeStorms(payload: unknown): StormRecord[] {
  return asArray(payload, 'DONKI GST').map((raw, i) => {
    const record = asRecord(raw, `DONKI GST[${i}]`);
    const kpEntries = Array.isArray(record.allKpIndex) ? record.allKpIndex : [];
    const kpValues = kpEntries
      .map((entry) => asRecord(entry, 'DONKI allKpIndex entry'))
      .map((entry) => entry.kpIndex)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    return {
      id: asString(record.gstID, 'DONKI gstID'),
      startUtc: toUtcIso(asString(record.startTime, 'DONKI startTime'), 'DONKI startTime'),
      maxKp: kpValues.length > 0 ? Math.max(...kpValues) : 0,
    };
  });
}

export function normalizeSeps(payload: unknown): SepRecord[] {
  return asArray(payload, 'DONKI SEP').map((raw, i) => {
    const record = asRecord(raw, `DONKI SEP[${i}]`);
    return {
      id: asString(record.sepID, 'DONKI sepID'),
      eventUtc: toUtcIso(asString(record.eventTime, 'DONKI eventTime'), 'DONKI eventTime'),
      protonFlux: null,
    };
  });
}

export function buildSpaceWeather(input: {
  flares: FlareRecord[];
  storms: StormRecord[];
  seps: SepRecord[];
  windowStartUtc: string;
  windowEndUtc: string;
}): SpaceWeather {
  return { ...input };
}
