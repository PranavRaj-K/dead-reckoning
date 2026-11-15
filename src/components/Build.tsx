import { lazy, Suspense, useState } from 'react';
import { COMPONENTS, PRESETS, SLOT_LABELS, SLOT_ORDER, componentsForSlot, componentById } from '../sim/catalogue';
import { POSTURE_RULES, estimatedThroughputMb } from '../sim/resources';
import type {
  Budgets,
  ComponentSpec,
  DataSnapshot,
  GpElements,
  MissionChoice,
  OrbitId,
  Design,
  DesignSlot,
  RiskPosture,
  Validation,
} from '../sim/types';
import { num, pct, usd } from '../lib/format';
import { SpacecraftPreview } from './SpacecraftPreview';
import { WebglBoundary } from '../three/WebglBoundary';
import { isPerfectDesign } from '../sim/perfect';
import { PerfectPlan } from './PerfectPlan';
import { MissionSetup } from './MissionSetup';
import { ownerOf, roleForSlot } from '../sim/crew';
import { webglAvailable } from '../three/util';
import { Bar, Panel, type Tone } from './ui';

// three.js loads only when the workbench opens.
const Spacecraft3D = lazy(() => import('../three/Spacecraft3D'));

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
  onPerfect,
  orbitData,
  crew,
  onMission,
  onCrew,
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
  onPerfect: () => void;
  orbitData: Record<OrbitId, DataSnapshot<GpElements>>;
  crew: string[];
  onMission: (patch: Partial<MissionChoice>) => void;
  onCrew: (crew: string[]) => void;
}) {
  const rule = POSTURE_RULES[design.riskPosture];
  const requiredMarginW = budgets.avgLoadW * rule.minEnergyMarginRatio;
  const requiredEclipseWh = budgets.eclipseEnergyNeedWh * (1 + rule.eclipseReserveRatio);
  const throughput = estimatedThroughputMb(budgets);
  const errors = validation.issues.filter((issue) => issue.severity === 'error');
  const warnings = validation.issues.filter((issue) => issue.severity === 'warning');

  // The part card the player last touched; the 3D view outlines it.
  const [focusSlot, setFocusSlot] = useState<DesignSlot>('instrument');
  const [pulse, setPulse] = useState<string | null>(null);
  // Bumping this re-runs the part-by-part assembly from an empty bay.
  const [runKey, setRunKey] = useState(0);
  const [webgl] = useState(webglAvailable);

  return (
    <>
      <div className="screen build">
      <div className="build-head">
        <div>
          <p className="eyebrow">Phase 02 · Workbench</p>
          <h1>Design the spacecraft</h1>
          <p className="lede small">Pick a part. Watch the budgets move. Launch when every bar is green.</p>
        </div>
        <div className="presets" role="group" aria-label="Starting designs" data-guide="presets">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              className="preset"
              onClick={() => {
                onPreset(preset.id);
                setRunKey((key) => key + 1);
              }}
              title={preset.blurb}
            >
              <strong>{preset.name}</strong>
              <span>{preset.blurb}</span>
            </button>
          ))}
          <button className="preset preset-perfect" onClick={() => {
            onPerfect();
            setRunKey((key) => key + 1);
          }}>
            <strong>Grade S plan</strong>
            <span>The best design for this orbit, with every part and recovery explained.</span>
          </button>
        </div>
      </div>

      <div className="build-grid">
        <div className="build-main">
          <section className="assembly" data-guide="assembly" aria-label="Spacecraft assembly">
            <div className="stage stage-craft">
              {webgl ? (
                <WebglBoundary fallback={<SpacecraftPreview design={design} focus={focusSlot} />}>
                  <Suspense fallback={null}>
                    <Spacecraft3D design={design} focus={focusSlot} runKey={runKey} />
                  </Suspense>
                </WebglBoundary>
              ) : (
                <SpacecraftPreview design={design} focus={focusSlot} />
              )}
            </div>
            <div className="assembly-bar">
              <span className="assembly-focus" aria-live="polite">
                <span className="dim">{SLOT_LABELS[focusSlot]}</span>
                <strong>{componentById(design.ids[focusSlot]).name}</strong>
              </span>
              <span className="dim small">Drag to rotate</span>
              <button type="button" className="btn btn-ghost btn-small" onClick={() => setRunKey((key) => key + 1)}>
                Rebuild from scratch
              </button>
            </div>
          </section>

          {isPerfectDesign(design, seed) ? <PerfectPlan /> : null}

          <MissionSetup design={design} orbitData={orbitData} crew={crew} onMission={onMission} onCrew={onCrew} />

          {/* Narrow screens stack the budgets below every part; this strip keeps them in view. */}
          <div className="budget-hud" aria-label="Live budgets">
            {[
              { label: 'Mass', ok: budgets.massKg <= budgets.massLimitKg, ratio: budgets.massKg / budgets.massLimitKg, text: `${num(budgets.massKg, 2)} kg` },
              { label: 'Cost', ok: budgets.costUsd <= budgets.costLimitUsd, ratio: budgets.costUsd / budgets.costLimitUsd, text: `$${num(budgets.costUsd / 1000, 0)}k` },
              { label: 'Power', ok: budgets.energyMarginW >= requiredMarginW, ratio: requiredMarginW > 0 ? budgets.energyMarginW / requiredMarginW : 1, text: `${num(budgets.energyMarginW, 1)} W` },
              { label: 'Battery', ok: budgets.batteryUsableWh >= requiredEclipseWh, ratio: requiredEclipseWh > 0 ? budgets.batteryUsableWh / requiredEclipseWh : 1, text: `${num(budgets.batteryUsableWh, 0)} Wh` },
            ].map((item) => (
              <div key={item.label} className={`hud-cell ${item.ok ? '' : 'is-bad'}`}>
                <span className="hud-label">{item.label}</span>
                <span className="hud-value mono">{item.text}</span>
                <Bar ratio={item.ratio} tone={item.ok ? 'ok' : 'bad'} label={`${item.label} budget`} />
              </div>
            ))}
            <button className="btn btn-primary hud-launch" disabled={!validation.ok} onClick={onLaunch}>
              {validation.ok ? 'Launch' : `${errors.length} to fix`}
            </button>
          </div>
          {SLOT_ORDER.map((slot) => (
            <fieldset className="slot" key={slot} data-guide={slot === SLOT_ORDER[0] ? 'parts' : undefined}>
              <legend>
                <span className="slot-label">{SLOT_LABELS[slot]}</span>
                <span className="slot-choice">{componentById(design.ids[slot]).name}</span>
                {crew.length > 1 ? <span className="owner">{ownerOf(crew, roleForSlot(slot))}</span> : null}
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

        <aside className="build-side" data-guide="budgets">
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

          <div className="launch-block" data-guide="launch">
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

    </>
  );
}
