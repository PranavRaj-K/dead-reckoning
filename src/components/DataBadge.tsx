import { age, stamp } from '../lib/format';
import type { DataSnapshot } from '../sim/types';

/**
 * LIVE / CACHED / ERROR, spelled out. The summary line is always visible and the
 * disclosure shows the exact source, fetch time and any failure, so a stale
 * snapshot can never pass for live data.
 */
export function DataBadge<T>({ label, data }: { label: string; data: DataSnapshot<T> }) {
  return (
    <details className={`databadge databadge-${data.status}`}>
      <summary>
        <span className="dot" aria-hidden="true" />
        <span className="databadge-label">{label}</span>
        <span className="databadge-status">{data.status.toUpperCase()}</span>
        <span className="databadge-age">{data.status === 'error' ? 'no data' : age(data.ageSeconds)}</span>
      </summary>
      <div className="databadge-body">
        <dl>
          <dt>Status</dt>
          <dd>
            {data.status === 'live'
              ? 'Fetched directly from the public API in this browser session.'
              : data.status === 'cached'
                ? 'Live fetch did not succeed. Showing a previously stored snapshot, not live data.'
                : 'No live response and no usable snapshot.'}
          </dd>
          <dt>Source</dt>
          <dd>{data.sourceName}</dd>
          <dt>Endpoint</dt>
          <dd className="mono break">{data.sourceUrl}</dd>
          <dt>Fetched</dt>
          <dd className="mono">{stamp(data.fetchedAtUtc)}</dd>
          {data.error ? (
            <>
              <dt>Note</dt>
              <dd className="warn-text">{data.error}</dd>
            </>
          ) : null}
        </dl>
      </div>
    </details>
  );
}
