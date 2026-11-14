import { num, pct } from '../lib/format';
import type { OrbitState } from '../sim/types';

const CX = 110;
const CY = 110;
const ORBIT_R = 82;
const EARTH_R = 34;

/**
 * Schematic Earth/sun geometry from the propagated ECI position. Angles are real;
 * the drawing is deliberately not to scale and labelled as such.
 */
export function OrbitView({ state }: { state: OrbitState }) {
  const sunDeg = (-state.sunAngleRad * 180) / Math.PI;
  const cos = Math.cos(state.eciAngleRad);
  const sin = Math.sin(state.eciAngleRad);
  const satX = CX + ORBIT_R * cos;
  const satY = CY - ORBIT_R * sin;
  const sunX = CX + 118 * Math.cos(state.sunAngleRad);
  const sunY = CY - 118 * Math.sin(state.sunAngleRad);

  const rays = [-24, 0, 24].map((offset) => {
    const angle = ((state.sunAngleRad * 180) / Math.PI + offset) * (Math.PI / 180);
    const dx = Math.cos(angle);
    const dy = -Math.sin(angle);
    return {
      x1: CX + 62 * dx - dy * 16,
      y1: CY + 62 * dy + dx * 16,
      x2: CX + 78 * dx - dy * 16,
      y2: CY + 78 * dy + dx * 16,
    };
  });

  return (
    <div className="orbit">
      <svg viewBox="0 0 220 220" className="orbit-svg" role="img" aria-label="Schematic orbit and Sun geometry">
        <defs>
          <radialGradient id="earth-fill" cx="38%" cy="32%" r="78%">
            <stop offset="0%" stopColor="#2a6f8f" />
            <stop offset="55%" stopColor="#12384f" />
            <stop offset="100%" stopColor="#061420" />
          </radialGradient>
          <clipPath id="night-clip">
            <rect
              x={CX - EARTH_R}
              y={CY - EARTH_R}
              width={EARTH_R}
              height={EARTH_R * 2}
              transform={`rotate(${sunDeg} ${CX} ${CY})`}
            />
          </clipPath>
        </defs>

        {rays.map((ray, index) => (
          <line
            key={index}
            x1={ray.x1}
            y1={ray.y1}
            x2={ray.x2}
            y2={ray.y2}
            className="orbit-ray"
          />
        ))}
        <circle cx={sunX} cy={sunY} r="5" className="orbit-sun" />
        <text x={sunX} y={sunY - 9} className="orbit-caption" textAnchor="middle">
          SUN
        </text>

        <circle cx={CX} cy={CY} r={ORBIT_R} className="orbit-path" />
        <circle cx={CX} cy={CY} r={EARTH_R} fill="url(#earth-fill)" />
        <circle cx={CX} cy={CY} r={EARTH_R} fill="#000" opacity="0.62" clipPath="url(#night-clip)" />
        <ellipse cx={CX} cy={CY} rx={EARTH_R} ry={EARTH_R * 0.34} className="orbit-grid" />
        <ellipse cx={CX} cy={CY} rx={EARTH_R * 0.34} ry={EARTH_R} className="orbit-grid" />

        <circle cx={satX} cy={satY} r="7" className="orbit-sat-glow" />
        <circle cx={satX} cy={satY} r="2.6" className="orbit-sat" />
        <line
          x1={satX}
          y1={satY}
          x2={satX - 9 * sin}
          y2={satY - 9 * cos}
          className="orbit-velocity"
        />
        <text x={CX} y={208} className="orbit-caption" textAnchor="middle">
          schematic · not to scale
        </text>
      </svg>

      <dl className="orbit-readout">
        <div>
          <dt>State</dt>
          <dd className={state.inSunlight ? 'ok-text' : 'warn-text'}>
            {state.inSunlight ? 'SUNLIT' : 'ECLIPSE'}
          </dd>
        </div>
        <div>
          <dt>Shadow</dt>
          <dd className="mono">{pct(state.shadowFraction)}</dd>
        </div>
        <div>
          <dt>Altitude</dt>
          <dd className="mono">{num(state.altitudeKm)} km</dd>
        </div>
        <div>
          <dt>Velocity</dt>
          <dd className="mono">{num(state.speedKmPerSec, 2)} km/s</dd>
        </div>
        <div>
          <dt>Ground track</dt>
          <dd className="mono">
            {state.latDeg.toFixed(2)}° / {state.lonDeg.toFixed(2)}°
          </dd>
        </div>
        <div>
          <dt>Radius</dt>
          <dd className="mono">{num(state.radiusEarthRadii, 3)} R⊕</dd>
        </div>
      </dl>
    </div>
  );
}
