import { useMemo } from 'react';
import type { EnvironmentBundle } from '../data/loadEnvironment';
import { age, num, stamp } from '../lib/format';
import { REFERENCE_NORAD_ID, SCENARIO, STATIONS } from '../sim/catalogue';
import { createSatrec, dateAt, orbitStateAt } from '../sim/orbit';
import { Panel } from './ui';

export function Briefing({
  env,
  onStart,
}: {
  env: EnvironmentBundle;
  onStart: () => void;
}) {
  const gp = env.gp.payload;
  const weather = env.weather.payload;

  const orbit = useMemo(() => {
    if (!gp) return null;
    try {
      return orbitStateAt(createSatrec(gp), dateAt(gp.epochUtc, 0));
    } catch {
      return null;
    }
  }, [gp]);

  return (
    <div className="screen briefing">
      <section className="hero">
        <p className="eyebrow">NASA Space Apps 2026 · Mission design &amp; salvage</p>
        <h1>
          Dead
          <br />
          Reckoning
        </h1>
        <p className="lede">
          Design a 3U Earth-observation spacecraft, fly it for six hours against propagated
          orbital geometry, and keep it alive when the hardware starts failing. Every choice
          spends mass, power or money — and every fault traces back to one of them.
        </p>
        <div className="hero-actions">
          <button className="btn btn-primary" onClick={onStart}>
            Design the spacecraft
          </button>
          <a className="btn btn-ghost" href="#reality">
            What is real here?
          </a>
        </div>
        <dl className="hero-facts">
          <div>
            <dt>Mission window</dt>
            <dd className="mono">6 h · 12 scenes</dd>
          </div>
          <div>
            <dt>Mass limit</dt>
            <dd className="mono">{num(SCENARIO.massLimitKg, 1)} kg</dd>
          </div>
          <div>
            <dt>Cost limit</dt>
            <dd className="mono">${num(SCENARIO.costLimitUsd)}</dd>
          </div>
          <div>
            <dt>Injected faults</dt>
            <dd className="mono">3</dd>
          </div>
        </dl>
      </section>

      <div className="brief-grid">
        <Panel
          title="Reference orbit"
          subtitle={gp ? `${gp.objectName} · NORAD ${gp.noradId}` : 'Unavailable'}
          className="col-span-2"
        >
          {gp ? (
            <>
              <dl className="data-list">
                <div>
                  <dt>Element epoch</dt>
                  <dd className="mono">{stamp(gp.epochUtc)}</dd>
                </div>
                <div>
                  <dt>Orbit period</dt>
                  <dd className="mono">{(1440 / gp.meanMotionRevPerDay).toFixed(1)} min</dd>
                </div>
                <div>
                  <dt>Inclination</dt>
                  <dd className="mono">{num(gp.inclinationDeg, 2)}°</dd>
                </div>
                <div>
                  <dt>Altitude at epoch</dt>
                  <dd className="mono">{orbit ? `${num(orbit.altitudeKm)} km` : '—'}</dd>
                </div>
                <div>
                  <dt>Snapshot</dt>
                  <dd>
                    <span className={`status-text s-${env.gp.status}`}>{env.gp.status.toUpperCase()}</span>
                    <span className="dim"> · {age(env.gp.ageSeconds)} old</span>
                  </dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd className="mono small break">{env.gp.sourceUrl}</dd>
                </div>
              </dl>
              <p className="note">
                The spacecraft is fictional. Its sunlight, eclipse, ground-station visibility and
                ground track are propagated with SGP4 from this real element set. The reference
                object is not part of the mission and is not being flown.
              </p>
            </>
          ) : (
            <p className="warn-text">No element set was available. Reload or retry the data fetch.</p>
          )}
        </Panel>

        <Panel title="Space weather" subtitle={weather ? 'NASA DONKI event window' : 'Unavailable'}>
          {weather ? (
            <>
              <div className="weather-strip">
                <div>
                  <span className="stat-label">Flares</span>
                  <span className="stat-value">{weather.flares.length}</span>
                </div>
                <div>
                  <span className="stat-label">Storms</span>
                  <span className="stat-value">{weather.storms.length}</span>
                </div>
                <div>
                  <span className="stat-label">SEP events</span>
                  <span className="stat-value">{weather.seps.length}</span>
                </div>
              </div>
              <p className="note">
                Window {weather.windowStartUtc.slice(0, 10)} to {weather.windowEndUtc.slice(0, 10)}.
                DONKI records are event classes and Kp indices; the game maps them to bounded
                sensor-noise and power penalties. They are not a radiation dose.
              </p>
              {env.weather.error ? <p className="warn-text small">{env.weather.error}</p> : null}
            </>
          ) : (
            <p className="warn-text">No weather snapshot was available.</p>
          )}
        </Panel>

        <Panel title="Ground stations" subtitle="Reference coordinates, 5° elevation mask">
          <ul className="station-list">
            {STATIONS.map((station) => (
              <li key={station.id}>
                <span>{station.name}</span>
                <span className="mono dim">
                  {station.latDeg.toFixed(2)}°, {station.lonDeg.toFixed(2)}°
                </span>
              </li>
            ))}
          </ul>
          <p className="note">
            Passes are geometric visibility only: no terrain mask, refraction, antenna pattern or
            link budget. Link quality is derived from peak elevation.
          </p>
        </Panel>
      </div>

      <section className="reality" id="reality">
        <h2>What is real, what is modelled</h2>
        <div className="reality-grid">
          <div>
            <h3>
              <span className="dot-live" aria-hidden="true" /> Real inputs
            </h3>
            <ul>
              <li>CelesTrak GP/OMM elements for NORAD {REFERENCE_NORAD_ID}, fetched live where possible.</li>
              <li>SGP4 propagation of that orbit for sunlight, eclipse, passes and ground track.</li>
              <li>NASA DONKI flare, geomagnetic-storm and SEP event records for the weather window.</li>
              <li>Solar position from the satellite.js ephemeris, used for the eclipse test.</li>
            </ul>
          </div>
          <div>
            <h3>
              <span className="dot-model" aria-hidden="true" /> Modelled for play
            </h3>
            <ul>
              <li>Component mass, cost, power, storage and data rates are illustrative, order-of-magnitude values.</li>
              <li>Scenes are fixed mission-time windows, not real target coordinates.</li>
              <li>Weather effects are bounded rules (sensor noise, watts, degrees), not physics.</li>
              <li>Cloud cover and risky-recovery rolls use a seeded PRNG, so runs replay exactly.</li>
            </ul>
          </div>
        </div>
        <details className="assumptions">
          <summary>Model assumptions in full</summary>
          <ul>
            <li>Energy is a 10 s step balance: generation minus load, capped by battery capacity. No thermal model.</li>
            <li>Nominal load assumes a 11% radio duty cycle and heater draw only in eclipse.</li>
            <li>Battery usable energy is 80% of rated capacity (depth-of-discharge limit).</li>
            <li>Panel output is derated by 0.9 for orientation, conversion and wiring loss.</li>
            <li>Battery degradation removes 40% of rated capacity and caps discharge at 12 W.</li>
            <li>Scene quality = cloud factor × pointing factor × radiation factor, clamped to 0.05–1.</li>
            <li>The recorder overwrites the oldest stored scene first when full.</li>
            <li>Mission score: science delivered 60%, data delivered 25%, resource stewardship 15%.</li>
            <li>No claim is made that these numbers would fly. This is a teaching model.</li>
          </ul>
        </details>
      </section>

      <section className="callout">
        <p>
          Expect three failures during the six-hour window. Each one has at least two recovery
          paths, and the one you can afford depends on what you launched.
        </p>
        <button className="btn btn-primary" onClick={onStart}>
          Open the workbench
        </button>
      </section>
    </div>
  );
}
