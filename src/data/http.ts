/** Shared HTTP helper with a hard timeout. Failures surface as thrown Errors. */
export async function fetchJson(url: string, timeoutMs = 8000): Promise<unknown> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
  }
  return response.json() as Promise<unknown>;
}
