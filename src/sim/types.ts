/**
 * Core domain types for Dead Reckoning.
 *
 * Units are carried in the field names (kg, W, Wh, Mb, kbps, deg, s).
 * All game-facing numbers are educational assumptions, not flight predictions.
 * See docs/ASSUMPTIONS.md and the in-app "What is real, what is modelled" panel.
 */

export type Screen = 'briefing' | 'build' | 'operate' | 'debrief';

/** How much margin the player chooses to carry against an uncertain environment. */
export type RiskPosture = 'conservative' | 'balanced' | 'aggressive';

export type DesignSlot =
  | 'bus'
  | 'power'
  | 'battery'
  | 'radio'
  | 'antenna'
  | 'adcs'
  | 'instrument';

export interface ComponentSpec {
  id: string;
  slot: DesignSlot;
  name: string;
  summary: string;
  massKg: number;
  costUsd: number;
  /** Nominal electrical draw while active. 0 for passive structure/power parts. */
  powerW: number;
  /** bus */
  storageMb?: number;
  inertiaFactor?: number;
  /** power */
  generationW?: number;
  /** battery */
  capacityWh?: number;
  /** radio */
  downlinkKbps?: number;
  /** antenna */
  gainFactor?: number;
  requiresPointingDeg?: number;
  /** adcs */
  pointingAccuracyDeg?: number;
  /** instrument */
  dataMbPerScene?: number;
  scienceValue?: number;
  maxPointingDeg?: number;
  tags?: string[];
}

export interface Design {
  ids: Record<DesignSlot, string>;
  /** Optional low-rate backup beacon: enables one salvage path after radio loss. */
  beacon: boolean;
  riskPosture: RiskPosture;
}

export interface Budgets {
  massKg: number;
  massLimitKg: number;
  massMarginKg: number;
  costUsd: number;
  costLimitUsd: number;
  costMarginUsd: number;
  /** Peak generation with the panel at its nominal orientation, W. */
  generationW: number;
  /** Mission-average electrical load, W. */
  avgLoadW: number;
  /** generationW * sunlitFraction * PANEL_LOSS - avgLoadW, W. */
  energyMarginW: number;
  energyMarginRatio: number;
  sunlitFraction: number;
  eclipseMinutes: number;
  batteryCapacityWh: number;
  batteryUsableWh: number;
  eclipseEnergyNeedWh: number;
  storageMb: number;
  /** Effective downlink with the antenna gain applied, before link quality. */
  downlinkKbps: number;
  pointingAccuracyDeg: number;
  /** Antenna gain after the pointing requirement is applied. */
  effectiveGain: number;
  sceneDataMb: number;
  totalSceneDataMb: number;
  sciencePotential: number;
}

export type IssueSeverity = 'error' | 'warning';

export interface BudgetIssue {
  id: string;
  severity: IssueSeverity;
  message: string;
}

export interface Validation {
  ok: boolean;
  issues: BudgetIssue[];
}

export interface GpElements {
  objectName: string;
  objectId: string;
  noradId: number;
  epochUtc: string;
  meanMotionRevPerDay: number;
  eccentricity: number;
  inclinationDeg: number;
  raanDeg: number;
  argPerigeeDeg: number;
  meanAnomalyDeg: number;
  bstar: number;
}

export type FetchStatus = 'live' | 'cached' | 'error';

export interface DataSnapshot<T> {
  status: FetchStatus;
  sourceName: string;
  sourceUrl: string;
  fetchedAtUtc: string;
  /** Age of the snapshot relative to app load, seconds. */
  ageSeconds: number;
  payload: T | null;
  error?: string;
}

export interface FlareRecord {
  id: string;
  beginUtc: string;
  classType: string;
  /** X=5, M=4, C=3, B=2, A=1 */
  strength: number;
}

export interface StormRecord {
  id: string;
  startUtc: string;
  maxKp: number;
}

export interface SepRecord {
  id: string;
  eventUtc: string;
  protonFlux: number | null;
}

export interface SpaceWeather {
  flares: FlareRecord[];
  storms: StormRecord[];
  seps: SepRecord[];
  windowStartUtc: string;
  windowEndUtc: string;
}

export interface WeatherModifiers {
  /** 0..1 radiation environment index used for instrument noise. */
  radiationNoise: number;
  /** Extra W deducted from solar generation. */
  powerPenaltyW: number;
  /** Extra pointing error, deg. */
  pointingPenaltyDeg: number;
  /** Plain-language derivation shown in the UI and the debrief. */
  notes: string[];
}

export interface Station {
  id: string;
  name: string;
  latDeg: number;
  lonDeg: number;
  altitudeKm: number;
}

export interface SceneWindow {
  id: string;
  index: number;
  startSec: number;
  endSec: number;
  label: string;
}

export interface ContactWindow {
  id: string;
  stationId: string;
  stationName: string;
  startSec: number;
  endSec: number;
  peakElevationDeg: number;
  /** Simplified link-quality factor derived from peak elevation. */
  linkQuality: number;
}

export interface OrbitState {
  latDeg: number;
  lonDeg: number;
  altitudeKm: number;
  speedKmPerSec: number;
  shadowFraction: number;
  inSunlight: boolean;
  /** ECI XY-plane angle of the spacecraft, radians. Schematic view only. */
  eciAngleRad: number;
  /** ECI XY-plane angle of the Sun, radians. Schematic view only. */
  sunAngleRad: number;
  /** Geocentric radius in Earth radii. */
  radiusEarthRadii: number;
}

export type FaultId = 'radio-failure' | 'adcs-degradation' | 'battery-degradation';

export interface FaultSchedule {
  id: FaultId;
  atSec: number;
}

export type FaultStatus = 'pending' | 'active' | 'mitigated' | 'lost';

export interface FaultInstance {
  id: FaultId;
  atSec: number;
  appliedAtSec: number | null;
  status: FaultStatus;
  resolvedBy: string | null;
  note: string | null;
}

export interface RecoveryAction {
  id: string;
  label: string;
  description: string;
  /** Consequence shown before the player commits. */
  tradeoff: string;
  /** null when available, otherwise the reason it is blocked. */
  unavailableReason?: string;
  risk?: {
    /** 0..1 chance the attempt succeeds, resolved from the mission seed. */
    successChance: number;
    successText: string;
    failureText: string;
  };
  /** Ends the mission immediately (player chooses to stop recovering). */
  endsMission?: boolean;
}

export interface SalvageDecision {
  faultId: FaultId;
  actionId: string;
  actionLabel: string;
  atSec: number;
  outcome: 'applied' | 'risk-succeeded' | 'risk-failed' | 'ended-mission';
  note: string;
}

export interface CausalEvent {
  id: string;
  t: number;
  kind: 'design' | 'environment' | 'fault' | 'action' | 'outcome' | 'warning';
  severity: 'info' | 'warning' | 'critical' | 'success';
  title: string;
  detail: string;
}

export interface TelemetrySample {
  t: number;
  batteryWh: number;
  batteryCapacityWh: number;
  powerGenW: number;
  powerLoadW: number;
  dataStoredMb: number;
  dataDeliveredMb: number;
  inSunlight: boolean;
  pointingErrorDeg: number;
  downlinkKbps: number;
}

export interface SceneRecord {
  id: string;
  index: number;
  label: string;
  status: 'pending' | 'stored' | 'skipped' | 'lost';
  quality: number;
  dataMb: number;
  scienceTotal: number;
  scienceDelivered: number;
  mbRemaining: number;
  note: string | null;
}

export type MissionStatus =
  | 'running'
  | 'paused'
  | 'awaiting-salvage'
  | 'complete'
  | 'failed';

export interface MissionState {
  seed: number;
  design: Design;
  budgets: Budgets;
  weather: WeatherModifiers;
  weatherSource: SpaceWeather;
  reference: GpElements;
  /** ISO UTC instant that mission time zero corresponds to (GP element epoch). */
  epochUtc: string;
  durationSec: number;
  scienceTarget: number;
  dataTargetMb: number;
  t: number;
  status: MissionStatus;
  failureReason: string | null;
  batteryWh: number;
  batteryCapacityWh: number;
  batteryDegraded: boolean;
  dataStoredMb: number;
  dataDeliveredMb: number;
  dataGeneratedMb: number;
  scienceCollected: number;
  scienceDelivered: number;
  powerGenW: number;
  powerLoadW: number;
  inSunlight: boolean;
  brownout: boolean;
  brownoutSec: number;
  pointingErrorDeg: number;
  adcsMode: 'nominal' | 'magnetic' | 'degraded';
  radioOperational: boolean;
  beaconActive: boolean;
  linkGainFactor: number;
  /** Human-readable provenance lines for the debrief (sources, epochs, ages). */
  provenance: string[];
  orbit: OrbitState;
  scenes: SceneRecord[];
  contacts: ContactWindow[];
  sceneWindows: SceneWindow[];
  faults: FaultInstance[];
  activeFault: FaultId | null;
  salvage: SalvageDecision[];
  causal: CausalEvent[];
  telemetry: TelemetrySample[];
  lastSampleSec: number;
  lastContactId: string | null;
  lastContactStation: string | null;
}

export interface MissionResult {
  status: 'SUCCESS' | 'PARTIAL' | 'FAILURE';
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  score: number;
  scienceDelivered: number;
  scienceTarget: number;
  scienceCollected: number;
  dataDeliveredMb: number;
  dataTargetMb: number;
  dataGeneratedMb: number;
  scenesStored: number;
  scenesLost: number;
  scenesSkipped: number;
  batteryFinalRatio: number;
  faults: FaultInstance[];
  salvage: SalvageDecision[];
  failureReason: string | null;
  components: {
    science: number;
    data: number;
    resources: number;
  };
}

export interface RunRecord {
  seed: number;
  finishedAtUtc: string;
  design: Design;
  budgets: Budgets;
  result: MissionResult;
  epochUtc: string;
}

export interface MissionScenario {
  id: string;
  title: string;
  objective: string;
  durationSec: number;
  scienceTarget: number;
  dataTargetMb: number;
  scenes: SceneWindow[];
  faults: FaultSchedule[];
  massLimitKg: number;
  costLimitUsd: number;
  stations: Station[];
}
