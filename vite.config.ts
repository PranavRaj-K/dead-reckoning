import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'

/**
 * satellite.js re-exports an optional wasm runtime from its package entry. That
 * runtime spawns a wasm worker whose pthread build uses top-level await and
 * node:worker_threads, which cannot be bundled for the browser. This app only
 * uses the pure-JS SGP4 API (propagate, shadowFraction, sunPos, transforms), so
 * the wasm entry is replaced with a stub and never enters the module graph.
 */
function stubSatelliteWasm(): Plugin {
  const id = '\0satellite-wasm-stub'
  return {
    name: 'stub-satellite-wasm',
    enforce: 'pre',
    resolveId(source, importer) {
      const from = `${source}`.replace(/\\/g, '/')
      const parent = `${importer ?? ''}`.replace(/\\/g, '/')
      if (from === '#wasm-single-thread' || from === '#wasm-multi-thread') return id
      if (parent.includes('satellite.js/dist/') && from.endsWith('wasm/index.js')) return id
      return null
    },
    load(resolved) {
      return resolved === id
        ? 'export default function unavailable() { throw new Error("satellite.js wasm runtime is not bundled") }'
        : null
    },
  }
}

/**
 * Content Security Policy for the production build only: the dev server injects
 * an inline React Refresh script that a strict policy would block. Hosts listed
 * are the only network sources the app uses (CelesTrak, NASA DONKI, NASA GIBS).
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://gibs.earthdata.nasa.gov",
  "font-src 'self'",
  "connect-src 'self' https://celestrak.org https://api.nasa.gov https://gibs.earthdata.nasa.gov",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

function contentSecurityPolicy(): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`)
    },
  }
}

// Relative base so the build works on any static host or subdirectory.
export default defineConfig({
  base: './',
  build: {
    // The lazy three.js chunk (~940 kB) loads only when a 3D view appears; the entry stays ~355 kB.
    chunkSizeWarningLimit: 1000,
  },
  plugins: [react(), stubSatelliteWasm(), contentSecurityPolicy()],
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
  },
})
