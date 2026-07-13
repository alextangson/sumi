import { describe, it, expect } from 'vitest';
import { matchFormation, resampleToN } from '../src/engine/resample';
import { createRng } from '../src/engine/rng';
import type { WeightedPt, Pt } from '../src/types';

const threePoints: WeightedPt[] = [
  { x: -0.4, y: -0.4, weight: 1, lvl: 3 },
  { x: 0.0, y: 0.0, weight: 5, lvl: 10 },
  { x: 0.4, y: 0.4, weight: 1, lvl: 20 },
];

// Snap a resampled point back to its nearest source point, ignoring the
// small jitter. The three sources are far apart (>=0.4 spacing), and jitter
// is bounded to +/-0.5/largerDim which for n=100 is tiny, so a nearest-center
// match is unambiguous.
function nearestSourceIndex(p: Pt, sources: WeightedPt[]): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < sources.length; i++) {
    const dx = p.x - sources[i].x;
    const dy = p.y - sources[i].y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

describe('resampleToN', () => {
  it('returns exactly n points for n=100 over a 3-point weighted set', () => {
    const out = resampleToN(threePoints, 100, createRng(1));
    expect(out).toHaveLength(100);
  });

  it('keeps every output point within the normalized [-0.5,0.5] range', () => {
    const out = resampleToN(threePoints, 100, createRng(1));
    for (const p of out) {
      expect(p.x).toBeGreaterThanOrEqual(-0.5);
      expect(p.x).toBeLessThanOrEqual(0.5);
      expect(p.y).toBeGreaterThanOrEqual(-0.5);
      expect(p.y).toBeLessThanOrEqual(0.5);
    }
  });

  it('copies lvl from the chosen source point', () => {
    const out = resampleToN(threePoints, 100, createRng(7));
    const lvls = [3, 10, 20];
    for (const p of out) {
      const src = nearestSourceIndex(p, threePoints);
      expect(p.lvl).toBe(lvls[src]);
    }
  });

  it('is deterministic given the same seed', () => {
    const a = resampleToN(threePoints, 100, createRng(42));
    const b = resampleToN(threePoints, 100, createRng(42));
    expect(b).toEqual(a);
  });

  it('produces different output for a different seed', () => {
    const a = resampleToN(threePoints, 100, createRng(42));
    const b = resampleToN(threePoints, 100, createRng(43));
    expect(b).not.toEqual(a);
  });

  it('picks the heavier-weight point more often than a lighter one', () => {
    const out = resampleToN(threePoints, 100, createRng(3));
    let heavy = 0;
    let lightFirst = 0;
    for (const p of out) {
      const src = nearestSourceIndex(p, threePoints);
      if (src === 1) heavy++;
      if (src === 0) lightFirst++;
    }
    // middle point weight=5 vs first point weight=1 -> roughly 5x.
    expect(heavy).toBeGreaterThan(lightFirst);
  });

  it('returns n zeroed points when the weighted set is empty', () => {
    const out = resampleToN([], 5, createRng(1));
    expect(out).toHaveLength(5);
    for (const p of out) {
      expect(p).toEqual({ x: 0, y: 0, lvl: 0 });
    }
  });
});

describe('matchFormation', () => {
  it('reorders targets to remove long crossing paths', () => {
    const source: Pt[] = [
      { x: -0.4, y: -0.4, lvl: 1 },
      { x: 0.4, y: 0.4, lvl: 2 },
    ];
    const reversedTarget: Pt[] = [
      { x: 0.4, y: 0.4, lvl: 20 },
      { x: -0.4, y: -0.4, lvl: 10 },
    ];

    expect(matchFormation(source, reversedTarget)).toEqual([
      reversedTarget[1],
      reversedTarget[0],
    ]);
  });

  it('preserves every target point exactly once', () => {
    const source: Pt[] = Array.from({ length: 20 }, (_, i) => ({
      x: i / 20 - 0.5,
      y: ((i * 7) % 20) / 20 - 0.5,
      lvl: i,
    }));
    const target = source.slice().reverse();
    const matched = matchFormation(source, target);

    expect(matched).toHaveLength(target.length);
    expect(new Set(matched)).toEqual(new Set(target));
  });
});
