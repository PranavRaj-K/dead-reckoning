/**
 * Post-mission advice. Reads what actually happened in the recorded run and turns
 * the biggest losses into concrete next moves, each one a single design change the
 * player can apply in one click. Every suggested design is re-budgeted and
 * re-validated so the card can say up front whether it still launches.
 */
import { SCENARIO, componentById, componentsForSlot } from './catalogue';
import { computeBudgets, validateDesign } from './resources';
import type { ComponentSpec, Design, DesignSlot, MissionResult, MissionState } from './types';

export interface AdviceChange {
  /** What changes, in the player's words: "S-band Transmitter → X-band Transmitter". */
  label: string;
  design: Design;
  massDeltaKg: number;
  costDeltaUsd: number;
  launchable: boolean;
  /** First blocking issue when the change alone does not launch. */
  blocker: string | null;
}

export interface Advice {
  id: string;
  title: string;
  /** Why, quoting numbers from this run. */
  why: string;
  change: AdviceChange | null;
}

const MAX_ADVICE = 4;

/** Next part in the slot that improves `score` (higher is better), or null at the top. */
function nextBetter(design: Design, slot: DesignSlot, score: (spec: ComponentSpec) => number): ComponentSpec | null {
  const current = componentById(design.ids[slot]);
  const better = componentsForSlot(slot)
    .filter((spec) => score(spec) > score(current))
    .sort((a, b) => score(a) - score(b));
  return better[0] ?? null;
}

function preview(mission: MissionState, label: string, design: Design): AdviceChange {
  const budgets = computeBudgets({
    design,
    scenario: SCENARIO,
    sunlitFraction: mission.budgets.sunlitFraction,
    eclipseMinutes: mission.budgets.eclipseMinutes,
  });
  const validation = validateDesign(design, budgets);
  return {
    label,
    design,
    massDeltaKg: Math.round((budgets.massKg - mission.budgets.massKg) * 100) / 100,
    costDeltaUsd: budgets.costUsd - mission.budgets.costUsd,
    launchable: validation.ok,
    blocker: validation.issues.find((issue) => issue.severity === 'error')?.message ?? null,
  };
}

function swap(mission: MissionState, slot: DesignSlot, to: ComponentSpec): AdviceChange {
  const from = componentById(mission.design.ids[slot]);
  return preview(mission, `${from.name} → ${to.name}`, { ...mission.design, ids: { ...mission.design.ids, [slot]: to.id } });
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function adviseNextRun(mission: MissionState, result: MissionResult): Advice[] {
  const advice: Advice[] = [];
  const { design } = mission;
  const decision = (faultId: string) => mission.salvage.find((entry) => entry.faultId === faultId);
  const radio = decision('radio-failure');
  const adcs = decision('adcs-degradation');
  const shedScenes = mission.scenes.filter((scene) => scene.shed).length;
  const offPointing = mission.scenes.filter((scene) => scene.note?.includes('pointing spec')).length;

  // Lost the radio with nothing to fall back on.
  if (radio && !design.beacon && (radio.outcome === 'risk-failed' || radio.outcome === 'ended-mission')) {
    advice.push({
      id: 'beacon',
      title: 'Carry a backup beacon',
      why:
        radio.outcome === 'risk-failed'
          ? 'The 45% radio reset failed and there was no second transmitter, so nothing more came down after the fault.'
          : 'With no second transmitter, ending the mission was the only way out of the radio failure.',
      change: preview(mission, 'Add the 0.4 kbps backup beacon', { ...design, beacon: true }),
    });
  }

  // Ran out of power.
  if (mission.status === 'failed' || shedScenes > 0) {
    const battery = nextBetter(design, 'battery', (spec) => spec.capacityWh ?? 0);
    const power = nextBetter(design, 'power', (spec) => spec.generationW ?? 0);
    advice.push({
      id: 'power',
      title: mission.status === 'failed' ? 'Do not run the battery flat' : 'Keep the camera powered',
      why:
        mission.status === 'failed'
          ? (mission.failureReason ?? 'The battery ran empty for too long and the spacecraft was lost.')
          : `The camera lost power during ${plural(shedScenes, 'imaging window')}; those scenes scored minimum quality.`,
      change: battery ? swap(mission, 'battery', battery) : power ? swap(mission, 'power', power) : null,
    });
  }

  // Imagery overwritten before it could come down.
  if (result.scenesLost > 0) {
    const bus = nextBetter(design, 'bus', (spec) => spec.storageMb ?? 0);
    const radioPart = nextBetter(design, 'radio', (spec) => spec.downlinkKbps ?? 0);
    advice.push({
      id: 'recorder',
      title: 'Stop losing scenes to a full recorder',
      why: `${plural(result.scenesLost, 'scene')} overwritten in the ${mission.budgets.storageMb} MB recorder before a pass could bring ${result.scenesLost === 1 ? 'it' : 'them'} down.`,
      change: bus ? swap(mission, 'bus', bus) : radioPart ? swap(mission, 'radio', radioPart) : null,
    });
  }

  // Not enough data reached the ground (and a full recorder is not already the explanation).
  if (result.dataDeliveredMb < result.dataTargetMb && result.scenesLost === 0) {
    const radioPart = nextBetter(design, 'radio', (spec) => spec.downlinkKbps ?? 0);
    const antenna = nextBetter(design, 'antenna', (spec) => spec.gainFactor ?? 0);
    advice.push({
      id: 'downlink',
      title: 'Move more data per pass',
      why: `${round1(result.dataDeliveredMb)} of ${result.dataTargetMb} MB reached the ground; ${round1(result.dataGeneratedMb)} MB was captured.`,
      change: radioPart ? swap(mission, 'radio', radioPart) : antenna ? swap(mission, 'antenna', antenna) : null,
    });
  }

  // Imagery captured outside the instrument's pointing limit.
  if (offPointing > 0) {
    const better = nextBetter(design, 'adcs', (spec) => -(spec.pointingAccuracyDeg ?? 99));
    advice.push({
      id: 'pointing',
      title: 'Point inside the camera’s limit',
      why:
        adcs?.actionId === 'accept-degraded'
          ? `${plural(offPointing, 'scene')} came out at half science after accepting degraded pointing. Magnetorquer mode or skipping three scenes would have kept the rest in spec.`
          : `${plural(offPointing, 'scene')} came out at half science because pointing missed the instrument limit.`,
      change: better ? swap(mission, 'adcs', better) : null,
    });
  }

  // Data arrived but was not worth much.
  if (result.dataDeliveredMb >= result.dataTargetMb && result.scienceDelivered < result.scienceTarget) {
    const instrument = nextBetter(design, 'instrument', (spec) => spec.scienceValue ?? 0);
    advice.push({
      id: 'science',
      title: 'Carry a more valuable instrument',
      why: `The data target was met, but it held only ${round1(result.scienceDelivered)} of ${result.scienceTarget} science points.`,
      change: instrument ? swap(mission, 'instrument', instrument) : null,
    });
  }

  if (advice.length === 0) {
    const success = result.status === 'SUCCESS';
    advice.push({
      id: 'clean',
      title: success ? 'Clean run. Now make it leaner.' : 'No single part stands out',
      why: success
        ? `Both targets met with ${round1(mission.budgets.massMarginKg)} kg of mass margin left. Try a thinner risk posture and see if it still holds.`
        : 'Losses were spread across the run. Fly again on the same seed and try a different recovery at the first fault.',
      change:
        success && design.riskPosture !== 'aggressive'
          ? preview(mission, 'Switch to the aggressive risk posture', { ...design, riskPosture: 'aggressive' })
          : null,
    });
  }

  return advice.slice(0, MAX_ADVICE);
}
