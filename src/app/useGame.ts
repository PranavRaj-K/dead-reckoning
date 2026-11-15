/**
 * The only stateful part of the app: screen routing, the build form, and the
 * mission clock. The simulation itself stays pure; this hook just feeds it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { COMPONENTS, DEFAULT_DESIGN, PRESETS, SCENARIO, SLOT_ORDER, scenarioFor } from '../sim/catalogue';
import {
  TICK_SEC,
  advanceMission,
  createMission,
  resolveSalvage,
  setSceneSkipped,
} from '../sim/mission';
import { computeBudgets, validateDesign } from '../sim/resources';
import { PERFECT_RUN, isPerfectDesign } from '../sim/perfect';
import { evaluateMission } from '../sim/scoring';
import { createSatrec, dateAt, estimateSunlight, orbitalPeriodMinutes } from '../sim/orbit';
import {
  loadEnvironment,
  provenanceLines,
  resetEnvironment,
  type EnvironmentBundle,
} from '../data/loadEnvironment';
import type {
  Budgets,
  Design,
  DesignSlot,
  MissionResult,
  MissionState,
  RunRecord,
  Screen,
  Validation,
} from '../sim/types';

const RUNS_KEY = 'dead-reckoning:v1:runs';
/** Real milliseconds per simulation tick. */
const TICK_MS = 100;
export const SPEEDS = [60, 300, 900] as const;
export const DEFAULT_SEED = 20261115;

const KNOWN_PARTS = new Set(COMPONENTS.map((part) => part.id));

/** Storage is outside our control: drop any saved run the debrief could not render. */
export function isRunRecord(value: unknown): value is RunRecord {
  const run = value as RunRecord | null;
  return (
    typeof run === 'object' &&
    run !== null &&
    typeof run.seed === 'number' &&
    typeof run.finishedAtUtc === 'string' &&
    typeof run.design?.ids === 'object' &&
    SLOT_ORDER.every((slot) => KNOWN_PARTS.has(run.design.ids[slot])) &&
    typeof run.result?.grade === 'string' &&
    typeof run.result.status === 'string' &&
    [run.result.score, run.result.scienceDelivered, run.result.dataDeliveredMb].every(Number.isFinite)
  );
}

function readRuns(): RunRecord[] {
  try {
    const raw = window.localStorage.getItem(RUNS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRunRecord) : [];
  } catch {
    return [];
  }
}

function writeRuns(runs: RunRecord[]): void {
  try {
    window.localStorage.setItem(RUNS_KEY, JSON.stringify(runs));
  } catch {
    // Private mode or a full quota: saving is a convenience, not a requirement.
  }
}

export function useGame() {
  const [env, setEnv] = useState<EnvironmentBundle | null>(null);
  const [envError, setEnvError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>('briefing');
  const [design, setDesign] = useState<Design>(DEFAULT_DESIGN);
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [mission, setMission] = useState<MissionState | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<number>(SPEEDS[1]);
  const [runs, setRuns] = useState<RunRecord[]>(readRuns);
  // Up to four players share one screen; see sim/crew.ts for who owns what.
  const [crew, setCrew] = useState<string[]>(['Player 1']);
  const alive = useRef(true);
  const recorded = useRef(false);

  const load = useCallback(() => {
    loadEnvironment()
      .then((bundle) => {
        if (alive.current) setEnv(bundle);
      })
      .catch((error: unknown) => {
        if (alive.current) setEnvError(error instanceof Error ? error.message : String(error));
      });
  }, []);

  useEffect(() => {
    alive.current = true;
    load();
    return () => {
      alive.current = false;
    };
  }, [load]);

  /** Sunlight fraction comes from the real propagated orbit, not an assumption. */
  const orbitData = env?.orbits[design.mission.orbit] ?? null;
  // The Grade S plan flies its own fixed element set; everything else flies the loaded one.
  const reference = isPerfectDesign(design, seed) ? PERFECT_RUN.reference : (orbitData?.payload ?? null);
  const geometry = useMemo(() => {
    const elements = reference;
    if (!elements) return null;
    try {
      const satrec = createSatrec(elements);
      return estimateSunlight(
        satrec,
        dateAt(elements.epochUtc, 0),
        orbitalPeriodMinutes(elements),
      );
    } catch {
      return null;
    }
  }, [reference]);

  const budgets: Budgets | null = useMemo(() => {
    if (!geometry) return null;
    return computeBudgets({ design, scenario: SCENARIO, ...geometry });
  }, [design, geometry]);

  const validation: Validation | null = useMemo(
    () => (budgets ? validateDesign(design, budgets) : null),
    [budgets, design],
  );

  const setSlot = useCallback((slot: DesignSlot, id: string) => {
    setDesign((prev) => ({ ...prev, ids: { ...prev.ids, [slot]: id } }));
  }, []);

  // Presets swap the hardware; the mission (objective, orbit, launch) stays the player's.
  const choosePreset = useCallback((id: string) => {
    const preset = PRESETS.find((entry) => entry.id === id);
    if (preset) setDesign((prev) => ({ ...preset.design, mission: prev.mission }));
  }, []);

  const setMissionChoice = useCallback((patch: Partial<Design['mission']>) => {
    setDesign((prev) => ({ ...prev, mission: { ...prev.mission, ...patch } }));
  }, []);

  const launch = useCallback(() => {
    const gp = reference;
    const weather = env?.weather.payload;
    if (!env || !gp || !weather || !validation?.ok) return;
    try {
      const next = createMission({
        design,
        seed,
        reference: gp,
        weather,
        scenario: scenarioFor(design.mission),
        provenance: provenanceLines(env, design.mission.orbit),
      });
      recorded.current = false;
      setMission(next);
      setPaused(false);
      setScreen('operate');
    } catch (error) {
      setEnvError(error instanceof Error ? error.message : String(error));
    }
  }, [design, env, reference, seed, validation]);

  const restart = useCallback(() => {
    launch();
  }, [launch]);

  const salvage = useCallback((actionId: string) => {
    setMission((prev) => (prev ? resolveSalvage(prev, actionId) : prev));
  }, []);

  const skipScene = useCallback((sceneId: string, skipped: boolean) => {
    setMission((prev) => (prev ? setSceneSkipped(prev, sceneId, skipped) : prev));
  }, []);

  const retry = useCallback(() => {
    resetEnvironment();
    setEnv(null);
    setEnvError(null);
    load();
  }, [load]);

  // Mission clock. The effect only re-arms when the run stops, restarts or the
  // speed changes, so ticking state does not rebuild the interval every frame.
  const running = mission?.status === 'running';
  useEffect(() => {
    if (!running || paused) return;
    const timer = window.setInterval(() => {
      setMission((prev) =>
        prev ? advanceMission(prev, (speed * TICK_MS) / 1000) : prev,
      );
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [running, paused, speed]);

  const result: MissionResult | null = useMemo(
    () =>
      mission && (mission.status === 'complete' || mission.status === 'failed')
        ? evaluateMission(mission)
        : null,
    [mission],
  );

  // Persist the finished run once, then hand the player to the debrief.
  const finished = mission?.status === 'complete' || mission?.status === 'failed';
  useEffect(() => {
    if (!mission || !finished || recorded.current) return;
    recorded.current = true;
    const record: RunRecord = {
      seed: mission.seed,
      finishedAtUtc: new Date().toISOString(),
      design: mission.design,
      budgets: mission.budgets,
      result: evaluateMission(mission),
      epochUtc: mission.epochUtc,
    };
    setRuns((prev) => {
      const next = [record, ...prev].slice(0, 8);
      writeRuns(next);
      return next;
    });
    const timer = window.setTimeout(() => {
      setScreen((current) => (current === 'operate' ? 'debrief' : current));
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [finished, mission]);

  /** Loads the Grade S design and seed, then opens the workbench with the plan explained. */
  const loadPerfect = useCallback(() => {
    setDesign(PERFECT_RUN.design);
    setSeed(PERFECT_RUN.seed);
    setScreen('build');
  }, []);

  const clearRuns = useCallback(() => {
    setRuns([]);
    writeRuns([]);
  }, []);

  return {
    env,
    envError,
    loading: !env && !envError,
    screen,
    go: setScreen,
    design,
    setSlot,
    choosePreset,
    setDesign,
    setMissionChoice,
    crew,
    setCrew,
    orbitData,
    seed,
    setSeed,
    budgets,
    validation,
    geometry,
    mission,
    result,
    runs,
    clearRuns,
    loadPerfect,
    paused,
    setPaused,
    speed,
    setSpeed,
    launch,
    restart,
    salvage,
    skipScene,
    retry,
    tickSec: TICK_SEC,
  };
}

export type GameApi = ReturnType<typeof useGame>;
