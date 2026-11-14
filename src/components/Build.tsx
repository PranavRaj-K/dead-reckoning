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
import { Bar, Panel, type Tone } from './ui';

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

  return (
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
                  return (
                    <label key={spec.id} className={`part ${checked ? 'is-selected' : ''}`}>
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

        <aside className="build-side">
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
  );
}
