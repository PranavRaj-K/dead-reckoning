import { clock, num, pct } from '../lib/format';
import { batteryUsableWh, currentContact } from '../sim/mission';
import type { MissionState } from '../sim/types';
import { Bar, Sparkline, Stat } from './ui';

export function Telemetry({ state }: { state: MissionState }) {
  const capacity = Math.max(0.01, state.batteryCapacityWh);
  const batteryRatio = state.batteryWh / capacity;
  const usable = batteryUsableWh(state);
  const contact = currentContact(state);
  const samples = state.telemetry;
  const batterySeries = samples.map((sample) => sample.batteryWh / Math.max(0.01, sample.batteryCapacityWh));
  const storedSeries = samples.map((sample) => sample.dataStoredMb);
  const deliveredSeries = samples.map((sample) => sample.dataDeliveredMb);
  const netPowerSeries = samples.map((sample) => sample.powerGenW - sample.powerLoadW);
  const dataRatio = state.dataTargetMb > 0 ? state.dataDeliveredMb / state.dataTargetMb : 0;
  const scienceRatio = state.scienceTarget > 0 ? state.scienceDelivered / state.scienceTarget : 0;

  return (
    <div className="telemetry">
      <div className="stat-grid">
        <div className="stat-block">
          <Stat
            label="Battery"
            value={num(state.batteryWh, 1)}
            unit={`/ ${num(state.batteryCapacityWh, 1)} Wh`}
            tone={batteryRatio < 0.15 ? 'bad' : batteryRatio < 0.3 ? 'warn' : 'ok'}
            hint={`${pct(batteryRatio)} state of charge · ${num(usable, 1)} Wh usable`}
          />
          <Bar ratio={batteryRatio} tone={batteryRatio < 0.15 ? 'bad' : batteryRatio < 0.3 ? 'warn' : 'ok'} label="State of charge" />
        </div>

        <Stat
          label="Power"
          value={`${num(state.powerGenW, 1)} / ${num(state.powerLoadW, 1)}`}
          unit="W"
          tone={state.powerGenW >= state.powerLoadW ? 'ok' : 'warn'}
          hint={state.inSunlight ? 'Solar array lit' : 'Eclipse · heater on'}
        />

        <Stat
          label="Recorder"
          value={num(state.dataStoredMb, 1)}
          unit={`/ ${state.budgets.storageMb} MB`}
          tone={state.dataStoredMb > state.budgets.storageMb * 0.9 ? 'bad' : 'idle'}
          hint="Imagery waiting for a pass"
        />

        <Stat
          label="Downlink"
          value={contact ? num(state.budgets.downlinkKbps * contact.linkQuality, 0) : '0'}
          unit="kbps"
          tone={contact ? 'ok' : 'idle'}
          hint={
            contact
              ? `${contact.stationName} · ends ${clock(contact.endSec)}`
              : state.radioOperational
                ? 'No pass in progress'
                : 'Radio failed'
          }
        />

        <Stat
          label="Science delivered"
          value={num(state.scienceDelivered, 1)}
          unit={`/ ${state.scienceTarget}`}
          tone={scienceRatio >= 1 ? 'ok' : scienceRatio >= 0.5 ? 'warn' : 'bad'}
          hint={`${num(state.scienceCollected, 1)} collected so far`}
        />

        <Stat
          label="Data delivered"
          value={num(state.dataDeliveredMb, 1)}
          unit={`/ ${state.dataTargetMb} MB`}
          tone={dataRatio >= 1 ? 'ok' : dataRatio >= 0.5 ? 'warn' : 'bad'}
          hint={`${num(state.dataGeneratedMb, 1)} MB captured`}
        />
      </div>

      <div className="spark-grid">
        <div className="spark-block">
          <div className="spark-head">
            <span>State of charge</span>
            <span className="mono">{pct(batteryRatio)}</span>
          </div>
          <Sparkline values={batterySeries} min={0} max={1} tone={batteryRatio < 0.2 ? 'bad' : 'ok'} label="Battery state of charge over time" />
        </div>
        <div className="spark-block">
          <div className="spark-head">
            <span>Net power</span>
            <span className="mono">{num(state.powerGenW - state.powerLoadW, 1)} W</span>
          </div>
          <Sparkline values={netPowerSeries} tone="info" label="Net power over time" />
        </div>
        <div className="spark-block">
          <div className="spark-head">
            <span>Recorder backlog</span>
            <span className="mono">{num(state.dataStoredMb, 1)} MB</span>
          </div>
          <Sparkline values={storedSeries} min={0} tone="warn" label="Stored data over time" />
        </div>
        <div className="spark-block">
          <div className="spark-head">
            <span>Delivered data</span>
            <span className="mono">{num(state.dataDeliveredMb, 1)} MB</span>
          </div>
          <Sparkline values={deliveredSeries} min={0} tone="ok" label="Delivered data over time" />
        </div>
      </div>

      <div className="flag-row">
        <span className={`chip ${state.radioOperational ? 'chip-ok' : 'chip-bad'}`}>
          {state.beaconActive ? 'Beacon only' : state.radioOperational ? 'Radio nominal' : 'Radio failed'}
        </span>
        <span className={`chip chip-${state.adcsMode === 'nominal' ? 'ok' : 'warn'}`}>
          ADCS {state.adcsMode} · {num(state.pointingErrorDeg, 2)}°
        </span>
        {state.batteryDegraded ? <span className="chip chip-warn">Battery degraded</span> : null}
        {state.brownout ? <span className="chip chip-bad">Brownout</span> : null}
      </div>
    </div>
  );
}
