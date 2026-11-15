/**
 * Educational component catalogue.
 *
 * These numbers are GAME ASSUMPTIONS chosen to make trade-offs legible for a
 * 3U-class LEO Earth-observation mission. They are order-of-magnitude plausible
 * but are not manufacturer specifications and must not be used for real design.
 */
import type { ComponentSpec, Design, DesignSlot, LaunchId, MissionChoice, MissionScenario, ObjectiveId, OrbitId } from './types';

/** Imaging survey from Sentinel-2A's orbit on a rideshare: the mission the game opens with. */
export const DEFAULT_MISSION: MissionChoice = { objective: 'survey', orbit: 'sso-786', launch: 'rideshare-sso' };

export const COMPONENTS: readonly ComponentSpec[] = [
  // --- bus -----------------------------------------------------------------
  {
    id: 'bus-3u-std',
    slot: 'bus',
    name: '3U Aluminium Bus',
    summary: 'Standard 3U structure, 64 MB data recorder, generous internal volume.',
    massKg: 1.1,
    costUsd: 14_000,
    powerW: 0,
    storageMb: 64,
    inertiaFactor: 1,
    tags: ['64 MB recorder'],
  },
  {
    id: 'bus-3u-hd',
    slot: 'bus',
    name: '3U Machined Bus',
    summary: 'Lightweight machined frame with a 96 MB recorder. Costs more, saves mass.',
    massKg: 0.86,
    costUsd: 23_000,
    powerW: 0,
    storageMb: 96,
    inertiaFactor: 0.9,
    tags: ['96 MB recorder', 'mass saver'],
  },

  // --- power ---------------------------------------------------------------
  {
    id: 'power-3u',
    slot: 'power',
    name: 'Body-mounted Arrays',
    summary: '8 W peak generation. Light and cheap, but little surplus.',
    massKg: 0.34,
    costUsd: 9_000,
    powerW: 0,
    generationW: 8,
  },
  {
    id: 'power-3u-hi',
    slot: 'power',
    name: 'Deployable Arrays',
    summary: '13 W peak generation. Heavier and pricier, buys power margin.',
    massKg: 0.6,
    costUsd: 15_500,
    powerW: 0,
    generationW: 13,
    tags: ['margin'],
  },

  // --- battery -------------------------------------------------------------
  {
    id: 'batt-16',
    slot: 'battery',
    name: '16 Wh Pack',
    summary: 'Smallest pack. Adequate only for low-load designs.',
    massKg: 0.24,
    costUsd: 5_500,
    powerW: 0,
    capacityWh: 16,
  },
  {
    id: 'batt-28',
    slot: 'battery',
    name: '28 Wh Pack',
    summary: 'Balanced pack that covers eclipse loads for most designs.',
    massKg: 0.42,
    costUsd: 9_500,
    powerW: 0,
    capacityWh: 28,
  },
  {
    id: 'batt-40',
    slot: 'battery',
    name: '40 Wh Pack',
    summary: 'Large pack. Survives long eclipses and high-power passes.',
    massKg: 0.58,
    costUsd: 13_500,
    powerW: 0,
    capacityWh: 40,
    tags: ['eclipse margin'],
  },

  // --- radio ---------------------------------------------------------------
  {
    id: 'radio-uhf',
    slot: 'radio',
    name: 'UHF Transceiver',
    summary: '9.6 kbps downlink. Low power, far too slow for imagery.',
    massKg: 0.16,
    costUsd: 5_000,
    powerW: 2,
    downlinkKbps: 9.6,
  },
  {
    id: 'radio-sband',
    slot: 'radio',
    name: 'S-band Transmitter',
    summary: '1024 kbps downlink. The workhorse for small Earth-observation payloads.',
    massKg: 0.28,
    costUsd: 12_000,
    powerW: 3.6,
    downlinkKbps: 1024,
  },
  {
    id: 'radio-xband',
    slot: 'radio',
    name: 'X-band Transmitter',
    summary: '8192 kbps downlink. Drains power during every pass.',
    massKg: 0.46,
    costUsd: 25_000,
    powerW: 7.4,
    downlinkKbps: 8192,
    tags: ['high power'],
  },

  // --- antenna -------------------------------------------------------------
  {
    id: 'ant-dipole',
    slot: 'antenna',
    name: 'Deployable Dipole',
    summary: 'Omnidirectional, gain factor 0.75. Works at any attitude.',
    massKg: 0.06,
    costUsd: 1_500,
    powerW: 0,
    gainFactor: 0.75,
    requiresPointingDeg: 3,
  },
  {
    id: 'ant-patch',
    slot: 'antenna',
    name: 'Patch Array',
    summary: 'Gain factor 1.0. Needs pointing within 2.0 degrees.',
    massKg: 0.18,
    costUsd: 4_500,
    powerW: 0,
    gainFactor: 1,
    requiresPointingDeg: 2,
  },
  {
    id: 'ant-hga',
    slot: 'antenna',
    name: 'Steerable High-gain',
    summary: 'Gain factor 1.3. Needs 0.6 degree pointing or the gain collapses.',
    massKg: 0.34,
    costUsd: 9_000,
    powerW: 0,
    gainFactor: 1.3,
    requiresPointingDeg: 0.6,
    tags: ['needs fine ADCS'],
  },

  // --- attitude control ----------------------------------------------------
  {
    id: 'adcs-mag',
    slot: 'adcs',
    name: 'Magnetorquer Only',
    summary: '2.5 degree pointing. Cheap and light; coarse for imagery.',
    massKg: 0.3,
    costUsd: 6_500,
    powerW: 0.9,
    pointingAccuracyDeg: 2.5,
  },
  {
    id: 'adcs-rw',
    slot: 'adcs',
    name: 'Reaction Wheels',
    summary: '0.35 degree pointing. The usual choice for small imagers.',
    massKg: 0.66,
    costUsd: 17_000,
    powerW: 2.1,
    pointingAccuracyDeg: 0.35,
  },
  {
    id: 'adcs-rw-star',
    slot: 'adcs',
    name: 'Wheels + Star Tracker',
    summary: '0.10 degree pointing. Unlocks high-resolution imaging.',
    massKg: 0.92,
    costUsd: 28_000,
    powerW: 2.9,
    pointingAccuracyDeg: 0.1,
    tags: ['precision'],
  },

  // --- instrument ----------------------------------------------------------
  {
    id: 'cam-ms',
    slot: 'instrument',
    name: 'Multispectral Imager',
    summary: '120 m imagery. 12 MB per scene, 8 science points, tolerant of 2 degree pointing.',
    massKg: 0.42,
    costUsd: 11_000,
    powerW: 1.8,
    dataMbPerScene: 12,
    scienceValue: 8,
    maxPointingDeg: 2,
  },
  {
    id: 'cam-hr',
    slot: 'instrument',
    name: 'High-resolution Imager',
    summary: '30 m imagery. 24 MB per scene, 15 science points, needs sub-degree pointing.',
    massKg: 0.86,
    costUsd: 24_000,
    powerW: 3.2,
    dataMbPerScene: 24,
    scienceValue: 15,
    maxPointingDeg: 0.7,
    tags: ['data heavy'],
  },
  {
    id: 'sensor-therm',
    slot: 'instrument',
    name: 'Thermal Mapper',
    summary: '4 MB per scene, 5 science points. Low data, low science.',
    massKg: 0.26,
    costUsd: 7_000,
    powerW: 1,
    dataMbPerScene: 4,
    scienceValue: 5,
    maxPointingDeg: 2.2,
  },
];

export const BEACON_SPEC = {
  id: 'beacon',
  name: 'Backup Beacon',
  summary: '0.4 kbps omni beacon. Only used when the main radio fails.',
  massKg: 0.05,
  costUsd: 1_200,
  powerW: 0.6,
  downlinkKbps: 0.4,
} as const;

const index = new Map(COMPONENTS.map((component) => [component.id, component]));

export function componentById(id: string): ComponentSpec {
  const component = index.get(id);
  if (!component) throw new Error(`Unknown component id: ${id}`);
  return component;
}

export function componentsForSlot(slot: DesignSlot): ComponentSpec[] {
  return COMPONENTS.filter((component) => component.slot === slot);
}

export const SLOT_LABELS: Record<DesignSlot, string> = {
  bus: 'Structure & data recorder',
  power: 'Solar generation',
  battery: 'Battery',
  radio: 'Radio',
  antenna: 'Antenna',
  adcs: 'Attitude control',
  instrument: 'Science instrument',
};

export const SLOT_ORDER: DesignSlot[] = [
  'instrument',
  'adcs',
  'radio',
  'antenna',
  'power',
  'battery',
  'bus',
];

export function design(
  ids: Record<DesignSlot, string>,
  beacon: boolean,
  riskPosture: Design['riskPosture'],
  mission: MissionChoice = DEFAULT_MISSION,
): Design {
  return { mission, ids, beacon, riskPosture };
}

export const PRESETS: { id: string; name: string; blurb: string; design: Design }[] = [
  {
    id: 'balanced',
    name: 'Balanced',
    blurb: 'Multispectral imager, S-band, reaction wheels. The safe starting point.',
    design: design(
      {
        bus: 'bus-3u-std',
        power: 'power-3u-hi',
        battery: 'batt-28',
        radio: 'radio-sband',
        antenna: 'ant-patch',
        adcs: 'adcs-rw',
        instrument: 'cam-ms',
      },
      true,
      'balanced',
    ),
  },
  {
    id: 'science',
    name: 'Science-heavy',
    blurb: 'High-resolution imager and precision pointing. Thin margins.',
    design: design(
      {
        bus: 'bus-3u-hd',
        power: 'power-3u-hi',
        battery: 'batt-28',
        radio: 'radio-sband',
        antenna: 'ant-patch',
        adcs: 'adcs-rw',
        instrument: 'cam-hr',
      },
      true,
      'conservative',
    ),
  },
  {
    id: 'comms',
    name: 'Downlink-heavy',
    blurb: 'X-band and high-gain antenna. Power-hungry, no backup beacon.',
    design: design(
      {
        bus: 'bus-3u-std',
        power: 'power-3u-hi',
        battery: 'batt-40',
        radio: 'radio-xband',
        antenna: 'ant-hga',
        adcs: 'adcs-rw',
        instrument: 'cam-ms',
      },
      false,
      'aggressive',
    ),
  },
];

export const DEFAULT_DESIGN: Design = PRESETS[0].design;

/* -------------------------------------------------------------------------- */
/* Scenario                                                                    */
/* -------------------------------------------------------------------------- */

/** The rideshare launch's capacity: the default mission's mass limit. */
export const MASS_LIMIT_KG = 4.5;
/** Total mission budget, launch included. The default rideshare leaves $110,000 for the spacecraft. */
export const COST_LIMIT_USD = 140_000;
export const MISSION_DURATION_SEC = 6 * 3600;
export const SCENE_COUNT = 12;
export const SCENE_DURATION_SEC = 180;
export const SCIENCE_TARGET = 50;
export const DATA_TARGET_MB = 60;

/** Reference object whose real GP elements define the default mission's environment. */
export const REFERENCE_NORAD_ID = 40697; // SENTINEL-2A, sun-synchronous ~786 km

export interface OrbitOption {
  id: OrbitId;
  name: string;
  /** Real object whose element set the mission flies on. */
  reference: string;
  noradId: number;
  blurb: string;
}

export const ORBITS: OrbitOption[] = [
  {
    id: 'sso-786',
    name: 'Sun-synchronous, 786 km',
    reference: 'Sentinel-2A',
    noradId: 40697,
    blurb: 'Crosses the equator at the same local time every orbit, so lighting is steady for imaging.',
  },
  {
    id: 'sso-705',
    name: 'Sun-synchronous, 705 km',
    reference: 'Landsat 9 (NASA/USGS)',
    noradId: 49260,
    blurb: 'The Landsat orbit: a little lower and faster, with a different pass pattern over the stations.',
  },
  {
    id: 'iss-420',
    name: 'Space station orbit, 420 km, 51.6°',
    reference: 'ISS (ZARYA)',
    noradId: 25544,
    blurb: 'Cheap to reach from the station, but low, inclined and never sun-synchronous: lighting drifts.',
  },
];

export interface ObjectiveOption {
  id: ObjectiveId;
  name: string;
  blurb: string;
  scienceTarget: number;
  dataTargetMb: number;
}

export const OBJECTIVES: ObjectiveOption[] = [
  { id: 'survey', name: 'Imaging survey', blurb: 'Balanced: enough science and enough data.', scienceTarget: 50, dataTargetMb: 60 },
  { id: 'mapping', name: 'Wide-area mapping', blurb: 'Volume wins. Bring down as much imagery as the passes allow.', scienceTarget: 30, dataTargetMb: 120 },
  { id: 'precision', name: 'Precision science', blurb: 'Fewer bytes, sharper scenes. Science value is everything.', scienceTarget: 90, dataTargetMb: 40 },
];

export interface LaunchOption {
  id: LaunchId;
  name: string;
  blurb: string;
  costUsd: number;
  /** Mass the vehicle or dispenser will accept. */
  massCapacityKg: number;
  orbits: OrbitId[];
}

export const LAUNCHES: LaunchOption[] = [
  {
    id: 'rideshare-sso',
    name: 'Rideshare to sun-synchronous',
    blurb: 'Share a ride with a bigger payload. Cheap, but you go where it goes.',
    costUsd: 30_000,
    massCapacityKg: 4.5,
    orbits: ['sso-786', 'sso-705'],
  },
  {
    id: 'iss-deploy',
    name: 'Deploy from the space station',
    blurb: 'Ride up with cargo and get pushed out of an airlock dispenser. Cheapest and lightest.',
    costUsd: 20_000,
    massCapacityKg: 4.0,
    orbits: ['iss-420'],
  },
  {
    id: 'dedicated',
    name: 'Dedicated small launcher',
    blurb: 'Your own rocket: any orbit and more mass, at the highest price.',
    costUsd: 45_000,
    massCapacityKg: 6.0,
    orbits: ['sso-786', 'sso-705', 'iss-420'],
  },
];

export const orbitById = (id: OrbitId) => ORBITS.find((orbit) => orbit.id === id) ?? ORBITS[0];
export const objectiveById = (id: ObjectiveId) => OBJECTIVES.find((objective) => objective.id === id) ?? OBJECTIVES[0];
export const launchById = (id: LaunchId) => LAUNCHES.find((launch) => launch.id === id) ?? LAUNCHES[0];

/** The shared scenario with this mission's targets. */
export function scenarioFor(mission: MissionChoice): MissionScenario {
  const objective = objectiveById(mission.objective);
  return { ...SCENARIO, scienceTarget: objective.scienceTarget, dataTargetMb: objective.dataTargetMb };
}

export const STATIONS = [
  { id: 'gs-wallops', name: 'Wallops (reference site)', latDeg: 37.94, lonDeg: -75.46, altitudeKm: 0.012 },
  { id: 'gs-goldstone', name: 'Goldstone (reference site)', latDeg: 35.43, lonDeg: -116.89, altitudeKm: 1.0 },
  { id: 'gs-canberra', name: 'Canberra (reference site)', latDeg: -35.4, lonDeg: 148.98, altitudeKm: 0.6 },
];

function buildSceneWindows(): MissionScenario['scenes'] {
  return Array.from({ length: SCENE_COUNT }, (_, i) => {
    const startSec = 300 + i * 1500;
    return {
      id: `scene-${i + 1}`,
      index: i,
      startSec,
      endSec: startSec + SCENE_DURATION_SEC,
      label: `Scene ${i + 1}`,
    };
  });
}

export const SCENARIO: MissionScenario = {
  id: 'leo-intro',
  title: 'Dead Reckoning — LEO Earth Observation',
  objective:
    'Image 12 target sites over six hours, store the imagery, and downlink enough science data through the ground-station passes to make the mission worth flying.',
  durationSec: MISSION_DURATION_SEC,
  scienceTarget: SCIENCE_TARGET,
  dataTargetMb: DATA_TARGET_MB,
  scenes: buildSceneWindows(),
  faults: [
    { id: 'radio-failure', atSec: 6_480 },
    { id: 'adcs-degradation', atSec: 11_880 },
    { id: 'battery-degradation', atSec: 16_848 },
  ],
  massLimitKg: MASS_LIMIT_KG,
  costLimitUsd: COST_LIMIT_USD,
  stations: STATIONS,
};
