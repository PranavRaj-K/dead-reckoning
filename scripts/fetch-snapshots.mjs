#!/usr/bin/env node
/**
 * Refreshes the bundled offline snapshots used by Dead Reckoning.
 *
 * Usage: node scripts/fetch-snapshots.mjs [--days 30] [--norad 40697]
 *
 * Writes one envelope per source into src/data/snapshots/:
 *   { fetchedAtUtc, sourceUrl, payload }
 *
 * A source that fails is written with payload: null so the app can report a
 * genuine ERROR state instead of silently inventing data. Never commit a
 * hand-edited payload here - it must come from the live API.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'src', 'data', 'snapshots');

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const days = Number(argValue('--days', '30'));
const norad = argValue('--norad', '40697');
const apiKey = process.env.NASA_API_KEY || 'DEMO_KEY';

/** Snapshot files are committed, so a personal key must never be written into them. */
const publicUrl = (url) =>
  url.replace(/api_key=[^&]*/, `api_key=${apiKey === 'DEMO_KEY' ? 'DEMO_KEY' : 'REDACTED'}`);

const iso = (d) => d.toISOString().slice(0, 10);
const endDate = iso(new Date());
const startDate = iso(new Date(Date.now() - days * 86_400_000));

const sources = [
  {
    file: 'celestrak-gp.json',
    url: `https://celestrak.org/NORAD/elements/gp.php?CATNR=${norad}&FORMAT=json`,
  },
  {
    file: 'donki-gst.json',
    url: `https://api.nasa.gov/DONKI/GST?startDate=${startDate}&endDate=${endDate}&api_key=${apiKey}`,
  },
  {
    file: 'donki-sep.json',
    url: `https://api.nasa.gov/DONKI/SEP?startDate=${startDate}&endDate=${endDate}&api_key=${apiKey}`,
  },
  {
    file: 'donki-flr.json',
    url: `https://api.nasa.gov/DONKI/FLR?startDate=${startDate}&endDate=${endDate}&api_key=${apiKey}`,
  },
];

await mkdir(outDir, { recursive: true });

for (const source of sources) {
  const fetchedAtUtc = new Date().toISOString();
  try {
    const response = await fetch(source.url, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    await writeFile(
      join(outDir, source.file),
      JSON.stringify({ fetchedAtUtc, sourceUrl: publicUrl(source.url), payload }, null, 2) + '\n',
      'utf8',
    );
    console.log(`ok    ${source.file} (${JSON.stringify(payload).length} bytes)`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await writeFile(
      join(outDir, source.file),
      JSON.stringify({ fetchedAtUtc, sourceUrl: publicUrl(source.url), payload: null, error: message }, null, 2) + '\n',
      'utf8',
    );
    console.warn(`error ${source.file}: ${message}`);
  }
}
