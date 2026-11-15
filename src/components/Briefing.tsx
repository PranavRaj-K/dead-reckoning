import { lazy, Suspense, useMemo, useState } from 'react';
import type { EnvironmentBundle } from '../data/loadEnvironment';
import { age, num, stamp } from '../lib/format';
import { DEFAULT_DESIGN, REFERENCE_NORAD_ID, SCENARIO, STATIONS } from '../sim/catalogue';
import { createSatrec, dateAt, orbitStateAt } from '../sim/orbit';
import { WebglBoundary } from '../three/WebglBoundary';
import { webglAvailable } from '../three/util';
import { MissionTimeline } from './MissionTimeline';
import { Info, Panel } from './ui';

const Spacecraft3D = lazy(() => import('../three/Spacecraft3D'));

/** Each claim is a chip; the full sentence is one tap away. */
const REALITY = {
  real: [
    { label: 'Orbit', detail: `CelesTrak GP/OMM elements for NORAD ${REFERENCE_NORAD_ID}, fetched live where possible.` },
    { label: 'SGP4 propagation', detail: 'Sunlight, eclipse, station passes and ground track come from that real orbit.' },
    { label: 'Space weather', detail: 'NASA DONKI flare, geomagnetic-storm and SEP event records.' },
    { label: 'Sun position', detail: 'satellite.js solar ephemeris, used for the eclipse test.' },
  ],
  modelled: [
    { label: 'Part specs', detail: 'Mass, cost, power, storage and data rates are illustrative, order-of-magnitude values.' },
    { label: 'Imaging windows', detail: 'Scenes are fixed mission-time windows, not real target coordinates.' },
    { label: 'Weather effects', detail: 'Bounded rules (sensor noise, watts, degrees), not physics.' },
    { label: 'Dice rolls', detail: 'Cloud cover and risky recoveries use a seeded PRNG, so runs replay exactly.' },
  ],
} as const;

export function Briefing({
  env,
  onStart,
}: {
  env: EnvironmentBundle;
  onStart: () => void;
}) {
  const gp = env.gp.payload;
  const weather = env.weather.payload;
  const [side, setSide] = useState<keyof typeof REALITY>('real');
  const [claim, setClaim] = useState<string | null>(null);
  const [webgl] = useState(webglAvailable);

  const orbit = useMemo(() => {
    if (!gp) return null;
    try {
      return orbitStateAt(createSatrec(gp), dateAt(gp.epochUtc, 0));
    } catch {
      return null;
    }
  }, [gp]);

  const claims = REALITY[side];
  const activeClaim = claims.find((entry) => entry.label === claim) ?? null;

  return (
    <div className="screen briefing">
      <section className="hero">
        <div className="hero-copy">
        <p className="eyebrow">NASA Space Apps 2026 · Mission design &amp; salvage</p>
        <h1>
          Dead
          <br />
          Reckoning
        </h1>
        <p className="lede">Build a CubeSat. Fly it for six hours. Keep it alive when it breaks.</p>
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
        </div>
        {webgl ? (
          <div className="hero-craft" aria-label="3D model of the default spacecraft assembling" role="img">
            <WebglBoundary fallback={null}>
              <Suspense fallback={null}>
                <Spacecraft3D design={DEFAULT_DESIGN} focus={null} runKey={0} />
              </Suspense>
            </WebglBoundary>
          </div>
        ) : null}
      </section>

      <Panel title="Your six hours" subtitle="Image the targets, downlink the data, survive what breaks">
        <MissionTimeline scenario={SCENARIO} />
      </Panel>

      <div className="brief-grid">
        <Panel
          title="Reference orbit"
          subtitle={gp ? `${gp.objectName} · NORAD ${gp.noradId}` : 'Unavailable'}
          actions={<span className={`status-text s-${env.gp.status}`}>{env.gp.status.toUpperCase()}</span>}
        >
          {gp ? (
            <>
              <div className="tile-row">
                <div className="tile">
                  <span className="stat-label">Altitude</span>
                  <span className="stat-value">
                    {orbit ? num(orbit.altitudeKm) : '—'}
                    <small>km</small>
                  </span>
                </div>
                <div className="tile">
                  <span className="stat-label">Period</span>
                  <span className="stat-value">
                    {(1440 / gp.meanMotionRevPerDay).toFixed(1)}
                    <small>min</small>
                  </span>
                </div>
                <div className="tile">
                  <span className="stat-label">Inclination</span>
                  <span className="stat-value">
                    {num(gp.inclinationDeg, 1)}
                    <small>°</small>
                  </span>
                </div>
              </div>
              <Info label="Source and caveats">
                <p>
                  Epoch {stamp(gp.epochUtc)}, {age(env.gp.ageSeconds)} old.
                </p>
                <p className="mono small break">{env.gp.sourceUrl}</p>
                <p>
                  The spacecraft is fictional. Its sunlight, eclipse, station visibility and ground
                  track are propagated with SGP4 from this real element set.
                </p>
              </Info>
            </>
          ) : (
            <p className="warn-text">No element set was available. Reload or retry the data fetch.</p>
          )}
        </Panel>

        <Panel
          title="Space weather"
          subtitle={weather ? 'NASA DONKI, last 30 days' : 'Unavailable'}
          actions={<span className={`status-text s-${env.weather.status}`}>{env.weather.status.toUpperCase()}</span>}
        >
          {weather ? (
            <>
              <div className="tile-row">
                <div className="tile">
                  <span className="stat-label">Flares</span>
                  <span className="stat-value">{weather.flares.length}</span>
                </div>
                <div className="tile">
                  <span className="stat-label">Storms</span>
                  <span className="stat-value">{weather.storms.length}</span>
                </div>
                <div className="tile">
                  <span className="stat-label">SEP</span>
                  <span className="stat-value">{weather.seps.length}</span>
                </div>
              </div>
              {env.weather.error ? <p className="warn-text small">{env.weather.error}</p> : null}
              <Info label="How weather affects the run">
                <p>
                  Window {weather.windowStartUtc.slice(0, 10)} to {weather.windowEndUtc.slice(0, 10)}.
                  DONKI records are event classes and Kp indices. The game maps them to bounded
                  sensor-noise and power penalties, not a radiation dose.
                </p>
              </Info>
            </>
          ) : (
            <p className="warn-text">No weather snapshot was available.</p>
          )}
        </Panel>

        <Panel title="Ground stations" subtitle="Where your data comes down" className="col-span-2">
          <ul className="station-chips">
            {STATIONS.map((station) => (
              <li key={station.id}>
                <span className="station-dot" aria-hidden="true" />
                <strong>{station.name.replace(' (reference site)', '')}</strong>
                <span className="mono dim">
                  {station.latDeg.toFixed(1)}°, {station.lonDeg.toFixed(1)}°
                </span>
              </li>
            ))}
          </ul>
          <Info label="How passes work">
            <p>
              Geometric visibility above a 5° elevation mask. No terrain, refraction or antenna
              pattern. Link quality rises with peak elevation.
            </p>
          </Info>
        </Panel>
      </div>

      <section className="reality" id="reality">
        <div className="reality-head">
          <h2>What is real, what is modelled</h2>
          <div className="segmented" role="tablist" aria-label="Show">
            {(['real', 'modelled'] as const).map((key) => (
              <button
                key={key}
                role="tab"
                aria-selected={side === key}
                className={side === key ? 'is-selected' : ''}
                onClick={() => {
                  setSide(key);
                  setClaim(null);
                }}
              >
                <span className={key === 'real' ? 'dot-live' : 'dot-model'} aria-hidden="true" />
                {key === 'real' ? 'Real inputs' : 'Modelled for play'}
              </button>
            ))}
          </div>
        </div>
        <div className="claim-chips" role="tabpanel">
          {claims.map((entry) => (
            <button
              key={entry.label}
              className={`claim claim-${side} ${claim === entry.label ? 'is-open' : ''}`}
              aria-expanded={claim === entry.label}
              onClick={() => setClaim((current) => (current === entry.label ? null : entry.label))}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <p className="claim-detail" aria-live="polite">
          {activeClaim ? activeClaim.detail : 'Tap a chip to see where it comes from.'}
        </p>
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
        <p>Three failures are coming. What you can do about them depends on what you build.</p>
        <button className="btn btn-primary" onClick={onStart}>
          Open the workbench
        </button>
      </section>
    </div>
  );
}
