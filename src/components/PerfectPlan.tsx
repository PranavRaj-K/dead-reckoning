import { useState } from 'react';
import { SLOT_LABELS, SLOT_ORDER, componentById, launchById } from '../sim/catalogue';
import { PERFECT_RUN } from '../sim/perfect';
import { FAULTS } from '../sim/salvage';
import { clock } from '../lib/format';
import type { DesignSlot, FaultId } from '../sim/types';

type Extra = 'launch' | 'beacon' | 'posture';
type Pick = { kind: 'part'; slot: DesignSlot } | { kind: 'extra'; key: Extra } | { kind: 'fault'; id: FaultId };

const extraLabel = (key: Extra, design: typeof PERFECT_RUN.design) =>
  key === 'launch' ? launchById(design.mission.launch).name : key === 'beacon' ? (design.beacon ? 'Backup beacon' : 'No beacon') : `${design.riskPosture} posture`;

/**
 * The Grade S plan, explained. Every choice is a button; the one you pick shows
 * what was chosen and why it beats the alternatives on this orbit and seed.
 */
export function PerfectPlan() {
  const [pick, setPick] = useState<Pick>({ kind: 'part', slot: 'instrument' });
  const { design, parts, extras, flight, faultTimes } = PERFECT_RUN;

  const detail =
    pick.kind === 'part'
      ? { title: `${SLOT_LABELS[pick.slot]}: ${componentById(design.ids[pick.slot]).name}`, why: parts[pick.slot] }
      : pick.kind === 'extra'
        ? {
            title: pick.key === 'launch' ? `Launch: ${extraLabel('launch', design)}` : pick.key === 'beacon' ? (design.beacon ? 'Backup beacon: fitted' : 'Backup beacon: left off') : `Risk posture: ${design.riskPosture}`,
            why: extras[pick.key],
          }
        : { title: `T+${clock(faultTimes[pick.id])} ${FAULTS[pick.id].title}: ${flight[pick.id].label}`, why: flight[pick.id].why };

  const isPicked = (candidate: Pick) => JSON.stringify(candidate) === JSON.stringify(pick);

  return (
    <section className="perfect-plan" aria-label="Grade S plan">
      <header>
        <strong>The Grade S plan</strong>
        <span className="dim small">
          Scores {PERFECT_RUN.score} on seed {PERFECT_RUN.seed}. Tap any choice to see why.
        </span>
      </header>

      <div className="perfect-group">
        <span className="perfect-label">Build</span>
        <div className="perfect-chips">
          {SLOT_ORDER.map((slot) => (
            <button key={slot} type="button" className={isPicked({ kind: 'part', slot }) ? 'is-open' : ''} onClick={() => setPick({ kind: 'part', slot })}>
              {componentById(design.ids[slot]).name}
            </button>
          ))}
          {(['launch', 'beacon', 'posture'] as const).map((key) => (
            <button key={key} type="button" className={isPicked({ kind: 'extra', key }) ? 'is-open' : ''} onClick={() => setPick({ kind: 'extra', key })}>
              {extraLabel(key, design)}
            </button>
          ))}
        </div>
      </div>

      <div className="perfect-group">
        <span className="perfect-label">Fly</span>
        <div className="perfect-chips">
          {(Object.keys(flight) as FaultId[]).map((id) => (
            <button key={id} type="button" className={isPicked({ kind: 'fault', id }) ? 'is-open' : ''} onClick={() => setPick({ kind: 'fault', id })}>
              {FAULTS[id].shortTitle}: {flight[id].label}
            </button>
          ))}
        </div>
      </div>

      <div className="perfect-detail" aria-live="polite">
        <strong>{detail.title}</strong>
        <p>{detail.why}</p>
      </div>
      <p className="dim small">Launch it. Each fault dialog marks the Grade S move and explains it.</p>
    </section>
  );
}
