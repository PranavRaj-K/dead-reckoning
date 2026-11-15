import type { ReactNode } from 'react';

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = '',
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actions ? <div className="panel-actions">{actions}</div> : null}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}

/** Detail on demand: the caveat stays one tap away instead of a paragraph on screen. */
export function Info({ label = 'Details', children }: { label?: string; children: ReactNode }) {
  return (
    <details className="info">
      <summary>
        <span className="info-dot" aria-hidden="true">i</span>
        {label}
      </summary>
      <div className="info-body">{children}</div>
    </details>
  );
}

export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'idle';

export function Bar({
  ratio,
  tone = 'ok',
  label,
}: {
  ratio: number;
  tone?: Tone;
  label?: string;
}) {
  const width = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div
      className={`bar bar-${tone}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(width)}
    >
      <span className="bar-fill" style={{ width: `${width}%` }} />
    </div>
  );
}

export function Stat({
  label,
  value,
  unit,
  tone = 'idle',
  hint,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: Tone;
  hint?: string;
}) {
  return (
    <div className={`stat stat-${tone}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">
        {value}
        {unit ? <small>{unit}</small> : null}
      </span>
      {hint ? <span className="stat-hint">{hint}</span> : null}
    </div>
  );
}

export function Chip({
  children,
  tone = 'idle',
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return <span className={`chip chip-${tone}`}>{children}</span>;
}

/** Small inline chart. Enough for a trend, cheap enough to redraw every tick. */
export function Sparkline({
  values,
  min,
  max,
  tone = 'ok',
  label,
}: {
  values: number[];
  min?: number;
  max?: number;
  tone?: Tone;
  label: string;
}) {
  const width = 180;
  const height = 44;
  if (values.length < 2) {
    return <div className="spark spark-empty" aria-label={`${label}: not enough samples yet`} />;
  }
  const lo = min ?? Math.min(...values);
  const hi = max ?? Math.max(...values);
  const span = hi - lo || 1;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - lo) / span) * (height - 4) - 2;
    return `${x.toFixed(1)},${Math.max(2, Math.min(height - 2, y)).toFixed(1)}`;
  });
  return (
    <svg
      className={`spark spark-${tone}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      <polyline points={points.join(' ')} fill="none" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
