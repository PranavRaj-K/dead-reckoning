import { useEffect, useRef } from 'react';
import { clock } from '../lib/format';
import { faultCopy, getRecoveryActions } from '../sim/salvage';
import type { MissionState } from '../sim/types';
import { Chip } from './ui';

/**
 * Fault resolution is a modal decision on purpose: the clock stops, and the
 * player has to read the trade-off before the mission continues.
 */
export function SalvageDialog({
  state,
  onResolve,
}: {
  state: MissionState;
  onResolve: (actionId: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const pending = state.status === 'awaiting-salvage' && state.activeFault !== null;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (pending && !dialog.open) dialog.showModal();
    if (!pending && dialog.open) dialog.close();
  }, [pending]);

  const faultId = state.activeFault;
  const copy = faultId ? faultCopy(faultId) : null;
  const actions = faultId ? getRecoveryActions(state, faultId) : [];

  return (
    <dialog
      ref={ref}
      className="salvage"
      onCancel={(event) => event.preventDefault()}
      aria-labelledby="salvage-title"
    >
      {copy ? (
        <div className="salvage-inner">
          <header className="salvage-head">
            <div>
              <p className="eyebrow bad-text">Fault at T+{clock(state.t)}</p>
              <h2 id="salvage-title">{copy.title}</h2>
            </div>
            <Chip tone="bad">MISSION PAUSED</Chip>
          </header>

          <div className="salvage-grid">
            <div>
              <h3 className="subhead">What you can see</h3>
              <ul className="symptoms">
                {copy.symptoms.map((symptom) => (
                  <li key={symptom}>{symptom}</li>
                ))}
              </ul>
              <h3 className="subhead">Why this is happening</h3>
              <p className="note">{copy.causeHint}</p>
              <dl className="salvage-state">
                <div>
                  <dt>Battery</dt>
                  <dd className="mono">
                    {state.batteryWh.toFixed(1)} / {state.batteryCapacityWh.toFixed(1)} Wh
                  </dd>
                </div>
                <div>
                  <dt>Recorder</dt>
                  <dd className="mono">{state.dataStoredMb.toFixed(1)} Mb stored</dd>
                </div>
                <div>
                  <dt>Science</dt>
                  <dd className="mono">{state.scienceDelivered.toFixed(1)} delivered</dd>
                </div>
                <div>
                  <dt>Scenes left</dt>
                  <dd className="mono">{state.scenes.filter((scene) => scene.status === 'pending').length}</dd>
                </div>
              </dl>
            </div>

            <div>
              <h3 className="subhead">Recovery paths</h3>
              <div className="actions">
                {actions.map((action) => {
                  const blocked = Boolean(action.unavailableReason);
                  return (
                    <button
                      key={action.id}
                      className={`action ${blocked ? 'is-blocked' : ''}`}
                      disabled={blocked}
                      onClick={() => onResolve(action.id)}
                    >
                      <span className="action-top">
                        <strong>{action.label}</strong>
                        {action.risk ? (
                          <Chip tone="warn">{Math.round(action.risk.successChance * 100)}% odds</Chip>
                        ) : null}
                        {action.endsMission ? <Chip tone="bad">ends mission</Chip> : null}
                      </span>
                      <span className="action-desc">{action.description}</span>
                      <span className="action-tradeoff">Trade-off: {action.tradeoff}</span>
                      {action.unavailableReason ? (
                        <span className="action-blocked">{action.unavailableReason}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <p className="note small">
                The mission clock is stopped. Nothing advances until you choose a path.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
