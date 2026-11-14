import { clock, num, pct, stamp } from '../lib/format';
import { componentById } from '../sim/catalogue';
import { FAULTS } from '../sim/salvage';
import type { MissionResult, MissionState, RunRecord } from '../sim/types';
import { Bar, Chip, Panel } from './ui';

function verdictCopy(result: MissionResult): string {
  if (result.status === 'SUCCESS') {
    return 'Both mission targets met. The design carried enough power, storage and downlink to finish the job.';
  }
  if (result.status === 'PARTIAL') {
    return 'The mission returned useful science but missed at least one target. Something in the design or the recovery choices cost you data.';
  }
  return result.failureReason ?? 'The mission did not return enough science to be worth the launch.';
}

export function Debrief({
  mission,
  result,
  runs,
  onRestart,
  onNewDesign,
}: {
  mission: MissionState;
  result: MissionResult;
  runs: RunRecord[];
  onRestart: () => void;
  onNewDesign: () => void;
}) {
  const gradeTone = result.grade === 'A' || result.grade === 'B' ? 'ok' : result.grade === 'C' ? 'warn' : 'bad';
  const faultsApplied = mission.faults.filter((fault) => fault.status !== 'pending');
  const loudest = [...mission.causal].sort((a, b) => a.t - b.t);

  return (
    <div className="screen debrief">
      <section className={`verdict verdict-${gradeTone}`}>
        <div className="verdict-grade">
          <span className="eyebrow">Mission grade</span>
          <strong>{result.grade}</strong>
          <span className="mono">{num(result.score, 1)} / 100</span>
        </div>
        <div className="verdict-body">
          <div className="verdict-head">
            <h1>{result.status}</h1>
            <Chip tone={gradeTone}>{mission.status === 'failed' ? 'spacecraft lost' : 'window closed'}</Chip>
          </div>
          <p>{verdictCopy(result)}</p>
          <dl className="verdict-facts">
            <div>
              <dt>Science delivered</dt>
              <dd className="mono">
                {num(result.scienceDelivered, 1)} / {result.scienceTarget}
              </dd>
            </div>
            <div>
              <dt>Data delivered</dt>
              <dd className="mono">
                {num(result.dataDeliveredMb, 1)} / {result.dataTargetMb} Mb
              </dd>
            </div>
            <div>
              <dt>Scenes</dt>
              <dd className="mono">
                {result.scenesStored} stored · {result.scenesLost} lost · {result.scenesSkipped} skipped
              </dd>
            </div>
            <div>
              <dt>Faults resolved</dt>
              <dd className="mono">
                {mission.faults.filter((fault) => fault.status === 'mitigated').length} / {faultsApplied.length}
              </dd>
            </div>
          </dl>
          <div className="verdict-actions">
            <button className="btn btn-primary" onClick={onRestart}>
              Fly this mission again
            </button>
            <button className="btn btn-ghost" onClick={onNewDesign}>
              Change the design
            </button>
          </div>
          <p className="note small">
            Same seed and same data reproduce this run exactly. “Fly again” keeps both, so a
            different outcome means a different decision.
          </p>
        </div>
      </section>

      <div className="debrief-grid">
        <Panel title="Score breakdown" subtitle="Science 60% · data 25% · resources 15%">
          <div className="score-row">
            <div className="score-head">
              <span>Science delivered</span>
              <span className="mono">{num(result.components.science, 1)} / 100</span>
            </div>
            <Bar ratio={result.components.science / 100} tone="ok" label="Science component" />
            <p className="budget-note">
              {num(result.scienceDelivered, 1)} of {result.scienceTarget} target ·{' '}
              {num(result.scienceCollected, 1)} collected before downlink losses
            </p>
          </div>
          <div className="score-row">
            <div className="score-head">
              <span>Data delivered</span>
              <span className="mono">{num(result.components.data, 1)} / 100</span>
            </div>
            <Bar ratio={result.components.data / 100} tone="info" label="Data component" />
            <p className="budget-note">
              {num(result.dataDeliveredMb, 1)} of {result.dataTargetMb} Mb ·{' '}
              {num(result.dataGeneratedMb, 1)} Mb captured
            </p>
          </div>
          <div className="score-row">
            <div className="score-head">
              <span>Resource stewardship</span>
              <span className="mono">{num(result.components.resources, 1)} / 100</span>
            </div>
            <Bar ratio={result.components.resources / 100} tone="warn" label="Resource component" />
            <p className="budget-note">
              Mass margin {num(mission.budgets.massMarginKg, 2)} kg · energy margin{' '}
              {num(mission.budgets.energyMarginW, 1)} W · final battery{' '}
              {pct(result.batteryFinalRatio)}
            </p>
          </div>
        </Panel>

        <Panel title="Mission state at close" subtitle={`T+${clock(mission.t)} of ${clock(mission.durationSec)}`}>
          <dl className="data-list">
            <div>
              <dt>Final battery</dt>
              <dd className="mono">
                {num(mission.batteryWh, 1)} / {num(mission.batteryCapacityWh, 1)} Wh
              </dd>
            </div>
            <div>
              <dt>Recorder at close</dt>
              <dd className="mono">{num(mission.dataStoredMb, 1)} Mb undelivered</dd>
            </div>
            <div>
              <dt>Pointing error</dt>
              <dd className="mono">{num(mission.pointingErrorDeg, 2)}°</dd>
            </div>
            <div>
              <dt>Radio</dt>
              <dd>{mission.beaconActive ? 'Beacon only' : mission.radioOperational ? 'Nominal' : 'Failed'}</dd>
            </div>
            <div>
              <dt>Run seed</dt>
              <dd className="mono">{mission.seed}</dd>
            </div>
            <div>
              <dt>Element epoch</dt>
              <dd className="mono">{stamp(mission.epochUtc)}</dd>
            </div>
          </dl>
          <div className="fault-summary">
            {mission.faults.map((fault) => (
              <div key={fault.id} className="fault-line">
                <Chip tone={fault.status === 'mitigated' ? 'ok' : fault.status === 'lost' ? 'bad' : 'warn'}>
                  {fault.status}
                </Chip>
                <span>{FAULTS[fault.id].shortTitle}</span>
                <span className="mono dim">
                  {fault.appliedAtSec === null ? '—' : `T+${clock(fault.appliedAtSec)}`}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Causal timeline" subtitle="Design choices, faults and recovery, in the order they happened">
        <ol className="causal">
          {loudest.map((event) => (
            <li key={event.id} className={`causal-item causal-${event.severity}`}>
              <span className="causal-t mono">{clock(event.t)}</span>
              <span className="causal-marker" aria-hidden="true" />
              <span className="causal-text">
                <span className="causal-kind">{event.kind}</span>
                <strong>{event.title}</strong>
                {event.detail ? <em>{event.detail}</em> : null}
              </span>
            </li>
          ))}
        </ol>
      </Panel>

      <div className="debrief-grid">
        <Panel title="Salvage decisions" subtitle="What each fault cost">
          {result.salvage.length === 0 ? (
            <p className="dim">No recovery decisions were recorded.</p>
          ) : (
            <ul className="salvage-list">
              {result.salvage.map((decision, index) => (
                <li key={`${decision.faultId}-${index}`}>
                  <span className="mono dim">T+{clock(decision.atSec)}</span>
                  <span>
                    <strong>{decision.actionLabel}</strong>
                    <em>{decision.note}</em>
                  </span>
                  <Chip tone={decision.outcome === 'risk-failed' ? 'bad' : 'ok'}>{decision.outcome}</Chip>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Design flown" subtitle={`Seed ${mission.seed}`}>
          <dl className="data-list">
            <div>
              <dt>Instrument</dt>
              <dd>{componentById(mission.design.ids.instrument).name}</dd>
            </div>
            <div>
              <dt>Attitude control</dt>
              <dd>{componentById(mission.design.ids.adcs).name}</dd>
            </div>
            <div>
              <dt>Radio / antenna</dt>
              <dd>
                {componentById(mission.design.ids.radio).name} /{' '}
                {componentById(mission.design.ids.antenna).name}
              </dd>
            </div>
            <div>
              <dt>Power / battery</dt>
              <dd>
                {componentById(mission.design.ids.power).name} /{' '}
                {componentById(mission.design.ids.battery).name}
              </dd>
            </div>
            <div>
              <dt>Mass / cost</dt>
              <dd className="mono">
                {num(mission.budgets.massKg, 2)} kg · ${num(mission.budgets.costUsd)}
              </dd>
            </div>
            <div>
              <dt>Risk posture</dt>
              <dd>{mission.design.riskPosture}</dd>
            </div>
            <div>
              <dt>Backup beacon</dt>
              <dd>{mission.design.beacon ? 'Fitted' : 'Not fitted'}</dd>
            </div>
          </dl>
        </Panel>
      </div>

      <Panel
        title="Compare runs"
        subtitle={runs.length > 0 ? `Stored in this browser · ${runs.length} run(s)` : 'No runs stored yet'}
      >
        {runs.length === 0 ? (
          <p className="dim">Finish a run and it is stored here for comparison.</p>
        ) : (
          <div className="table-wrap">
            <table className="run-table">
              <thead>
                <tr>
                  <th scope="col">Finished</th>
                  <th scope="col">Seed</th>
                  <th scope="col">Instrument</th>
                  <th scope="col">Radio</th>
                  <th scope="col">Grade</th>
                  <th scope="col">Score</th>
                  <th scope="col">Science</th>
                  <th scope="col">Data</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run, index) => (
                  <tr key={`${run.finishedAtUtc}-${index}`}>
                    <td className="mono">{stamp(run.finishedAtUtc).slice(5)}</td>
                    <td className="mono">{run.seed}</td>
                    <td>{componentById(run.design.ids.instrument).name}</td>
                    <td>{componentById(run.design.ids.radio).name}</td>
                    <td className="mono">{run.result.grade}</td>
                    <td className="mono">{num(run.result.score, 1)}</td>
                    <td className="mono">{num(run.result.scienceDelivered, 1)}</td>
                    <td className="mono">{num(run.result.dataDeliveredMb, 1)}</td>
                    <td>{run.result.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <details className="assumptions">
        <summary>Data provenance and model assumptions</summary>
        <ul>
          {mission.provenance.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <ul>
          <li>Component mass, cost, power and data figures are educational values, not flight specifications.</li>
          <li>Orbital geometry is SGP4 propagation of the reference element set; the spacecraft itself is fictional.</li>
          <li>Weather effects are bounded rules applied to real DONKI event records, not a radiation model.</li>
          <li>Scoring weights: science 60%, data 25%, resource stewardship 15%.</li>
        </ul>
      </details>
    </div>
  );
}
