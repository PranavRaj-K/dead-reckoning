import { describe, expect, it } from 'vitest';
import { hashSeed, mulberry32, seededUnit } from '../sim/rng';

describe('seeded random helpers', () => {
  it('is stable for the same seed and salt', () => {
    expect(seededUnit(42, 'cloud', 3)).toBe(seededUnit(42, 'cloud', 3));
    expect(hashSeed('dead', 'reckoning')).toBe(hashSeed('dead', 'reckoning'));
  });

  it('separates different salts and seeds', () => {
    expect(seededUnit(42, 'cloud', 3)).not.toBe(seededUnit(42, 'cloud', 4));
    expect(seededUnit(42, 'cloud', 3)).not.toBe(seededUnit(43, 'cloud', 3));
    expect(seededUnit(42, 'a')).not.toBe(seededUnit(42, 'b'));
  });

  it('stays inside [0, 1) and never repeats a mulberry32 stream', () => {
    const next = mulberry32(1234);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i += 1) {
      const value = next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      seen.add(value);
    }
    expect(seen.size).toBe(500);
  });

  it('produces identical streams from identical seeds', () => {
    const a = Array.from({ length: 20 }, mulberry32(7));
    const b = Array.from({ length: 20 }, mulberry32(7));
    expect(a).toEqual(b);
  });

  it('hashes to unsigned 32-bit integers', () => {
    for (const seed of [0, 1, 999, 4_294_967_295]) {
      const hash = hashSeed(seed, 'x');
      expect(Number.isInteger(hash)).toBe(true);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThanOrEqual(4_294_967_295);
    }
  });
});
