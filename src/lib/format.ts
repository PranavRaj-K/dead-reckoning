/** Display formatting. Every number in the UI goes through here. */

export function num(value: number, decimals = 0): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function usd(value: number): string {
  return `$${num(Math.round(value))}`;
}

export function pct(value: number, decimals = 0): string {
  return `${num(value * 100, decimals)}%`;
}

export function clock(tSec: number): string {
  const total = Math.max(0, Math.floor(tSec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((part) => String(part).padStart(2, '0')).join(':');
}

/** `2026-11-14T18:39:31.242Z` -> `2026-11-14 18:39:31Z` */
export function stamp(iso: string): string {
  if (!iso || iso.startsWith('1970')) return 'never';
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)}Z`;
}

export function hhmm(iso: string): string {
  return iso.slice(11, 16);
}

export function age(seconds: number): string {
  if (seconds < 90) return `${Math.round(seconds)} s`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} min`;
  if (seconds < 172800) return `${num(seconds / 3600, 1)} h`;
  return `${num(seconds / 86400, 1)} d`;
}
