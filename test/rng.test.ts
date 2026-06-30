import { describe, it, expect } from 'vitest';
import { createRng } from '../src/engine/rng';

describe('createRng (mulberry32)', () => {
  it('produces an identical sequence for the same seed', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const seqA = Array.from({ length: 16 }, () => a());
    const seqB = Array.from({ length: 16 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('produces a different sequence for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    const seqA = Array.from({ length: 16 }, () => a());
    const seqB = Array.from({ length: 16 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it('returns values in [0,1) for many draws across varied seeds', () => {
    for (const seed of [0, 1, 42, 999, 2147483647, -7]) {
      const rng = createRng(seed);
      for (let i = 0; i < 1000; i++) {
        const v = rng();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    }
  });

  it('advances state on each call (consecutive draws differ)', () => {
    const rng = createRng(777);
    const first = rng();
    const second = rng();
    expect(first).not.toEqual(second);
  });

  it('is referentially the documented mulberry32 stream for seed 1', () => {
    // Hard-pin the first 3 outputs so the implementation can never drift.
    const rng = createRng(1);
    const got = [rng(), rng(), rng()].map((v) => Number(v.toFixed(10)));
    expect(got).toEqual([0.6270739406, 0.0027357212, 0.52744704]);
  });
});
