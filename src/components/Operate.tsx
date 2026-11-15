import { clock, num } from '../lib/format';
import { missionClockUtc } from '../sim/mission';
import { SPEEDS } from '../app/useGame';
import type { CausalEvent, MissionState } from '../sim/types';
import { Bar, Chip, Panel } from './ui';
import { lazy, Suspense, useState } from 'react';
import { OrbitReadout, OrbitView } from './OrbitView';
import { WebglBoundary } from '../three/WebglBoundary';
import { webglAvailable } from '../three/util';
import type { EarthSource } from '../three/Orbit3D';

// three.js loads only when a mission is flying.
const Orbit3D = lazy(() => import('../three/Orbit3D'));

const EARTH_LABEL: Record<EarthSource, string> = {
  loading: 'NASA GIBS · loading',
  live: 'NASA GIBS · live',
  bundled: 'NASA GIBS · offline copy',
};
import { Schedule } from './Schedule';
import { Telemetry } from './Telemetry';
import { SalvageDialog } from './SalvageDialog';

const KIND_LABEL: Record<CausalEvent['kind'], string> = {
  design: 'DES',
  environment: 'ENV',
  fault: 'FLT',
  action: 'ACT',
  outcome: 'OUT',
  warning: 'WRN',
};

function Log({ events }: { events: CausalEvent[] }) {
  const recent = [...events].reverse().slice(0, 40);
  return (
    <ol className="log">
      {recent.map((event) => (
        <li key={event.id} className={`log-item log-${event.severity}`}>
          <span className="log-t mono">{clock(event.t)}</span>
          <span className="log-kind mono">{KIND_LABEL[event.kind]}</span>
          <span className="log-text">
            <strong>{event.title}</strong>
            {event.detail ? <em>{event.detail}</em> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function Operate({
  state,
  paused,
  speed,
  onPause,
  onSpeed,
  onSkipScene,
  onResolve,
  onDebrief,
  crew,
}: {
  state: MissionState;
  paused: boolean;
  speed: number;
  onPause: (paused: boolean) => void;
  onSpeed: (speed: number) => void;
  onSkipScene: (sceneId: string, skipped: boolean) => void;
  onResolve: (actionId: string) => void;
  onDebrief: () => void;
  crew: string[];
}) {
  const [earthSource, setEarthSource] = useState<EarthSource>('loading');
  const [webgl] = useState(webglAvailable);
  const progress = state.t / state.durationSec;
  const finished = state.status === 'complete' || state.status === 'failed';

  return (
    <div className="screen operate">
      <div className="operate-head">
        <div className="clock-block">
          <span className="eyebrow">Mission elapsed</span>
          <span className="big-clock mono">{clock(state.t)}</span>
          <span className="mono dim">
            {missionClockUtc(state).slice(0, 19)}Z · T−{clock(state.durationSec - state.t)} remaining
          </span>
        </div>

        <div className="operate-progress">
          <div className="operate-progress-head">
            <span>Mission progress</span>
            <span className="mono">{Math.round(progress * 100)}%</span>
          </div>
          <Bar ratio={progress} tone={state.status === 'failed' ? 'bad' : 'ok'} label="Mission progress" />
        </div>

        <div className="controls">
          {finished ? (
            <button className="btn btn-primary" onClick={onDebrief}>
              Open debrief
            </button>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={() => onPause(!paused)}>
                {paused ? 'Resume' : 'Pause'}
              </button>
              <div className="speeds" role="group" aria-label="Simulation speed" data-guide="speeds">
                {SPEEDS.map((option) => (
                  <button
                    key={option}
                    className={`speed ${speed === option ? 'is-active' : ''}`}
                    onClick={() => onSpeed(option)}
                    aria-pressed={speed === option}
                  >
                    {option}×
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="status-strip">
        <Chip tone={state.status === 'failed' ? 'bad' : state.status === 'complete' ? 'ok' : 'info'}>
          {state.status.replace('-', ' ').toUpperCase()}
        </Chip>
        <span className={`chip ${state.inSunlight ? 'chip-ok' : 'chip-idle'}`}>
          {state.inSunlight ? 'Sunlit' : 'Eclipse'}
        </span>
        <span className="dim small">
          {state.reference.objectName} propagation · NORAD {state.reference.noradId} · epoch{' '}
          {state.epochUtc.slice(0, 16)}Z
        </span>
        <span className="mono dim small">{num(state.powerGenW - state.powerLoadW, 1)} W net</span>
      </div>

      {state.failureReason ? <p className="failure-banner">{state.failureReason}</p> : null}

      <div className="operate-grid">
        <Panel
          title="Orbit"
          subtitle="SGP4 from real CelesTrak elements · drag to rotate, scroll to zoom"
          actions={<span className="mono dim small">{EARTH_LABEL[earthSource]}</span>}
        >
          {webgl ? (
            <WebglBoundary fallback={<OrbitView state={state.orbit} />}>
              <div className="stage stage-orbit" data-guide="orbit">
                <Suspense fallback={null}>
                  <Orbit3D
                    reference={state.reference}
                    tSec={state.t}
                    inSunlight={state.inSunlight}
                    contactStation={state.lastContactStation}
                    onEarthSource={setEarthSource}
                  />
                </Suspense>
                <div className="stage-legend" aria-hidden="true">
                  <span><i className="key key-trail" /> last 25 min</span>
                  <span><i className="key key-ahead" /> next orbit</span>
                  <span><i className="key key-beam" /> downlink</span>
                  <span className="dim">spacecraft not to scale</span>
                </div>
              </div>
              <OrbitReadout state={state.orbit} />
            </WebglBoundary>
          ) : (
            <OrbitView state={state.orbit} />
          )}
        </Panel>
        <Panel title="Power &amp; data" subtitle="30 s telemetry downlink">
          <Telemetry state={state} />
        </Panel>
      </div>

      <Panel title="Mission timeline" subtitle="Predicted passes, scene windows and decisions" className="guide-schedule">
        <Schedule state={state} onSkip={onSkipScene} />
      </Panel>

      <Panel title="Flight log" subtitle="Every event is recorded by the simulation as it happens">
        <Log events={state.causal} />
      </Panel>

      <SalvageDialog state={state} onResolve={onResolve} crew={crew} />
    </div>
  );
}
