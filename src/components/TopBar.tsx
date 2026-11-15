import { useEffect } from 'react';
import { clock, hhmm } from '../lib/format';
import { missionClockUtc } from '../sim/mission';
import type { EnvironmentBundle } from '../data/loadEnvironment';
import type { MissionState, Screen } from '../sim/types';
import { DataBadge } from './DataBadge';

const STEPS: { id: Screen; label: string }[] = [
  { id: 'briefing', label: 'Brief' },
  { id: 'build', label: 'Design' },
  { id: 'operate', label: 'Fly' },
  { id: 'debrief', label: 'Debrief' },
];

export function TopBar({
  env,
  screen,
  mission,
  onNavigate,
}: {
  env: EnvironmentBundle | null;
  screen: Screen;
  mission: MissionState | null;
  onNavigate: (screen: Screen) => void;
}) {
  // name="databadge" keeps only one panel open; this dismisses it on any
  // click that is not on a badge (native <details> has no such behaviour).
  useEffect(() => {
    const dismiss = (event: Event) => {
      const target = event.target as Element | null;
      if (target?.closest('.databadge')) return;
      for (const open of document.querySelectorAll<HTMLDetailsElement>('details.databadge[open]')) {
        open.open = false;
      }
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);

  return (
    <header className="topbar">
      <button className="brand" onClick={() => onNavigate('briefing')} aria-label="Dead Reckoning home">
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="26" height="26">
            <circle cx="16" cy="16" r="13.5" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5" />
            <ellipse cx="16" cy="16" rx="13.5" ry="5.5" fill="none" stroke="currentColor" strokeWidth="1" transform="rotate(-24 16 16)" />
            <circle cx="16" cy="16" r="3.2" fill="currentColor" />
            <circle cx="26.5" cy="9.5" r="1.6" fill="currentColor" />
          </svg>
        </span>
        <span className="brand-text">
          <strong>Dead Reckoning</strong>
          <em>LEO Earth observation · 6 h</em>
        </span>
      </button>

      <nav className="steps" aria-label="Mission phases">
        {STEPS.map((step, index) => {
          const active = step.id === screen;
          const reachable =
            step.id === 'briefing' ||
            step.id === 'build' ||
            (step.id === 'operate' && mission !== null) ||
            (step.id === 'debrief' && mission !== null);
          return (
            <button
              key={step.id}
              className={`step ${active ? 'is-active' : ''}`}
              disabled={!reachable}
              aria-current={active ? 'step' : undefined}
              onClick={() => onNavigate(step.id)}
            >
              <span className="step-index">{String(index + 1).padStart(2, '0')}</span>
              {step.label}
            </button>
          );
        })}
      </nav>

      <div className="topbar-right">
        {mission ? (
          <div className="clock-chip" title="Mission elapsed time and UTC">
            <span className="mono">T+{clock(mission.t)}</span>
            <span className="mono dim">{hhmm(missionClockUtc(mission))}Z</span>
          </div>
        ) : null}
        {env ? (
          <div className="badges">
            <DataBadge label="CelesTrak" data={env.gp} />
            <DataBadge label="DONKI" data={env.weather} />
          </div>
        ) : (
          <span className="mono dim">loading data…</span>
        )}
      </div>
    </header>
  );
}
