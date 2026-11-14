/**
 * Orbital geometry.
 *
 * Real SGP4 propagation (satellite.js) of public CelesTrak GP/OMM elements.
 * The player's spacecraft is fictional, but its environmental geometry - sunlight,
 * eclipse, ground-station visibility, ground track - is propagated from a real
 * reference object's element set. The UI states this explicitly.
 *
 * Frames: TEME/ECI from SGP4, geodetic and look angles via GMST rotation.
 * Solar position uses satellite.js's low-precision solar ephemeris (good to a few
 * arcminutes over this century - far below the fidelity of the rest of the model).
 */
import {
  degreesLat,
  degreesLong,
  eciToEcf,
  eciToGeodetic,
  ecfToLookAngles,
  gstime,
  jday,
  json2satrec,
  propagate,
  radiansLat,
  radiansLong,
  radiansToDegrees,
  shadowFraction,
  sunPos,
} from 'satellite.js';
import type { EciVec3, OMMJsonObject, SatRec } from 'satellite.js';
import type { ContactWindow, GpElements, OrbitState, Station } from './types';

const EARTH_RADIUS_KM = 6371;
/** Penumbra midpoint: below this shadow fraction the arrays are treated as lit. */
export const SUNLIGHT_SHADOW_THRESHOLD = 0.5;

export function createSatrec(elements: GpElements): SatRec {
  const omm: OMMJsonObject = {
    OBJECT_NAME: elements.objectName,
    OBJECT_ID: elements.objectId,
    EPOCH: elements.epochUtc,
    MEAN_MOTION: elements.meanMotionRevPerDay,
    ECCENTRICITY: elements.eccentricity,
    INCLINATION: elements.inclinationDeg,
    RA_OF_ASC_NODE: elements.raanDeg,
    ARG_OF_PERICENTER: elements.argPerigeeDeg,
    MEAN_ANOMALY: elements.meanAnomalyDeg,
    EPHEMERIS_TYPE: 0,
    CLASSIFICATION_TYPE: 'U',
    NORAD_CAT_ID: elements.noradId,
    ELEMENT_SET_NO: 999,
    REV_AT_EPOCH: 0,
    BSTAR: elements.bstar,
    MEAN_MOTION_DOT: 0,
    MEAN_MOTION_DDOT: 0,
  };
  return json2satrec(omm);
}

export function orbitalPeriodMinutes(elements: GpElements): number {
  return 1440 / elements.meanMotionRevPerDay;
}

/** Mission time (seconds from epoch) to a UTC Date. */
export function dateAt(epochUtc: string, tSec: number): Date {
  return new Date(Date.parse(epochUtc) + tSec * 1000);
}

export function sunUnitEci(date: Date): EciVec3<number> {
  const { rsun } = sunPos(jday(date));
  const magnitude = Math.hypot(rsun.x, rsun.y, rsun.z) || 1;
  return { x: rsun.x / magnitude, y: rsun.y / magnitude, z: rsun.z / magnitude };
}

export function orbitStateAt(satrec: SatRec, date: Date): OrbitState | null {
  const pv = propagate(satrec, date);
  if (!pv || !Number.isFinite(pv.position.x)) return null;

  const gmst = gstime(date);
  const geodetic = eciToGeodetic(pv.position, gmst);
  const { rsun } = sunPos(jday(date));
  const shadow = shadowFraction(rsun, pv.position);
  const sun = sunUnitEci(date);
  const radius = Math.hypot(pv.position.x, pv.position.y, pv.position.z);

  return {
    latDeg: round(degreesLat(geodetic.latitude), 3),
    lonDeg: round(degreesLong(geodetic.longitude), 3),
    altitudeKm: round(geodetic.height, 1),
    speedKmPerSec: round(Math.hypot(pv.velocity.x, pv.velocity.y, pv.velocity.z), 3),
    shadowFraction: round(shadow, 3),
    inSunlight: shadow < SUNLIGHT_SHADOW_THRESHOLD,
    eciAngleRad: Math.atan2(pv.position.y, pv.position.x),
    sunAngleRad: Math.atan2(sun.y, sun.x),
    radiusEarthRadii: round(radius / EARTH_RADIUS_KM, 4),
  };
}

/**
 * Fraction of one orbital period spent in sunlight, sampled from the real
 * propagated geometry rather than assumed.
 */
export function estimateSunlight(
  satrec: SatRec,
  start: Date,
  periodMinutes: number,
  samples = 72,
): { sunlitFraction: number; eclipseMinutes: number } {
  let lit = 0;
  let valid = 0;
  for (let i = 0; i < samples; i += 1) {
    const date = new Date(start.getTime() + (i / samples) * periodMinutes * 60_000);
    const pv = propagate(satrec, date);
    if (!pv) continue;
    const { rsun } = sunPos(jday(date));
    const shadow = shadowFraction(rsun, pv.position);
    valid += 1;
    if (shadow < SUNLIGHT_SHADOW_THRESHOLD) lit += 1;
  }
  const sunlitFraction = valid > 0 ? lit / valid : 0.65;
  return {
    sunlitFraction: round(sunlitFraction, 3),
    eclipseMinutes: round((1 - sunlitFraction) * periodMinutes, 1),
  };
}

export function elevationDegAt(satrec: SatRec, date: Date, station: Station): number | null {
  const pv = propagate(satrec, date);
  if (!pv) return null;
  const gmst = gstime(date);
  const satEcf = eciToEcf(pv.position, gmst);
  const observer = {
    latitude: radiansLat(station.latDeg),
    longitude: radiansLong(station.lonDeg),
    height: station.altitudeKm,
  };
  const look = ecfToLookAngles(observer, satEcf);
  return radiansToDegrees(look.elevation);
}

/**
 * Ground-station contact windows above a minimum elevation.
 * This is a simplified visibility model: refraction, terrain masks and link
 * budget are not modelled, and the stations are reference coordinates only.
 */
export function findContactWindows(
  satrec: SatRec,
  start: Date,
  durationSec: number,
  stations: Station[],
  stepSec = 20,
  minElevationDeg = 5,
): ContactWindow[] {
  const windows: ContactWindow[] = [];
  const samples = Math.ceil(durationSec / stepSec);

  for (const station of stations) {
    let open: { startSec: number; peakDeg: number } | null = null;
    for (let i = 0; i <= samples; i += 1) {
      const tSec = Math.min(i * stepSec, durationSec);
      const date = new Date(start.getTime() + tSec * 1000);
      const elevation = elevationDegAt(satrec, date, station);
      if (elevation === null) continue;

      if (elevation >= minElevationDeg) {
        if (!open) open = { startSec: tSec, peakDeg: elevation };
        else open.peakDeg = Math.max(open.peakDeg, elevation);
      } else if (open) {
        windows.push(makeWindow(station, open.startSec, tSec, open.peakDeg));
        open = null;
      }
    }
    if (open) windows.push(makeWindow(station, open.startSec, durationSec, open.peakDeg));
  }

  return windows.sort((a, b) => a.startSec - b.startSec);
}

function makeWindow(station: Station, startSec: number, endSec: number, peakDeg: number): ContactWindow {
  const peak = Math.max(0, peakDeg);
  return {
    id: `${station.id}-${startSec}`,
    stationId: station.id,
    stationName: station.name,
    startSec,
    endSec,
    peakElevationDeg: round(peak, 1),
    // Simplified elevation-driven link quality: better geometry, better link.
    linkQuality: round(0.55 + 0.45 * Math.sin((peak * Math.PI) / 180), 3),
  };
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
