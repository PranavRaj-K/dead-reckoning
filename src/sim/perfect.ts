/**
 * The Grade S plan: the highest-scoring design and recovery sequence for the
 * shipped scenario and default seed, found by simulating every launchable design
 * (1,140) against every recovery combination. A test replays it to keep the
 * score and grade honest if the model changes.
 */
import { SCENARIO } from './catalogue';
import type { Design, DesignSlot, FaultId, MissionState } from './types';

/** Same value as DEFAULT_SEED in app/useGame.ts (kept literal to avoid an import cycle). */
const SEED = 20_261_115;

const DESIGN: Design = {
  ids: {
    instrument: 'cam-ms',
    adcs: 'adcs-rw',
    radio: 'radio-sband',
    antenna: 'ant-dipole',
    power: 'power-3u-hi',
    battery: 'batt-16',
    bus: 'bus-3u-hd',
  },
  beacon: false,
  riskPosture: 'balanced',
};

const PARTS: Record<DesignSlot, string> = {
  instrument:
    'Twelve scenes at 8 points each is 96 science against a target of 50, so this camera already maxes the science score. The high-resolution imager adds 0.44 kg and $13,000 for points the score caps anyway.',
  adcs: 'Reaction wheels hold 0.35°, far inside the camera’s 2° limit, and stay inside it even after the wheels degrade. The star tracker would add mass for accuracy nothing here needs.',
  radio:
    'S-band moves well over the 60 MB data target in the predicted passes. X-band would draw 7.4 W during every pass and cost twice as much for data the score cannot use.',
  antenna:
    'The dipole works at any attitude and weighs 0.06 kg. With S-band behind it the downlink still clears the target, and the saved mass goes straight into the resource score.',
  power:
    'Deployable arrays give 13 W peak. The surplus keeps the energy margin full, refills the small battery every orbit and leaves headroom when the battery degrades.',
  battery:
    'With strong arrays, 16 Wh covers each eclipse with reserve. A bigger pack would only add mass, and mass margin is a third of the resource score.',
  bus: 'The machined bus is 0.24 kg lighter than aluminium and carries a 96 MB recorder, so no scene is overwritten before a pass.',
};

const FLIGHT: Record<FaultId, { actionId: string; label: string; why: string }> = {
  'radio-failure': {
    actionId: 'radio-reset',
    label: 'Attempt a radio reset',
    why: 'The reset is a seeded 45% roll, and on this seed it succeeds, bringing the full-rate radio back. Same seed, same outcome, every time. On a different seed this is a gamble; the beacon is the safe play.',
  },
  'adcs-degradation': {
    actionId: 'accept-degraded',
    label: 'Accept degraded pointing',
    why: 'Degraded wheels add 1.2°, giving about 1.6°. That is still inside the multispectral camera’s 2° limit, so no scene loses science and no power is spent recovering.',
  },
  'battery-degradation': {
    actionId: 'accept-degraded',
    label: 'Shed loads and continue',
    why: 'The deployable arrays recharge the reduced pack every orbit, so a sun-safe pause would only throw away two imaging windows. Keep flying and let the load limiter do its job.',
  },
};

export const PERFECT_RUN = {
  seed: SEED,
  score: 96.5,
  design: DESIGN,
  parts: PARTS,
  extras: {
    beacon:
      'Left off to save 0.05 kg, which is worth a fraction of a point. That only works because the radio reset succeeds on this seed. On any other seed, carry the beacon and switch to it.',
    posture:
      'Posture changes only the launch checks, never the physics. Balanced passes with this design, so there is nothing to gain from changing it.',
  },
  flight: FLIGHT,
  faultTimes: Object.fromEntries(SCENARIO.faults.map((fault) => [fault.id, fault.atSec])) as Record<FaultId, number>,
};

export function isPerfectDesign(design: Design, seed: number): boolean {
  return (
    seed === SEED &&
    design.beacon === DESIGN.beacon &&
    design.riskPosture === DESIGN.riskPosture &&
    (Object.keys(DESIGN.ids) as DesignSlot[]).every((slot) => design.ids[slot] === DESIGN.ids[slot])
  );
}

export function isPerfectRun(mission: MissionState): boolean {
  return isPerfectDesign(mission.design, mission.seed);
}
