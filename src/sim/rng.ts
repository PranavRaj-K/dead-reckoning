/**
 * Deterministic helpers for seeded scenarios.
 *
 * The mission never uses Math.random(). Every stochastic outcome (cloud cover,
 * risky recovery attempts) is a pure function of the mission seed, so the same
 * seed and the same input snapshots always reproduce the same run.
 */

/** FNV-1a based seed mixer, stable across platforms. */
export function hashSeed(...parts: (string | number)[]): number {
  let hash = 0x811c9dc5;
  for (const part of parts) {
    const text = String(part);
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    hash ^= 0x2f;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: small, fast, deterministic 32-bit PRNG. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable 0..1 draw for one labelled decision in one seeded run. */
export function seededUnit(seed: number, ...salt: (string | number)[]): number {
  return mulberry32(hashSeed(seed, ...salt))();
}
