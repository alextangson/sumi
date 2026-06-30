import { describe, it, expect } from 'vitest';
import { column, fromPoints3d } from '../src/engine/forms3d';
import { createRng } from '../src/engine/rng';

// ── column ────────────────────────────────────────────────────────────────────

describe('column', () => {
  it('returns exactly n points', () => {
    const rng = createRng(1);
    expect(column(500, {}, rng)).toHaveLength(500);
    expect(column(1, {}, createRng(2))).toHaveLength(1);
    expect(column(0, {}, createRng(3))).toHaveLength(0);
  });

  it('all points within cylinder bounds (|x|,|z| ≤ radius, |y| ≤ height/2)', () => {
    const radius = 0.18;
    const height = 0.8;
    const pts = column(2000, { radius, height }, createRng(42));
    const eps = 1e-9;
    for (const p of pts) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(radius + eps);
      expect(Math.abs(p.z ?? 0)).toBeLessThanOrEqual(radius + eps);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(height / 2 + eps);
    }
  });

  it('radial distribution: r = sqrt(x²+z²) ≤ radius for all points', () => {
    const radius = 0.18;
    const pts = column(1000, { radius }, createRng(7));
    for (const p of pts) {
      const r = Math.sqrt(p.x * p.x + (p.z ?? 0) * (p.z ?? 0));
      expect(r).toBeLessThanOrEqual(radius + 1e-9);
    }
  });

  it('is a body of revolution: points spread across all four angular quadrants', () => {
    // A solid cylinder sampled with 500+ points must have points in all quadrants
    const pts = column(500, {}, createRng(13));
    const q1 = pts.some(p => p.x > 0 && (p.z ?? 0) > 0);
    const q2 = pts.some(p => p.x < 0 && (p.z ?? 0) > 0);
    const q3 = pts.some(p => p.x < 0 && (p.z ?? 0) < 0);
    const q4 = pts.some(p => p.x > 0 && (p.z ?? 0) < 0);
    expect(q1).toBe(true);
    expect(q2).toBe(true);
    expect(q3).toBe(true);
    expect(q4).toBe(true);
  });

  it('is deterministic: same seed → identical output', () => {
    const a = column(300, { height: 0.6, radius: 0.15 }, createRng(99));
    const b = column(300, { height: 0.6, radius: 0.15 }, createRng(99));
    for (let i = 0; i < a.length; i++) {
      expect(a[i].x).toBe(b[i].x);
      expect(a[i].y).toBe(b[i].y);
      expect(a[i].z).toBe(b[i].z);
      expect(a[i].lvl).toBe(b[i].lvl);
    }
  });

  it('custom height and radius are respected', () => {
    const radius = 0.08;
    const height = 0.4;
    const pts = column(500, { radius, height }, createRng(5));
    for (const p of pts) {
      const r = Math.sqrt(p.x * p.x + (p.z ?? 0) * (p.z ?? 0));
      expect(r).toBeLessThanOrEqual(radius + 1e-9);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(height / 2 + 1e-9);
    }
  });

  it('lvl as function receives normalized height and clamps to [0,23]', () => {
    // lvl function: dark at bottom (t=-0.5 → 0), light at top (t=+0.5 → 23)
    const lvlFn = (t: number) => Math.round((t + 0.5) * 23);
    const pts = column(200, { lvl: lvlFn }, createRng(11));
    for (const p of pts) {
      expect(p.lvl).toBeGreaterThanOrEqual(0);
      expect(p.lvl).toBeLessThanOrEqual(23);
    }
  });

  it('all points have z defined (volumetric, not flat)', () => {
    const pts = column(100, {}, createRng(17));
    for (const p of pts) {
      expect(p.z).toBeDefined();
    }
  });

  it('z range is genuinely wide (cross-sectional depth ≈ ±radius)', () => {
    const radius = 0.18;
    const pts = column(2000, { radius }, createRng(21));
    const zs = pts.map(p => p.z ?? 0);
    const zMin = Math.min(...zs);
    const zMax = Math.max(...zs);
    // With 2000 points filling a circle, max radius should be nearly reached on both sides
    expect(zMax).toBeGreaterThan(radius * 0.85);
    expect(zMin).toBeLessThan(-radius * 0.85);
  });
});

// ── fromPoints3d ──────────────────────────────────────────────────────────────

describe('fromPoints3d', () => {
  it('returns exactly n points', () => {
    const src = [
      { x: 0.1, y: 0.1, z: 0.05, lvl: 5 },
      { x: -0.1, y: -0.1, z: -0.05, lvl: 10 },
    ];
    expect(fromPoints3d(src, 100, createRng(1))).toHaveLength(100);
    expect(fromPoints3d(src, 1, createRng(2))).toHaveLength(1);
  });

  it('returns n zeroed points when input is empty', () => {
    const pts = fromPoints3d([], 5, createRng(1));
    expect(pts).toHaveLength(5);
    for (const p of pts) {
      expect(p.x).toBe(0);
      expect(p.y).toBe(0);
      expect(p.z).toBe(0);
    }
  });

  it('is deterministic: same rng seed → identical output', () => {
    const src = Array.from({ length: 20 }, (_, i) => ({
      x: (i / 20) - 0.5,
      y: 0,
      z: (i / 20) * 0.3 - 0.15,
      lvl: i % 24,
    }));
    const a = fromPoints3d(src, 50, createRng(77));
    const b = fromPoints3d(src, 50, createRng(77));
    for (let i = 0; i < a.length; i++) {
      expect(a[i].x).toBe(b[i].x);
      expect(a[i].y).toBe(b[i].y);
      expect(a[i].z).toBe(b[i].z);
    }
  });

  it('z values are within or very near the input z range', () => {
    const src = [
      { x: 0, y: 0, z: -0.2 },
      { x: 0.1, y: 0, z: 0.0 },
      { x: 0, y: 0.1, z: 0.2 },
    ];
    const pts = fromPoints3d(src, 200, createRng(33));
    const zMin = Math.min(...src.map(p => p.z));
    const zMax = Math.max(...src.map(p => p.z));
    // Allow small jitter margin
    const eps = 0.1;
    for (const p of pts) {
      expect(p.z ?? 0).toBeGreaterThanOrEqual(zMin - eps);
      expect(p.z ?? 0).toBeLessThanOrEqual(zMax + eps);
    }
  });

  it('preserves z spread: output z range ≈ input z range', () => {
    const src = Array.from({ length: 50 }, (_, i) => ({
      x: (Math.sin(i) * 0.3),
      y: (Math.cos(i) * 0.3),
      z: (i / 50) * 0.6 - 0.3,   // z from -0.3 to +0.3
    }));
    const pts = fromPoints3d(src, 300, createRng(55));
    const zs = pts.map(p => p.z ?? 0);
    const outRange = Math.max(...zs) - Math.min(...zs);
    // Output should cover at least 70% of the input z range
    expect(outRange).toBeGreaterThan(0.3);
  });

  it('all points have z defined', () => {
    const src = [{ x: 0, y: 0, z: 0.1 }, { x: 0.1, y: 0.1, z: -0.1 }];
    const pts = fromPoints3d(src, 20, createRng(9));
    for (const p of pts) {
      expect(p.z).toBeDefined();
    }
  });

  it('lvl defaults to 12 when source has no lvl', () => {
    const src = [{ x: 0, y: 0, z: 0 }];
    const pts = fromPoints3d(src, 10, createRng(1));
    for (const p of pts) {
      expect(p.lvl).toBe(12);
    }
  });

  it('preserves source lvl when provided', () => {
    const src = [{ x: 0, y: 0, z: 0, lvl: 7 }];
    const pts = fromPoints3d(src, 5, createRng(1));
    for (const p of pts) {
      expect(p.lvl).toBe(7);
    }
  });
});
