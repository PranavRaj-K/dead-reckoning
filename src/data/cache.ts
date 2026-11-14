/**
 * Local snapshot cache.
 *
 * Snapshots are timestamped so the UI can always show how old the data is.
 * Every access is guarded: private browsing, disabled storage or a corrupt entry
 * must never break the app.
 */
const PREFIX = 'dead-reckoning:v1:';

export interface CacheEntry<T> {
  fetchedAtUtc: string;
  sourceUrl: string;
  payload: T;
}

function storage(): Storage | null {
  try {
    const probe = `${PREFIX}probe`;
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readCache<T>(key: string): CacheEntry<T> | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (!parsed || typeof parsed.fetchedAtUtc !== 'string' || parsed.payload === undefined) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, entry: CacheEntry<T>): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // Quota or private mode: caching is a convenience, not a requirement.
  }
}
