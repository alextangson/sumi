/**
 * forms3d.ts — volumetric 3D form generators.
 *
 * All functions return Pt[] with real z values in normalized space
 * (x, y, z roughly within [-0.5, 0.5]). Pure + deterministic given injected rng.
 */

import type { Pt, Rng } from '../types';

export type ColumnOpts = {
  /** Total height of the cylinder (centered on y=0). Default 0.8. */
  height?: number;
  /** Radius of the cylinder cross-section. Default 0.18. */
  radius?: number;
  /**
   * Ink level (0..23) or a function of normalized height t∈[-0.5,0.5].
   * Default 12 (mid-tone). Pass a function for gradient effects, e.g.
   * darker near the bottom: t => Math.floor((t + 0.5) * 23)
   */
  lvl?: number | ((t: number) => number);
};

/**
 * Generate n points filling a vertical cylinder (body-of-revolution).
 *
 * Body-of-revolution math:
 *   - height v ∈ [-height/2, height/2]   → y = v
 *   - angle   θ ∈ [0, 2π)               → x = r·cos(θ), z = r·sin(θ)
 *   - radial  r = radius · √(rand)        → filled disc with uniform area density
 *
 * Why it reads as a coherent solid under yaw rotation:
 *   A yaw of angle α rotates the (x, z) plane: x' = x·cos(α) + z·sin(α),
 *   z' = −x·sin(α) + z·cos(α). A point at (r·cos(θ), v, r·sin(θ)) maps to
 *   (r·cos(θ−α), v, r·sin(θ−α)) — i.e. every point stays on the same cylinder
 *   surface at the same height. The whole column spins as one rigid volume.
 *   Near-side z<0 points project larger under perspective; far-side z>0 project
 *   smaller — you see the characteristic near-big/far-small of a rotating 3D solid.
 */
export function column(n: number, opts?: ColumnOpts, rng?: Rng): Pt[] {
  const height = opts?.height ?? 0.8;
  const radius = opts?.radius ?? 0.18;
  const lvlOpt = opts?.lvl ?? 16;

  // Fallback rng: seeded lcg (deterministic, no external state)
  const rand: Rng = rng ?? (() => {
    let s = 0x9e3779b9 | 0;
    return () => {
      s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) | 0;
      s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) | 0;
      return (s >>> 0) / 4294967296;
    };
  })();

  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const v = (rand() - 0.5) * height;       // y: uniform in [-height/2, height/2]
    const theta = rand() * Math.PI * 2;       // angle: uniform in [0, 2π)
    const r = radius * Math.sqrt(rand());     // radius: sqrt for uniform area density

    const x = r * Math.cos(theta);
    const z = r * Math.sin(theta);
    const y = v;

    const lvl = typeof lvlOpt === 'function'
      ? Math.max(0, Math.min(23, Math.round(lvlOpt(v / height))))
      : lvlOpt;

    pts.push({ x, y, lvl, z });
  }
  return pts;
}

export type Pt3D = { x: number; y: number; z: number; lvl?: number };

export type DoubleHelixOpts = {
  /** Total height of the helix. Default 0.78. */
  height?: number;
  /** Radius from the center axis. Default 0.17. */
  radius?: number;
  /** Number of full turns. Default 2.6. */
  turns?: number;
  /** Fraction of particles used for cross-bar rungs. Default 0.22. */
  rungFraction?: number;
};

/**
 * Generate a recognizable DNA-like double helix with two volumetric strands
 * and connecting rungs. Every point carries real z depth.
 */
export function doubleHelix(n: number, opts?: DoubleHelixOpts, rng?: Rng): Pt[] {
  const height = opts?.height ?? 0.78;
  const radius = opts?.radius ?? 0.17;
  const turns = opts?.turns ?? 2.6;
  const rungFraction = Math.max(0, Math.min(0.45, opts?.rungFraction ?? 0.22));
  const rand = rng ?? (() => {
    let s = 0x7f4a7c15 | 0;
    return () => {
      s = Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) | 0;
      return (s >>> 0) / 4294967296;
    };
  })();

  const rungCount = Math.floor(n * rungFraction);
  const strandCount = n - rungCount;
  const perStrand = Math.max(1, Math.ceil(strandCount / 2));
  const pts: Pt[] = [];

  for (let i = 0; i < strandCount; i++) {
    const strand = i & 1;
    const rank = Math.floor(i / 2);
    const t = Math.min(1, (rank + rand() * 0.35) / perStrand);
    const angle = t * turns * Math.PI * 2 + strand * Math.PI;
    const tube = (rand() - 0.5) * 0.018;
    pts.push({
      x: (radius + tube) * Math.cos(angle),
      y: (t - 0.5) * height + (rand() - 0.5) * 0.012,
      z: (radius + tube) * Math.sin(angle),
      lvl: strand === 0 ? 21 : 16,
    });
  }

  for (let i = 0; i < rungCount; i++) {
    const t = (i + rand()) / Math.max(1, rungCount);
    const angle = t * turns * Math.PI * 2;
    const across = rand() * 2 - 1;
    pts.push({
      x: radius * across * Math.cos(angle),
      y: (t - 0.5) * height + (rand() - 0.5) * 0.008,
      z: radius * across * Math.sin(angle),
      lvl: 11,
    });
  }

  return pts;
}

/**
 * Resample arbitrary 3D points to exactly n, preserving z.
 *
 * Uses stratified sampling (one stratum per output slot) for determinism
 * and even coverage. z is interpolated from the sampled source point plus
 * a small jitter proportional to the typical inter-point z spacing, so the
 * output z spread stays within the input z range.
 *
 * @param pts3d  Source points with x, y, z (and optional lvl)
 * @param n      Target count
 * @param rng    Deterministic RNG (required for determinism)
 */
export function fromPoints3d(pts3d: Pt3D[], n: number, rng: Rng): Pt[] {
  const out: Pt[] = [];

  if (pts3d.length === 0) {
    for (let i = 0; i < n; i++) {
      out.push({ x: 0, y: 0, lvl: 0, z: 0 });
    }
    return out;
  }

  const total = pts3d.length;

  // Jitter grain: spread within a radius proportional to point density
  const grain = 0.5 / Math.sqrt(n);

  // Compute z range for clamping jitter
  let zMin = Infinity, zMax = -Infinity;
  for (const p of pts3d) {
    if (p.z < zMin) zMin = p.z;
    if (p.z > zMax) zMax = p.z;
  }
  const zRange = zMax - zMin;
  // z jitter: proportional to inter-point z spacing but never exceeds range
  const zGrain = Math.min(grain, zRange / Math.max(1, total) * 2);

  for (let i = 0; i < n; i++) {
    // Stratified pick: evenly spread across input array with per-stratum jitter
    const pos = ((i + rng()) / n) * total;
    const idx = Math.min(total - 1, Math.floor(pos));
    const src = pts3d[idx];

    const jx = (rng() - 0.5) * 2 * grain;
    const jy = (rng() - 0.5) * 2 * grain;
    const jz = (rng() - 0.5) * 2 * zGrain;

    const x = Math.min(0.5, Math.max(-0.5, src.x + jx));
    const y = Math.min(0.5, Math.max(-0.5, src.y + jy));
    const z = Math.min(zMax + grain, Math.max(zMin - grain, src.z + jz));
    const lvl = src.lvl ?? 12;

    out.push({ x, y, lvl, z });
  }
  return out;
}
