import { SLOT_LABELS, componentById } from '../sim/catalogue';
import type { Design, DesignSlot } from '../sim/types';

/**
 * Hand-drawn axonometric spacecraft (no 3D engine). External hardware follows
 * the selected cards; internal bays are dashed cutaways so the drawing never
 * claims an exact engineering placement.
 *
 * Geometry comes from one projection: sx = 0.866 * (x - y), sy = 0.5 * (x + y) - z.
 * Bus is 54 x 42 x 160 units at (x 0..54, y 0..42, z 0..160), offset by (195, 186).
 */
const ANCHORS: Record<DesignSlot, { x: number; y: number; r: number }> = {
  instrument: { x: 182, y: 150, r: 25 },
  adcs: { x: 192, y: 105, r: 19 },
  radio: { x: 224, y: 143, r: 22 },
  antenna: { x: 200, y: 41, r: 21 },
  power: { x: 128, y: 100, r: 36 },
  battery: { x: 195, y: 178, r: 21 },
  bus: { x: 198, y: 188, r: 34 },
};

export function SpacecraftPreview({ design, focus }: { design: Design; focus: DesignSlot }) {
  const hot = (slot: DesignSlot) => (focus === slot ? ' is-hot' : '');
  const anchor = ANCHORS[focus];
  const antennaId = design.ids.antenna;
  const instrumentId = design.ids.instrument;

  return (
    <svg
      className="sc-svg"
      viewBox="88 8 224 238"
      role="img"
      aria-label={`Schematic spacecraft. Highlighted: ${SLOT_LABELS[focus]}, ${componentById(design.ids[focus]).name}`}
    >
      <defs>
        <linearGradient id="sc-top" x1="0" y1="0" x2="0.5" y2="1">
          <stop offset="0" stopColor="#25384f" />
          <stop offset="1" stopColor="#182639" />
        </linearGradient>
        <linearGradient id="sc-right" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#101b2a" />
          <stop offset="1" stopColor="#0a1220" />
        </linearGradient>
        <linearGradient id="sc-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1c2c44" />
          <stop offset="1" stopColor="#0d1626" />
        </linearGradient>
        <linearGradient id="sc-panel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#12304b" />
          <stop offset="1" stopColor="#091a2a" />
        </linearGradient>
      </defs>

      <g className="sc-craft">
        <g className={`sc-wing${hot('power')}`}>
          {/* left array, front plane */}
          <polygon className="sc-panel" points="158.6,152 98,117 98,47 158.6,82" />
          <path className="sc-cell" d="M138.4,140.3V70.3 M118.2,128.7V58.7 M158.6,117 98,82" />
          {/* right array, back plane */}
          <polygon className="sc-panel" points="241.8,158 302.4,193 302.4,123 241.8,88" />
          <path className="sc-cell" d="M262,169.7V99.7 M282.2,181.3V111.3 M241.8,123 302.4,158" />
          <path className="sc-boom" d="M159,82 158.6,152 M241.8,88 241.8,158" />
        </g>

        <g className={`sc-body${hot('bus')}`}>
          <polygon className="sc-face-right" points="242,213 205,234 205,74 242,53" />
          <polygon className="sc-face-front" points="205,234 159,207 159,47 205,74" />
          <polygon className="sc-face-top" points="195,26 242,53 205,74 159,47" />
          <path className="sc-edge" d="M159,47V207 M205,74V234 M242,53V213 M205,234 242,213 M159,207 205,234" />
          <path className="sc-rib" d="M159,167 205,194 M159,87 205,114 M242,173 205,194 M242,93 205,114" />
        </g>

        {/* dashed cutaway: attitude wheels, recorder, battery pack */}
        <g className={`sc-internal${hot('adcs')}`} transform="rotate(30 192 105)">
          <circle cx="185" cy="99" r="4.6" />
          <circle cx="199" cy="99" r="4.6" />
          <circle cx="192" cy="112" r="4.6" />
        </g>
        <g className={`sc-internal${hot('bus')}`}>
          <rect x="202" y="110" width="12" height="16" rx="2" transform="rotate(30 208 118)" />
        </g>
        <g className={`sc-internal${hot('battery')}`}>
          <rect x="182" y="164" width="26" height="28" rx="3" transform="rotate(30 195 178)" />
          <path d="M188,172 202,172 M188,180 202,180" transform="rotate(30 195 178)" />
        </g>

        {/* communications package on the +x face */}
        <g className={`sc-hardware${hot('radio')}`}>
          <polygon points="215.3,131.5 232.7,121.5 232.7,155.5 215.3,165.5" />
          <path d="M218,140 228,134 M218,148 228,142 M218,156 228,150" />
        </g>

        {/* science instrument on the nadir-facing panel */}
        <g className={`sc-instrument${hot('instrument')}`}>
          {instrumentId === 'sensor-therm' ? (
            <>
              <ellipse cx="182" cy="150" rx="17" ry="11" transform="rotate(30 182 150)" />
              <circle cx="175" cy="149" r="2" />
              <circle cx="182" cy="152" r="2" />
              <circle cx="189" cy="155" r="2" />
            </>
          ) : (
            <>
              <ellipse className="sc-rim" cx="182" cy="150" rx="24" ry="16" transform="rotate(30 182 150)" />
              <ellipse className="sc-lens" cx="182" cy="150" rx="12.5" ry="8" transform="rotate(30 182 150)" />
              {instrumentId === 'cam-hr' ? (
                <ellipse className="sc-lens-core" cx="182" cy="150" rx="5.5" ry="3.5" transform="rotate(30 182 150)" />
              ) : null}
            </>
          )}
        </g>

        <g className={`sc-antenna${hot('antenna')}`}>
          {antennaId === 'ant-hga' ? (
            <>
              <path d="M200,50V39" />
              <ellipse cx="200" cy="31" rx="24" ry="9.5" />
              <ellipse cx="200" cy="31" rx="14" ry="5.5" />
            </>
          ) : null}
          {antennaId === 'ant-patch' ? (
            <>
              <polygon points="200,56 210.4,50 200,44 189.6,50" />
              <path d="M195,53 205,47" />
            </>
          ) : null}
          {antennaId === 'ant-dipole' ? (
            <>
              <path d="M200,50V20 M187,26 213,14 M187,14 213,26" />
              <circle cx="200" cy="20" r="1.8" />
            </>
          ) : null}
        </g>

        {design.beacon ? (
          <g className="sc-beacon">
            <path d="M168,49V26" />
            <circle cx="168" cy="24" r="2.3" />
          </g>
        ) : null}

        <g className="sc-focus" aria-hidden="true">
          <circle className="sc-focus-ring" cx={anchor.x} cy={anchor.y} r={anchor.r} />
          <circle className="sc-focus-dot" cx={anchor.x} cy={anchor.y} r="2.6" />
        </g>
      </g>
    </svg>
  );
}
