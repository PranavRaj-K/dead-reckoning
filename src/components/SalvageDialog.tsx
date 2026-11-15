import { useEffect, useRef } from 'react';
import { clock } from '../lib/format';
import { faultCopy, getRecoveryActions } from '../sim/salvage';
import type { MissionState } from '../sim/types';
import { Bar, Chip, Info } from './ui';

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
              <div className="tile-row salvage-tiles">
                <div className="tile">
                  <span className="stat-label">Battery</span>
                  <span className="stat-value">
                    {state.batteryWh.toFixed(1)}
                    <small>/ {state.batteryCapacityWh.toFixed(0)} Wh</small>
                  </span>
                  <Bar
                    ratio={state.batteryCapacityWh > 0 ? state.batteryWh / state.batteryCapacityWh : 0}
                    tone={state.batteryWh / state.batteryCapacityWh < 0.3 ? 'bad' : 'ok'}
                    label="Battery charge"
                  />
                </div>
                <div className="tile">
                  <span className="stat-label">Recorder</span>
                  <span className="stat-value">
                    {state.dataStoredMb.toFixed(0)}
                    <small>/ {state.budgets.storageMb} MB</small>
                  </span>
                  <Bar
                    ratio={state.budgets.storageMb > 0 ? state.dataStoredMb / state.budgets.storageMb : 0}
                    tone={state.dataStoredMb / state.budgets.storageMb > 0.8 ? 'warn' : 'info'}
                    label="Recorder fill"
                  />
                </div>
                <div className="tile">
                  <span className="stat-label">Science</span>
                  <span className="stat-value">
                    {state.scienceDelivered.toFixed(1)}
                    <small>/ {state.scienceTarget}</small>
                  </span>
                  <Bar ratio={state.scienceDelivered / state.scienceTarget} tone="ok" label="Science delivered" />
                </div>
                <div className="tile">
                  <span className="stat-label">Scenes left</span>
                  <span className="stat-value">
                    {state.scenes.filter((scene) => scene.status === 'pending').length}
                  </span>
                </div>
              </div>
              <Info label="Why this is happening">
                <p>{copy.causeHint}</p>
              </Info>
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
                      <span className="action-tradeoff">{action.tradeoff}</span>
                      {action.unavailableReason ? (
                        <span className="action-blocked">{action.unavailableReason}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
