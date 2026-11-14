import { clock, num } from '../lib/format';
import type { MissionState } from '../sim/types';

function position(tSec: number, duration: number): number {
  return Math.min(100, Math.max(0, (tSec / duration) * 100));
}

export function Schedule({
  state,
  onSkip,
}: {
  state: MissionState;
  onSkip: (sceneId: string, skipped: boolean) => void;
}) {
  const duration = state.durationSec;
  const now = position(state.t, duration);
  const canEdit = (state.status === 'running' || state.status === 'paused');
  const passes = state.contacts.filter((contact) => contact.endSec >= state.t - 300);
  const upcoming = passes.filter((contact) => contact.startSec > state.t).slice(0, 6);
  const active = state.contacts.find((contact) => state.t >= contact.startSec && state.t < contact.endSec);

  return (
    <div className="schedule">
      <div className="timeline" aria-hidden="true">
        <div className="timeline-track">
          {state.contacts.map((contact) => (
            <span
              key={contact.id}
              className={`tl-pass ${contact.peakElevationDeg >= 40 ? 'is-high' : ''}`}
              style={{
                left: `${position(contact.startSec, duration)}%`,
                width: `${Math.max(0.35, position(contact.endSec, duration) - position(contact.startSec, duration))}%`,
              }}
            />
          ))}
          {state.sceneWindows.map((window, index) => (
            <span
              key={window.id}
              className={`tl-scene tl-scene-${state.scenes[index].status}`}
              style={{ left: `${position(window.startSec, duration)}%` }}
            />
          ))}
          {state.faults
            .filter((fault) => fault.status !== 'pending')
            .map((fault) => (
              <span
                key={fault.id}
                className="tl-fault"
                style={{ left: `${position(fault.atSec, duration)}%` }}
                title={fault.id}
              />
            ))}
          <span className="tl-now" style={{ left: `${now}%` }} />
        </div>
        <div className="timeline-scale mono">
          <span>00:00</span>
          <span>02:00</span>
          <span>04:00</span>
          <span>06:00</span>
        </div>
        <div className="timeline-legend">
          <span><i className="lg-pass" /> ground pass</span>
          <span><i className="lg-scene" /> scene window</span>
          <span><i className="lg-fault" /> fault</span>
        </div>
      </div>

      <div className="schedule-columns">
        <div>
          <h3 className="subhead">Observation windows</h3>
          <div className="scene-grid">
            {state.scenes.map((scene, index) => {
              const window = state.sceneWindows[index];
              const open =
                canEdit &&
                (scene.status === 'pending' || (scene.status === 'skipped' && state.t < window.endSec));
              const skipped = scene.status === 'skipped';
              return (
                <div key={scene.id} className={`scene scene-${scene.status}`}>
                  <div className="scene-head">
                    <span className="mono">{String(index + 1).padStart(2, '0')}</span>
                    <span className="scene-status">{scene.status}</span>
                  </div>
                  <span className="scene-time mono">
                    {clock(window.startSec)}–{clock(window.endSec)}
                  </span>
                  {scene.status === 'stored' || scene.status === 'lost' ? (
                    <span className="scene-meta mono">
                      q {num(scene.quality, 2)} · {num(scene.scienceDelivered, 1)} sci
                    </span>
                  ) : null}
                  <button
                    className="scene-toggle"
                    disabled={!open}
                    onClick={() => onSkip(scene.id, !skipped)}
                    aria-label={`${skipped ? 'Restore' : 'Skip'} ${scene.label}`}
                  >
                    {skipped ? 'Restore' : 'Skip'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="subhead">Ground passes</h3>
          {active ? (
            <p className="pass-active">
              <span className="dot-ok" aria-hidden="true" />
              {active.stationName} · peak {num(active.peakElevationDeg, 0)}° · ends {clock(active.endSec)}
            </p>
          ) : (
            <p className="dim small">No pass in progress.</p>
          )}
          <ul className="pass-list">
            {upcoming.length === 0 ? (
              <li className="dim">No further passes in the mission window.</li>
            ) : (
              upcoming.map((contact) => (
                <li key={contact.id}>
                  <span>{contact.stationName}</span>
                  <span className="mono dim">
                    {clock(contact.startSec)}–{clock(contact.endSec)} · {num(contact.peakElevationDeg, 0)}°
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
