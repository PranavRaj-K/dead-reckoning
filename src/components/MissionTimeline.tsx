import { useState } from 'react';
import { clock } from '../lib/format';
import { FAULTS } from '../sim/salvage';
import type { FaultId, MissionScenario } from '../sim/types';

const FAULT_GLYPH: Record<FaultId, string> = {
  'radio-failure': 'M4 14a8 8 0 0 1 16 0M8 14a4 4 0 0 1 8 0M12 14v6M5 5l14 14',
  'adcs-degradation': 'M12 3v4M12 17v4M3 12h4M17 12h4M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
  'battery-degradation': 'M3 8h15v8H3zM18 11h3v2M7 10v4M11 10v4',
};

/**
 * The six-hour run at a glance. Faults are buttons: the player previews what is
 * coming instead of reading about it.
 */
export function MissionTimeline({ scenario }: { scenario: MissionScenario }) {
  const [open, setOpen] = useState<FaultId | null>(null);
  const at = (sec: number) => `${(sec / scenario.durationSec) * 100}%`;
  const hours = Array.from({ length: scenario.durationSec / 3600 + 1 }, (_, h) => h);
  const fault = open ? FAULTS[open] : null;
  const faultAt = open ? (scenario.faults.find((entry) => entry.id === open)?.atSec ?? 0) : 0;

  return (
    <div className="timeline">
      <div className="timeline-track" role="group" aria-label="Mission timeline">
        {scenario.scenes.map((scene) => (
          <span
            key={scene.id}
            className="timeline-scene"
            style={{ left: at(scene.startSec), width: at(scene.endSec - scene.startSec) }}
            title={`${scene.label}, T+${clock(scene.startSec)}`}
          />
        ))}
        {scenario.faults.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`timeline-fault ${open === entry.id ? 'is-open' : ''}`}
            style={{ left: at(entry.atSec) }}
            aria-expanded={open === entry.id}
            aria-label={`Preview fault at T+${clock(entry.atSec)}: ${FAULTS[entry.id].shortTitle}`}
            onClick={() => setOpen((current) => (current === entry.id ? null : entry.id))}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={FAULT_GLYPH[entry.id]} />
            </svg>
          </button>
        ))}
      </div>
      <div className="timeline-hours" aria-hidden="true">
        {hours.map((h) => (
          <span key={h} style={{ left: at(h * 3600) }}>
            {h}h
          </span>
        ))}
      </div>
      <div className="timeline-legend">
        <span>
          <i className="swatch swatch-scene" /> {scenario.scenes.length} imaging windows
        </span>
        <span>
          <i className="swatch swatch-fault" /> {scenario.faults.length} faults. Tap one to preview
        </span>
      </div>
      {fault ? (
        <div className="timeline-card" role="status">
          <span className="mono bad-text">T+{clock(faultAt)}</span>
          <strong>{fault.title}</strong>
          <span className="dim">{fault.symptoms[0]}</span>
        </div>
      ) : null}
    </div>
  );
}
