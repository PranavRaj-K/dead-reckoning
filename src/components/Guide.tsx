import { useEffect, useState } from 'react';
import type { Screen } from '../sim/types';

interface Step {
  /** Candidate targets in priority order; the first visible one is used. */
  targets: string[];
  title: string;
  body: string;
}

const STEPS: Record<Screen, Step[]> = {
  briefing: [
    { targets: ['.timeline'], title: 'This is your mission', body: 'Six hours, 12 imaging windows, 3 faults. Tap a red marker to see what breaks.' },
    { targets: ['.hero-actions .btn-primary'], title: 'Start building', body: 'Open the workbench to design your spacecraft.' },
  ],
  build: [
    { targets: ['[data-guide="presets"]'], title: 'Pick a starter design', body: 'Three legal designs, three different bets. Stuck? "Grade S plan" loads the best one and explains every choice.' },
    { targets: ['[data-guide="assembly"]'], title: 'Watch it come together', body: 'Every part you choose bolts onto the model. Drag to rotate it.' },
    { targets: ['[data-guide="parts"]'], title: 'Swap parts', body: 'Each card spends mass, money or power. The part you touch is outlined in amber.' },
    { targets: ['.budget-hud', '[data-guide="budgets"]'], title: 'Keep every bar green', body: 'A red bar blocks launch. Fix it by trading a heavier or hungrier part.' },
    { targets: ['.hud-launch', '[data-guide="launch"]'], title: 'Launch', body: 'No blocking issues? Fly it.' },
  ],
  operate: [
    { targets: ['[data-guide="speeds"]'], title: 'Set the pace', body: 'Run at 60×, 300× or 900×. The clock stops for every fault.' },
    { targets: ['[data-guide="orbit"]'], title: 'Your real orbit', body: 'Earth from NASA imagery, path from SGP4. A green line means data is coming down.' },
    { targets: ['.guide-schedule'], title: 'Manage the windows', body: 'Skip a scene to save power or recorder space before a fault hits.' },
  ],
  debrief: [
    { targets: ['.verdict'], title: 'Your grade', body: 'Science 60%, data 25%, resources 15%. Fly again on the same seed to compare.' },
    { targets: ['.advice-panel'], title: 'What to change next', body: 'Each card comes from this run. Apply one and the workbench opens with that part swapped in.' },
  ],
};

const DONE_KEY = 'dead-reckoning:v1:guide-done';

function readDone(): Screen[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(DONE_KEY) ?? '[]');
    return Array.isArray(parsed) ? (parsed.filter((entry) => typeof entry === 'string') as Screen[]) : [];
  } catch {
    return [];
  }
}

function markDone(screen: Screen): void {
  try {
    const done = new Set(readDone()).add(screen);
    window.localStorage.setItem(DONE_KEY, JSON.stringify([...done]));
  } catch {
    // Storage blocked: the tour simply shows again next time.
  }
}

function findTarget(step: Step): HTMLElement | null {
  for (const selector of step.targets) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el && el.offsetParent !== null) return el;
  }
  return null;
}

/** First-run walkthrough. One card, one highlighted element, per step. */
export function Guide({ screen, blocked }: { screen: Screen; blocked: boolean }) {
  const steps = STEPS[screen];
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(() => !readDone().includes(screen));

  const active = open && !blocked;
  const step = steps[index];

  useEffect(() => {
    if (!active || !step) return;
    let el: HTMLElement | null = null;
    // Lazy panels (the 3D views) can mount a frame late; look after a beat.
    const timer = window.setTimeout(() => {
      el = findTarget(step);
      el?.classList.add('guide-focus');
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 120);
    return () => {
      window.clearTimeout(timer);
      el?.classList.remove('guide-focus');
    };
  }, [active, step]);

  const close = () => {
    markDone(screen);
    setOpen(false);
  };

  if (!active || !step) {
    return blocked ? null : (
      <button
        type="button"
        className="guide-reopen"
        onClick={() => {
          setIndex(0);
          setOpen(true);
        }}
      >
        How to play
      </button>
    );
  }

  const last = index === steps.length - 1;
  return (
    <aside className="guide" role="dialog" aria-label="Walkthrough" aria-live="polite">
      <span className="guide-count mono">
        {index + 1} / {steps.length}
      </span>
      <strong className="guide-title">{step.title}</strong>
      <p className="guide-body">{step.body}</p>
      <div className="guide-actions">
        <button type="button" className="btn btn-ghost btn-small" onClick={close}>
          Skip tour
        </button>
        {index > 0 ? (
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setIndex(index - 1)}>
            Back
          </button>
        ) : null}
        <button type="button" className="btn btn-primary btn-small" onClick={last ? close : () => setIndex(index + 1)}>
          {last ? 'Got it' : 'Next'}
        </button>
      </div>
    </aside>
  );
}
