import { describe, it, expect } from 'vitest';
import { coherentDepth, project3d, withDepth } from '../src/engine/depth';
import { createField } from '../src/engine/field';
import type { Pt } from '../src/types';

describe('coherentDepth', () => {
  it('is deterministic: same (x, y, amplitude) always returns same value', () => {
    const a = coherentDepth(0.1, 0.2, 0.3);
    const b = coherentDepth(0.1, 0.2, 0.3);
    expect(a).toBe(b);
  });

  it('is bounded within approximately [-amplitude, amplitude]', () => {
    const amplitude = 0.3;
    // Sample a grid of normalized points
    for (let i = -5; i <= 5; i++) {
      for (let j = -5; j <= 5; j++) {
        const x = i * 0.1;
        const y = j * 0.1;
        const d = coherentDepth(x, y, amplitude);
        // Sum of |coefficients| = 0.55 + 0.35 + 0.22 = 1.12, so bound is 1.12*amplitude
        expect(Math.abs(d)).toBeLessThanOrEqual(amplitude * 1.15);
      }
    }
  });

  it('is smooth: small position delta → small depth delta', () => {
    const amplitude = 0.3;
    const delta = 0.001;
    const base = coherentDepth(0.2, 0.15, amplitude);
    const dx = coherentDepth(0.2 + delta, 0.15, amplitude);
    const dy = coherentDepth(0.2, 0.15 + delta, amplitude);
    // With max frequency 12, max derivative ≈ 12 * amplitude * 1.12 * delta ≈ 0.004
    expect(Math.abs(dx - base)).toBeLessThan(0.01);
    expect(Math.abs(dy - base)).toBeLessThan(0.01);
  });

  it('returns 0 when amplitude is 0', () => {
    expect(coherentDepth(0.3, -0.2, 0)).toBe(0);
  });

  it('scales linearly with amplitude', () => {
    const x = 0.15, y = -0.1;
    const d1 = coherentDepth(x, y, 1);
    const d2 = coherentDepth(x, y, 2);
    expect(d2).toBeCloseTo(d1 * 2, 10);
  });
});

describe('project3d', () => {
  it('yaw=0 pitch=0 z=0 at pivot returns (pivotX, pivotY, scale=1)', () => {
    const result = project3d(0, 0, 0, 0, 0, 1000, 0, 0);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(0);
    expect(result.scale).toBeCloseTo(1);
  });

  it('yaw=0 pitch=0 with any (x, y, z=0) returns identity mapping', () => {
    const result = project3d(0.3, -0.2, 0, 0, 0, 1000, 0, 0);
    expect(result.x).toBeCloseTo(0.3);
    expect(result.y).toBeCloseTo(-0.2);
    expect(result.scale).toBeCloseTo(1);
  });

  it('positive z and yaw>0 shifts x (parallax effect)', () => {
    const flat = project3d(0, 0, 0, 0.3, 0, 1000);
    const depth = project3d(0, 0, 0.1, 0.3, 0, 1000);
    // z>0 means closer to viewer; yaw rotation should shift x
    expect(depth.x).not.toBeCloseTo(flat.x, 2);
  });

  it('far particle (large +Z2) gets scale < 1; near particle gets scale > 1', () => {
    // Pitch forward to push a point with +z further away (Z2 increases)
    const far = project3d(0, 0, 0.5, 0, 1.0, 1000);
    const near = project3d(0, 0, -0.5, 0, 1.0, 1000);
    expect(far.scale).toBeLessThan(1);
    expect(near.scale).toBeGreaterThan(1);
  });

  it('scale is clamped to [0.72, 1.45]', () => {
    // Extreme near case
    const veryNear = project3d(0, 0, -900, 0, 0, 1000);
    expect(veryNear.scale).toBe(1.45);
    // Extreme far case
    const veryFar = project3d(0, 0, 900, 0, 0, 1000);
    expect(veryFar.scale).toBe(0.72);
  });

  it('pivot offsets result correctly: particle at pivot, z=0, returns pivot unchanged', () => {
    const px = 0.1, py = -0.05;
    const result = project3d(px, py, 0, 0.5, 0.3, 1000, px, py);
    expect(result.x).toBeCloseTo(px);
    expect(result.y).toBeCloseTo(py);
  });

  it('is deterministic: calling twice returns identical values', () => {
    const a = project3d(0.2, -0.1, 0.05, 0.3, 0.15, 1000, 0, 0);
    const b = project3d(0.2, -0.1, 0.05, 0.3, 0.15, 1000, 0, 0);
    expect(a.x).toBe(b.x);
    expect(a.y).toBe(b.y);
    expect(a.scale).toBe(b.scale);
  });
});

describe('withDepth', () => {
  it('returns a new array without mutating input', () => {
    const pts: Pt[] = [{ x: 0.1, y: 0.2, lvl: 0 }];
    const result = withDepth(pts, 0.22);
    expect(result).not.toBe(pts);
    expect(pts[0].z).toBeUndefined();
  });

  it('gives each point a nonzero z derived from its position', () => {
    const pts = [
      { x: 0.1, y: 0.2, lvl: 0 },
      { x: -0.3, y: 0.4, lvl: 1 },
    ];
    const result = withDepth(pts, 0.22);
    expect(result[0].z).toBeDefined();
    expect(result[1].z).toBeDefined();
    // Two different positions must produce different z values
    expect(result[0].z).not.toBeCloseTo(result[1].z as number, 5);
  });

  it('z is position-coherent: same (x,y) always yields same z', () => {
    const pts = [{ x: 0.15, y: -0.1, lvl: 2 }];
    const r1 = withDepth(pts, 0.22);
    const r2 = withDepth(pts, 0.22);
    expect(r1[0].z).toBe(r2[0].z);
  });

  it('preserves x, y, lvl on each point', () => {
    const pts = [{ x: 0.3, y: -0.2, lvl: 7 }];
    const [out] = withDepth(pts, 0.22);
    expect(out.x).toBe(0.3);
    expect(out.y).toBe(-0.2);
    expect(out.lvl).toBe(7);
  });

  it('z=0 when amplitude=0', () => {
    const pts = [{ x: 0.2, y: 0.3, lvl: 0 }];
    const [out] = withDepth(pts, 0);
    expect(out.z).toBe(0);
  });

  it('field step interpolates z between two withDepth formations', () => {
    // Build two tiny formations via withDepth, step at m=0/0.5/1, assert z interpolates.
    const a = withDepth([{ x: -0.2, y: 0.1, lvl: 0 }], 0.22);
    const b = withDepth([{ x: 0.3, y: -0.1, lvl: 2 }], 0.22);
    const field = createField(1, () => 0.5);
    field.setFormation('a', a);
    field.setFormation('b', b);

    const zA = a[0].z ?? 0;
    const zB = b[0].z ?? 0;

    field.step({ from: 'a', to: 'b', m: 0 });
    expect(field.particles[0].z).toBeCloseTo(zA, 10);

    field.step({ from: 'a', to: 'b', m: 1 });
    expect(field.particles[0].z).toBeCloseTo(zB, 10);

    field.step({ from: 'a', to: 'b', m: 0.5 });
    expect(field.particles[0].z).toBeCloseTo((zA + zB) / 2, 10);
  });
});

