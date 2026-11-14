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

// Relative base so the build works on any static host or subdirectory.
export default defineConfig({
  base: './',
  plugins: [react(), stubSatelliteWasm()],
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
  },
})
