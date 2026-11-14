/**
 * CelesTrak GP adapter (OMM JSON).
 * Endpoint documented at https://celestrak.org/NORAD/documentation/gp-data-formats.php
 * CelesTrak serves `Access-Control-Allow-Origin: *`, so a static client can call it.
 */
import type { GpElements } from '../sim/types';
import { fetchJson } from './http';
import { normalizeGp } from './normalize';

export const CELESTRAK_SOURCE = 'CelesTrak GP / OMM JSON';

export function celestrakGpUrl(noradId: number): string {
  return `https://celestrak.org/NORAD/elements/gp.php?CATNR=${noradId}&FORMAT=json`;
}

export async function fetchGp(noradId: number, timeoutMs = 8000): Promise<GpElements> {
  const url = celestrakGpUrl(noradId);
  const payload = await fetchJson(url, timeoutMs);
  return normalizeGp(payload, noradId);
}
