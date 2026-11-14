/**
 * Shared fixtures for the test suite.
 *
 * The orbital reference and space-weather snapshot are the same real CelesTrak /
 * DONKI payloads the app bundles, so tests exercise the shipped data path rather
 * than a hand-written ideal case.
 */
import flrBundle from '../data/snapshots/donki-flr.json';
import gpBundle from '../data/snapshots/celestrak-gp.json';
import gstBundle from '../data/snapshots/donki-gst.json';
import sepBundle from '../data/snapshots/donki-sep.json';
import { buildSpaceWeather, normalizeFlares, normalizeGp, normalizeSeps, normalizeStorms } from '../data/normalize';
import { DEFAULT_DESIGN, REFERENCE_NORAD_ID, SCENARIO } from '../sim/catalogue';
import { createMission, advanceMission, resolveSalvage } from '../sim/mission';
import { getRecoveryActions } from '../sim/salvage';
import type { Design, GpElements, MissionState, SpaceWeather } from '../sim/types';

interface Envelope {
  payload: unknown;
}

export const reference: GpElements = normalizeGp((gpBundle as Envelope).payload, REFERENCE_NORAD_ID);

export const bundledWeather: SpaceWeather = buildSpaceWeather({
  flares: (flrBundle as Envelope).payload ? normalizeFlares((flrBundle as Envelope).payload) : [],
  storms: (gstBundle as Envelope).payload ? normalizeStorms((gstBundle as Envelope).payload) : [],
  seps: (sepBundle as Envelope).payload ? normalizeSeps((sepBundle as Envelope).payload) : [],
  windowStartUtc: '2026-10-15T00:00:00.000Z',
  windowEndUtc: '2026-11-14T23:59:59.999Z',
});

/** Quiet window: no flares, no storms, no SEPs. Used where weather must not vary. */
export const calmWeather: SpaceWeather = buildSpaceWeather({
  flares: [],
  storms: [],
  seps: [],
  windowStartUtc: '2026-10-15T00:00:00.000Z',
  windowEndUtc: '2026-11-14T23:59:59.999Z',
});

export function launch(design: Design = DEFAULT_DESIGN, seed = 20_261_115, weather = calmWeather): MissionState {
  return createMission({
    design,
    seed,
    reference,
    weather,
    scenario: SCENARIO,
    provenance: ['test fixture'],
  });
}

export interface PlayOptions {
  /** Overrides the default "first available, non-destructive action" policy. */
  chooseAction?: (state: MissionState) => string | null;
  stepSec?: number;
}

/**
 * Plays a mission to its terminal state, resolving every salvage prompt with the
 * first available action that does not end the mission early.
 */
export function playThrough(design: Design, seed: number, options: PlayOptions = {}): MissionState {
  const stepSec = options.stepSec ?? 60;
  let state = launch(design, seed);
  let guard = 0;

  while (state.status !== 'complete' && state.status !== 'failed' && guard < 5000) {
    guard += 1;
    if (state.status === 'awaiting-salvage' && state.activeFault) {
      const actions = getRecoveryActions(state, state.activeFault);
      const available = actions.filter((action) => !action.unavailableReason);
      const chosenId =
        options.chooseAction?.(state) ?? available.find((action) => !action.endsMission)?.id ?? available[0]?.id;
      if (!chosenId) throw new Error(`No salvage action available for ${state.activeFault}`);
      state = resolveSalvage(state, chosenId);
      continue;
    }
    state = advanceMission(state, stepSec);
  }

  if (guard >= 5000) throw new Error('Mission did not terminate');
  return state;
}
