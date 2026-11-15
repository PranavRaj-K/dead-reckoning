import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEventHandler,
} from 'react';
import { createPortal } from 'react-dom';
import { COMPONENTS, PRESETS, SLOT_LABELS, SLOT_ORDER, componentsForSlot, componentById } from '../sim/catalogue';
import { POSTURE_RULES, estimatedThroughputMb } from '../sim/resources';
import type {
  Budgets,
  ComponentSpec,
  Design,
  DesignSlot,
  RiskPosture,
  Validation,
} from '../sim/types';
import { num, pct, usd } from '../lib/format';
import { SpacecraftPreview } from './SpacecraftPreview';
import { Bar, Panel, type Tone } from './ui';

const PREVIEW_SIZES = [
  { id: 'compact', label: 'S', title: 'Small preview' },
  { id: 'normal', label: 'M', title: 'Medium preview' },
  { id: 'expanded', label: 'L', title: 'Large preview' },
  { id: 'full', label: 'FULL', title: 'Full preview' },
] as const;

type PreviewSize = (typeof PREVIEW_SIZES)[number]['id'];

/** Internal bays are shown as dashed cutaways, not as exact CAD placement. */
const INTERNAL_SLOTS: DesignSlot[] = ['bus', 'battery', 'adcs'];

/** Overlay runs free above this breakpoint; below it the window stacks in the page. */
const FLOATING_QUERY = '(min-width: 1081px)';
const EDGE_GAP = 8;
/** Movement below this many pixels is a click, not a drag. */
const TAP_SLOP = 4;

type Offset = { x: number; y: number };

type DragBox = { left: number; top: number; width: number; height: number };

type DragHandlers = {
  onPointerDown: PointerEventHandler<HTMLElement>;
  onPointerMove: PointerEventHandler<HTMLElement>;
  onPointerUp: PointerEventHandler<HTMLElement>;
  onPointerCancel: PointerEventHandler<HTMLElement>;
};

/** The element's untransformed box in viewport coordinates. */
function boxOf(el: HTMLElement | null, offset: Offset): DragBox | null {
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    left: rect.left - offset.x,
    top: rect.top - offset.y,
    width: rect.width,
    height: rect.height,
  };
}

/** Keep the whole box in the viewport, leaving a small edge gap. */
function clampOffset(box: DragBox | null, offset: Offset): Offset {
  if (!box) return offset;
  // clientWidth/Height exclude the scrollbar, so the element never hides under it.
  const { clientWidth, clientHeight } = document.documentElement;
  const minX = EDGE_GAP - box.left;
  const minY = EDGE_GAP - box.top;
  const maxX = Math.max(clientWidth - EDGE_GAP - box.left - box.width, minX);
  const maxY = Math.max(clientHeight - EDGE_GAP - box.top - box.height, minY);
  return {
    x: Math.min(Math.max(offset.x, minX), maxX),
    y: Math.min(Math.max(offset.y, minY), maxY),
  };
}

/**
 * Pointer drag for a viewport-clamped element. The gesture writes the offset
 * straight to the node and commits it on release, so dragging never re-renders
 * the workbench. With a threshold, a press that never moves far enough is a tap.
 */
function useDragOffset<T extends HTMLElement>({
  enabled,
  skipControls = false,
  threshold = 0,
  onTap,
}: {
  enabled: boolean;
  /** Leave presses that start on a nested control alone (the preview header hosts buttons). */
  skipControls?: boolean;
  threshold?: number;
  onTap?: () => void;
}) {
  const ref = useRef<T>(null);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const gesture = useRef<{ pointer: Offset; start: Offset; box: DragBox | null; moved: boolean } | null>(
    null,
  );

  // A resized window can strand the element offscreen; pull it back in.
  useEffect(() => {
    const reclamp = () => setOffset((current) => clampOffset(boxOf(ref.current, current), current));
    window.addEventListener('resize', reclamp);
    return () => window.removeEventListener('resize', reclamp);
  }, []);

  function release(event: React.PointerEvent<HTMLElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const onPointerDown: PointerEventHandler<HTMLElement> = (event) => {
    if (!enabled || event.button !== 0) return;
    if (skipControls && (event.target as HTMLElement).closest('button')) return;
    gesture.current = {
      pointer: { x: event.clientX, y: event.clientY },
      start: offset,
      box: boxOf(ref.current, offset),
      moved: threshold === 0,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove: PointerEventHandler<HTMLElement> = (event) => {
    const state = gesture.current;
    if (!state) return;
    const dx = event.clientX - state.pointer.x;
    const dy = event.clientY - state.pointer.y;
    if (!state.moved) {
      if (dx * dx + dy * dy <= threshold * threshold) return;
      state.moved = true;
    }
    const next = clampOffset(state.box, { x: state.start.x + dx, y: state.start.y + dy });
    ref.current?.style.setProperty('--preview-x', `${next.x}px`);
    ref.current?.style.setProperty('--preview-y', `${next.y}px`);
  };

  const onPointerUp: PointerEventHandler<HTMLElement> = (event) => {
    const state = gesture.current;
    if (!state) return;
    gesture.current = null;
    release(event);
    if (!state.moved) {
      onTap?.();
      return;
    }
    setOffset(
      clampOffset(state.box, {
        x: state.start.x + event.clientX - state.pointer.x,
        y: state.start.y + event.clientY - state.pointer.y,
      }),
    );
  };

  /** Put the element's untransformed box at a viewport point, kept inside the viewport. */
  function place(left: number, top: number) {
    const base = boxOf(ref.current, offset);
    if (base) setOffset(clampOffset(base, { x: left - base.left, y: top - base.top }));
  }

  // A cancelled gesture goes back to where it started; the move handler never touched state.
  const onPointerCancel: PointerEventHandler<HTMLElement> = (event) => {
    const state = gesture.current;
    gesture.current = null;
    release(event);
    if (!state?.moved) return;
    setOffset(state.start);
    ref.current?.style.setProperty('--preview-x', `${state.start.x}px`);
    ref.current?.style.setProperty('--preview-y', `${state.start.y}px`);
  };

  return {
    node: ref,
    offset,
    reset: () => setOffset({ x: 0, y: 0 }),
    place,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel } as DragHandlers,
  };
}

function specLine(spec: ComponentSpec): string {
  switch (spec.slot) {
    case 'bus':
      return `${spec.storageMb} MB recorder`;
    case 'power':
      return `${spec.generationW} W peak`;
    case 'battery':
      return `${spec.capacityWh} Wh rated`;
    case 'radio':
      return `${num(spec.downlinkKbps ?? 0, 1)} kbps`;
    case 'antenna':
      return `gain ${spec.gainFactor} · needs ${spec.requiresPointingDeg}°`;
    case 'adcs':
      return `${spec.pointingAccuracyDeg}° pointing`;
    case 'instrument':
      return `${spec.dataMbPerScene} MB/scene · ${spec.scienceValue} science`;
  }
}

function toneFor(ok: boolean, warn: boolean): Tone {
  if (!ok) return 'bad';
  return warn ? 'warn' : 'ok';
}

export function Build({
  design,
  budgets,
  validation,
  seed,
  onSlot,
  onPreset,
  onDesign,
  onSeed,
  onLaunch,
}: {
  design: Design;
  budgets: Budgets;
  validation: Validation;
  seed: number;
  onSlot: (slot: DesignSlot, id: string) => void;
  onPreset: (id: string) => void;
  onDesign: (design: Design) => void;
  onSeed: (seed: number) => void;
  onLaunch: () => void;
}) {
  const rule = POSTURE_RULES[design.riskPosture];
  const requiredMarginW = budgets.avgLoadW * rule.minEnergyMarginRatio;
  const requiredEclipseWh = budgets.eclipseEnergyNeedWh * (1 + rule.eclipseReserveRatio);
  const throughput = estimatedThroughputMb(budgets);
  const errors = validation.issues.filter((issue) => issue.severity === 'error');
  const warnings = validation.issues.filter((issue) => issue.severity === 'warning');

  // Preview UI state is local: closing or resizing it never touches the design.
  const [focusSlot, setFocusSlot] = useState<DesignSlot>('instrument');
  const [previewSize, setPreviewSize] = useState<PreviewSize>('normal');
  // The workbench opens with the collapsed bar, not the window.
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pulse, setPulse] = useState<string | null>(null);
  const [floating, setFloating] = useState(() => window.matchMedia(FLOATING_QUERY).matches);
  const barAnchor = useRef<{ left: number; top: number } | null>(null);

  // Both the floating window and its collapsed bar share one drag implementation.
  const {
    node: previewNode,
    offset: previewOffset,
    place: placePreview,
    handlers: previewHandlers,
  } = useDragOffset<HTMLElement>({ enabled: floating, skipControls: true });
  const {
    node: barNode,
    offset: barOffset,
    reset: resetBar,
    handlers: barHandlers,
  } = useDragOffset<HTMLButtonElement>({
    enabled: true,
    threshold: TAP_SLOP,
    onTap: () => openFromBar(),
  });

  /** Remember where the bar sits so the window can open next to it. */
  function openFromBar() {
    const rect = barNode.current?.getBoundingClientRect();
    barAnchor.current = rect ? { left: rect.left, top: rect.top } : null;
    setPreviewOpen(true);
  }

  // Place the window beside the bar it was opened from, before the first paint.
  useLayoutEffect(() => {
    const from = barAnchor.current;
    barAnchor.current = null;
    const el = previewNode.current;
    if (!from || !floating || !el) return;
    placePreview(from.left - el.offsetWidth - EDGE_GAP, from.top);
  }, [previewOpen, floating, placePreview, previewNode]);

  // The floating window lives outside the animated `.screen`, because that
  // entry animation's identity transform would trap a fixed child inside it.
  useEffect(() => {
    const query = window.matchMedia(FLOATING_QUERY);
    const sync = () => setFloating(query.matches);
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  const preview = previewOpen ? (
    <section
      ref={previewNode}
      className="build-preview viewer"
      data-size={previewSize}
      aria-label="Spacecraft preview"
      style={
        {
          '--preview-x': `${previewOffset.x}px`,
          '--preview-y': `${previewOffset.y}px`,
        } as CSSProperties
      }
    >
      <header className="viewer-head" title="Drag to move" {...previewHandlers}>
        <span className="viewer-grip" aria-hidden="true" />
        <span className="viewer-title">Preview</span>
        <div className="viewer-tools">
          {PREVIEW_SIZES.map((option) => {
            const active = previewSize === option.id;
            return (
              <button
                key={option.id}
                type="button"
                className={`viewer-btn ${option.id === 'full' ? 'viewer-btn-wide' : ''} ${active ? 'is-active' : ''}`}
                aria-pressed={active}
                aria-label={option.title}
                title={option.title}
                onClick={() => setPreviewSize(option.id)}
              >
                {option.label}
              </button>
            );
          })}
          <button
            type="button"
            className="viewer-btn"
            aria-label="Close spacecraft preview"
            title="Close preview"
            onClick={() => {
              setPreviewOpen(false);
              // Every close drops the collapsed bar back above the budgets panel.
              resetBar();
            }}
          >
            ×
          </button>
        </div>
      </header>
      <div className="viewer-stage">
        <SpacecraftPreview design={design} focus={focusSlot} />
      </div>
      <div className="viewer-label" aria-live="polite">
        <span>{INTERNAL_SLOTS.includes(focusSlot) ? 'Internal bay · schematic' : 'Exterior mount'}</span>
        <strong>
          {SLOT_LABELS[focusSlot]} · {componentById(design.ids[focusSlot]).name}
        </strong>
      </div>
    </section>
  ) : null;

  // Collapsed bar: a tap opens the window, a press-and-move drags it. It sits in
  // the sidebar's own grid row, so it can never cover the budgets panel.
  const reopen = previewOpen ? null : (
    <button
      ref={barNode}
      type="button"
      className="preview-reopen"
      {...barHandlers}
      style={
        {
          '--preview-x': `${barOffset.x}px`,
          '--preview-y': `${barOffset.y}px`,
        } as CSSProperties
      }
      // Pointer taps are handled by the drag hook; this covers keyboard activation.
      onClick={(event) => {
        if (event.detail === 0) openFromBar();
      }}
      title="Show the spacecraft preview"
    >
      <svg viewBox="0 0 16 12" width="16" height="12" aria-hidden="true" focusable="false">
        <rect x="5.5" y="3" width="5" height="6" rx="1" />
        <rect x="0.5" y="4.5" width="3" height="3" rx="0.6" />
        <rect x="12.5" y="4.5" width="3" height="3" rx="0.6" />
        <path d="M3.5,6H5.5M10.5,6H12.5" />
      </svg>
      Show spacecraft preview
    </button>
  );

  return (
    <>
      <div className="screen build">
      <div className="build-head">
        <div>
          <p className="eyebrow">Phase 02 · Workbench</p>
          <h1>Design the spacecraft</h1>
          <p className="lede small">
            Seven decisions, two hard limits and a risk posture. Everything is live: change a part
            and the budgets move.
          </p>
        </div>
        <div className="presets" role="group" aria-label="Starting designs">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              className="preset"
              onClick={() => onPreset(preset.id)}
              title={preset.blurb}
            >
              <strong>{preset.name}</strong>
              <span>{preset.blurb}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="build-grid">
        <div className="build-main">
          {SLOT_ORDER.map((slot) => (
            <fieldset className="slot" key={slot}>
              <legend>
                <span className="slot-label">{SLOT_LABELS[slot]}</span>
                <span className="slot-choice">{componentById(design.ids[slot]).name}</span>
              </legend>
              <div className="parts">
                {componentsForSlot(slot).map((spec) => {
                  const checked = design.ids[slot] === spec.id;
                  const key = `${slot}:${spec.id}`;
                  return (
                    <label
                      key={spec.id}
                      className={`part ${checked ? 'is-selected' : ''} ${pulse === key ? 'is-pulse' : ''}`}
                      onClick={() => {
                        setFocusSlot(slot);
                        // Only a real change confirms; re-clicking the selected card stays quiet.
                        if (!checked) setPulse(key);
                      }}
                      onAnimationEnd={() => setPulse(null)}
                    >
                      <input
                        type="radio"
                        name={`slot-${slot}`}
                        value={spec.id}
                        checked={checked}
                        onChange={() => onSlot(slot, spec.id)}
                      />
                      <span className="part-top">
                        <strong>{spec.name}</strong>
                        <span className="mono part-price">{usd(spec.costUsd)}</span>
                      </span>
                      <span className="part-summary">{spec.summary}</span>
                      <span className="part-specs mono">
                        <span>{num(spec.massKg, 2)} kg</span>
                        <span>{specLine(spec)}</span>
                        {spec.powerW > 0 ? <span>{num(spec.powerW, 1)} W draw</span> : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <div className="option-row">
            <label className="toggle">
              <input
                type="checkbox"
                checked={design.beacon}
                onChange={(event) => onDesign({ ...design, beacon: event.target.checked })}
              />
              <span>
                <strong>Backup beacon</strong>
                <em>+0.05 kg · +$1,200 · 0.4 kbps omni fallback if the main radio dies</em>
              </span>
            </label>
          </div>
        </div>

        {floating ? null : preview}

        <aside className="build-side">
          {reopen}

          <Panel title="Budgets" subtitle="Computed from the propagated orbit">
            <div className="budget">
              <div className="budget-head">
                <span>Mass</span>
                <span className={`mono ${budgets.massKg > budgets.massLimitKg ? 'bad-text' : ''}`}>
                  {num(budgets.massKg, 2)} / {num(budgets.massLimitKg, 1)} kg
                </span>
              </div>
              <Bar
                ratio={budgets.massKg / budgets.massLimitKg}
                tone={toneFor(budgets.massKg <= budgets.massLimitKg, budgets.massMarginKg < 0.1)}
                label="Mass budget"
              />
            </div>

            <div className="budget">
              <div className="budget-head">
                <span>Cost</span>
                <span className={`mono ${budgets.costUsd > budgets.costLimitUsd ? 'bad-text' : ''}`}>
                  {usd(budgets.costUsd)} / {usd(budgets.costLimitUsd)}
                </span>
              </div>
              <Bar
                ratio={budgets.costUsd / budgets.costLimitUsd}
                tone={toneFor(budgets.costUsd <= budgets.costLimitUsd, budgets.costMarginUsd < 5000)}
                label="Cost budget"
              />
            </div>

            <div className="budget">
              <div className="budget-head">
                <span>Average energy margin</span>
                <span className={`mono ${budgets.energyMarginW < requiredMarginW ? 'bad-text' : ''}`}>
                  {num(budgets.energyMarginW, 1)} / {num(requiredMarginW, 1)} W
                </span>
              </div>
              <Bar
                ratio={requiredMarginW > 0 ? budgets.energyMarginW / requiredMarginW : budgets.energyMarginW > 0 ? 1 : 0}
                tone={toneFor(budgets.energyMarginW >= requiredMarginW, budgets.energyMarginW < requiredMarginW * 1.2)}
                label="Energy margin against posture requirement"
              />
              <p className="budget-note">
                {num(budgets.generationW, 0)} W peak × {pct(budgets.sunlitFraction)} sunlight × 0.9 panel
                loss − {num(budgets.avgLoadW, 2)} W load
              </p>
            </div>

            <div className="budget">
              <div className="budget-head">
                <span>Eclipse battery</span>
                <span className={`mono ${budgets.batteryUsableWh < requiredEclipseWh ? 'bad-text' : ''}`}>
                  {num(budgets.batteryUsableWh, 1)} / {num(requiredEclipseWh, 1)} Wh
                </span>
              </div>
              <Bar
                ratio={requiredEclipseWh > 0 ? budgets.batteryUsableWh / requiredEclipseWh : 1}
                tone={toneFor(budgets.batteryUsableWh >= requiredEclipseWh, budgets.batteryUsableWh < requiredEclipseWh * 1.15)}
                label="Battery capacity against eclipse demand"
              />
              <p className="budget-note">
                {num(budgets.eclipseMinutes, 1)} min of eclipse per orbit, 80% depth of discharge
              </p>
            </div>

            <div className="budget">
              <div className="budget-head">
                <span>Estimated downlink</span>
                <span className="mono">
                  {num(throughput, 0)} / {num(budgets.totalSceneDataMb, 0)} MB
                </span>
              </div>
              <Bar
                ratio={budgets.totalSceneDataMb > 0 ? throughput / budgets.totalSceneDataMb : 1}
                tone={toneFor(throughput >= budgets.totalSceneDataMb, throughput >= budgets.totalSceneDataMb * 0.6)}
                label="Estimated downlink capacity against imagery volume"
              />
              <p className="budget-note">
                {num(budgets.downlinkKbps, 1)} kbps effective · {budgets.storageMb} MB recorder
              </p>
            </div>

            <dl className="mini-grid">
              <div>
                <dt>Pointing</dt>
                <dd className="mono">{num(budgets.pointingAccuracyDeg, 2)}°</dd>
              </div>
              <div>
                <dt>Science potential</dt>
                <dd className="mono">{budgets.sciencePotential}</dd>
              </div>
              <div>
                <dt>Antenna gain</dt>
                <dd className="mono">{budgets.effectiveGain}</dd>
              </div>
              <div>
                <dt>Mass margin</dt>
                <dd className="mono">{num(budgets.massMarginKg, 2)} kg</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Risk posture" subtitle={rule.description}>
            <div className="postures" role="radiogroup" aria-label="Risk posture">
              {(Object.keys(POSTURE_RULES) as RiskPosture[]).map((posture) => (
                <label key={posture} className={`posture ${design.riskPosture === posture ? 'is-selected' : ''}`}>
                  <input
                    type="radio"
                    name="posture"
                    value={posture}
                    checked={design.riskPosture === posture}
                    onChange={() => onDesign({ ...design, riskPosture: posture })}
                  />
                  <span>{POSTURE_RULES[posture].label}</span>
                </label>
              ))}
            </div>
          </Panel>

          <Panel title="Review" subtitle={`${errors.length} blocking issue(s), ${warnings.length} warning(s)`}>
            {validation.issues.length === 0 ? (
              <p className="ok-text">All budgets within limits. Ready to launch.</p>
            ) : (
              <ul className="issues">
                {validation.issues.map((issue) => (
                  <li key={issue.id} className={`issue issue-${issue.severity}`}>
                    <span className="issue-tag">{issue.severity === 'error' ? 'BLOCK' : 'NOTE'}</span>
                    <span>{issue.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Scenario seed" subtitle="Same seed + same data = identical run">
            <label className="seed">
              <span>Seed</span>
              <input
                className="mono"
                type="number"
                inputMode="numeric"
                value={seed}
                min={1}
                max={4294967295}
                onChange={(event) => onSeed(Number(event.target.value) || 1)}
              />
            </label>
          </Panel>

          <div className="launch-block">
            <button className="btn btn-primary btn-wide" disabled={!validation.ok} onClick={onLaunch}>
              {validation.ok ? 'Launch mission' : `Fix ${errors.length} blocking issue(s)`}
            </button>
            <p className="note small">
              {COMPONENTS.length} parts available · launch mass includes structure, power, comms,
              attitude and payload.
            </p>
          </div>
        </aside>
      </div>
      </div>

      {floating ? createPortal(preview, document.getElementById('root')!) : null}
    </>
  );
}
