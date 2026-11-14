import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'

/**
 * satellite.js exposes an optional wasm runtime whose pthread build uses top-level
 * await and node:worker_threads, which cannot be bundled for the browser. This app
 * only uses the pure-JS SGP4 API, so the wasm entry points resolve to a stub.
 */
function stubSatelliteWasm(): Plugin {
  const id = '\0satellite-wasm-stub'
  return {
    name: 'stub-satellite-wasm',
    resolveId(source) {
      return source === '#wasm-single-thread' || source === '#wasm-multi-thread' ? id : null
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
