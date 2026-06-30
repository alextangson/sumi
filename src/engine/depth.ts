/**
 * depth.ts — coherent 3D depth field + perspective projection helpers.
 * Pure functions; no Math.random; deterministic given position.
 */

/**
 * Assign a smooth depth value to a normalized point (x, y in [-0.5, 0.5]).
 * Multi-frequency sin field ensures spatial coherence: nearby points get
 * similar z values, giving the formation a continuous 3D relief rather than
 * scattered noise.
 *
 * Bounded output: approximately [-amplitude, amplitude].
 * The three frequencies use incommensurable phase offsets so patterns don't
 * repeat at small scale.
 */
export function coherentDepth(x: number, y: number, amplitude: number): number {
  return amplitude * (
    Math.sin(x * 7.5 + y * 2.5) * 0.55 +
    Math.sin(x * 3 - y * 6.5 + 1.3) * 0.35 +
    Math.sin(y * 12 + x * 1.5) * 0.22
  );
}

import type { Pt } from '../types';

/**
 * Return a new array of points with `z` populated via coherentDepth.
 * Pure and deterministic — same input always yields same output.
 * x/y/lvl are preserved unchanged.
 */
export function withDepth(pts: Pt[], amplitude: number): Pt[] {
  return pts.map((p) => ({ ...p, z: (p.z ?? 0) + coherentDepth(p.x, p.y, amplitude) }));
}

export type ProjectionResult = { x: number; y: number; scale: number };

/**
 * Project a 3D point (x, y, z) in normalized space through yaw/pitch rotation
 * and perspective divide. Returns the projected (x, y) and a size multiplier.
 *
 * Rotation order: yaw about vertical (Y) axis first, then pitch about horizontal
 * (X) axis. Pivot at (pivotX, pivotY) in normalized space (defaults to 0,0).
 *
 * @param x      normalized x [-0.5, 0.5]
 * @param y      normalized y [-0.5, 0.5]
 * @param z      depth (negative = toward viewer / nearer; positive = away from viewer / farther)
 * @param yaw    rotation about vertical axis (radians)
 * @param pitch  rotation about horizontal axis (radians)
 * @param focal  focal length (default 1000, in same units as normalized coords
 *               scaled to screen — caller typically passes focal in px)
 * @param pivotX pivot x in normalized space (default 0)
 * @param pivotY pivot y in normalized space (default 0)
 */
export function project3d(
  x: number,
  y: number,
  z: number,
  yaw: number,
  pitch: number,
  focal: number,
  pivotX = 0,
  pivotY = 0,
): ProjectionResult {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);

  // Translate to pivot-relative space
  const ex = x - pivotX;
  const Yv = y - pivotY;

  // Rotate about vertical (Y) axis by yaw
  const X1 = ex * cy + z * sy;
  const Z1 = -ex * sy + z * cy;

  // Rotate about horizontal (X) axis by pitch
  const Yr = Yv * cp - Z1 * sp;
  const Z2 = Yv * sp + Z1 * cp;

  // Perspective divide
  const persp = focal / (focal + Z2);

  // Clamp size multiplier: near-big / far-small
  const scale = Math.max(0.72, Math.min(1.45, persp));

  return {
    x: pivotX + X1 * persp,
    y: pivotY + Yr * persp,
    scale,
  };
}
