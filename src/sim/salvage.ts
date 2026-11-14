/**
 * Faults and salvage.
 *
 * Each action states its trade-off before the player commits, and every
 * hardware precondition is checked against the actual design. The point of the
 * game is that recovery is a sequence of constrained choices, not a repair button.
 */
import type { FaultId, MissionState, RecoveryAction } from './types';

export interface FaultCopy {
  id: FaultId;
  title: string;
  shortTitle: string;
  /** What the player can observe happening. */
  symptoms: string[];
  /** Which earlier decision caused it. */
  causeHint: string;
}

export const FAULTS: Record<FaultId, FaultCopy> = {
  'radio-failure': {
    id: 'radio-failure',
    title: 'Main radio failure',
    shortTitle: 'Radio lost',
    symptoms: [
      'Downlink rate fell to zero during a scheduled pass.',
      'Stored imagery keeps growing in the recorder.',
      'No telemetry acknowledgement from the ground station.',
    ],
    causeHint:
      'Radio power draw and pass scheduling determine how hard the transmitter and its thermal path are worked. A design with no backup beacon has no low-rate fallback.',
  },
  'adcs-degradation': {
    id: 'adcs-degradation',
    title: 'Attitude-control degradation',
    shortTitle: 'ADCS degraded',
    symptoms: [
      'Pointing error started climbing between scenes.',
      'Imagery is being captured outside the instrument’s rated pointing.',
      'Attitude correction activity is unusually high.',
    ],
    causeHint:
      'Reaction wheels wear out. Designs that rely on fine pointing for high-resolution imagery have more to lose when the wheels degrade than a coarse, tolerant payload.',
  },
  'battery-degradation': {
    id: 'battery-degradation',
    title: 'Battery capacity loss',
    shortTitle: 'Battery degraded',
    symptoms: [
      'Usable capacity dropped to about 60% of rated.',
      'Maximum discharge power is limited, so the instrument is being shed at night.',
      'Eclipse recovery takes longer than planned.',
    ],
    causeHint:
      'Battery size, eclipse loads and how much spare generation the design carries decide how much a capacity loss actually hurts.',
  },
};

export const RADIO_RESET_SUCCESS_CHANCE = 0.45;

/** Pending observation windows, in time order. */
export function upcomingScenes(state: MissionState, count: number) {
  return state.scenes.filter((scene) => scene.status === 'pending').slice(0, count);
}

export function getRecoveryActions(state: MissionState, faultId: FaultId): RecoveryAction[] {
  switch (faultId) {
    case 'radio-failure': {
      const resetAttempted = state.salvage.some((entry) => entry.actionId === 'radio-reset');
      return [
        {
          id: 'switch-beacon',
          label: 'Switch to backup beacon',
          description: 'Power the 0.4 kbps omni beacon and keep the mission alive at a trickle of data.',
          tradeoff: 'Mission continues, but downlink is far too slow to clear the image backlog.',
          unavailableReason: state.design.beacon
            ? undefined
            : 'This design carries no backup beacon. There is no secondary transmitter to switch to.',
        },
        {
          id: 'radio-reset',
          label: 'Attempt a radio reset',
          description: 'Cycle the transmitter and hope the fault is a latch-up rather than failed hardware.',
          tradeoff: `${Math.round(RADIO_RESET_SUCCESS_CHANCE * 100)}% chance the radio comes back. If it fails, there is no downlink at all.`,
          risk: {
            successChance: RADIO_RESET_SUCCESS_CHANCE,
            successText: 'Radio recovered. Full downlink rate restored.',
            failureText: 'Radio did not respond. The transmitter is dead.',
          },
          unavailableReason: resetAttempted ? 'A reset was already attempted; the transmitter did not respond.' : undefined,
        },
        {
          id: 'cease-ops',
          label: 'End the mission',
          description: 'Stop operating and accept the data already delivered.',
          tradeoff: 'No further science is delivered. Useful for preserving the debrief of a failed design.',
          endsMission: true,
        },
      ];
    }
    case 'adcs-degradation': {
      return [
        {
          id: 'magnetic-mode',
          label: 'Switch to magnetorquer mode',
          description: 'Drop to the coarse magnetic control mode carried on every ADCS option.',
          tradeoff: 'Pointing falls to 2.5°, so only wide-field instruments stay inside spec. Power draw drops.',
          unavailableReason: state.adcsMode === 'magnetic' ? 'Already running in magnetorquer mode.' : undefined,
        },
        {
          id: 'accept-degraded',
          label: 'Accept degraded pointing',
          description: 'Keep the wheels running with the degraded control law.',
          tradeoff: 'Pointing error grows by about 1.2°. Science quality drops but no observations are skipped.',
        },
        {
          id: 'trim-schedule',
          label: 'Skip the next three scenes',
          description: 'Reduce attitude activity and give the control system time to settle.',
          tradeoff: 'Three scenes are lost, but pointing recovers closer to nominal for the rest of the mission.',
          unavailableReason:
            upcomingScenes(state, 3).length < 3 ? 'Fewer than three observation windows remain.' : undefined,
        },
      ];
    }
    case 'battery-degradation': {
      return [
        {
          id: 'sun-safe',
          label: 'Sun-safe the next two scenes',
          description: 'Skip the next two observations to let the battery recover through a full sunlight arc.',
          tradeoff: 'Two scenes are lost. The remaining mission runs with a healthier state of charge.',
          unavailableReason:
            upcomingScenes(state, 2).length < 2 ? 'Fewer than two observation windows remain.' : undefined,
        },
        {
          id: 'accept-degraded',
          label: 'Shed loads and continue',
          description: 'Keep observing and let the discharge limit drop the instrument automatically at night.',
          tradeoff: 'Scene capture continues, but night-side observations may be shed without warning.',
        },
      ];
    }
  }
}

export function faultCopy(id: FaultId): FaultCopy {
  return FAULTS[id];
}
