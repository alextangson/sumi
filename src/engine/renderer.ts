import type { Particle, Field } from './field';
import type { Palette } from './palette';
import type { Rect } from '../types';
import { mapNormalizedToRect } from '../stage/map';
import { project3d } from './depth';

/** Optional 3D view parameters for perspective rendering. */
export type ViewParams = {
  yaw: number;
  pitch: number;
  /** Focal length in px (default 1000). */
  focal?: number;
  /** Pivot in normalized space (default 0, formation center). */
  pivotX?: number;
  pivotY?: number;
};

export type ParticleShape = 'square' | 'round' | 'soft';

export type Ctx2D = {
  fillStyle: string;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  drawImage(image: HTMLCanvasElement, dx: number, dy: number): void;
};

/**
 * Pre-render one offscreen sprite canvas per palette level.
 * Returns an empty array when offscreen canvas is unavailable (e.g. jsdom).
 */
export function buildSprites(
  palette: Palette,
  shape: ParticleShape,
  dpr: number,
): HTMLCanvasElement[] {
  if (typeof document === 'undefined') return [];
  if (shape === 'square') return [];
  const sprites: HTMLCanvasElement[] = [];
  for (let lvl = 0; lvl < palette.levels; lvl++) {
    const size = Math.ceil(palette.sizes[lvl] * dpr);
    const oc = document.createElement('canvas');
    oc.width = size;
    oc.height = size;
    const cx = oc.getContext('2d');
    if (!cx) return []; // jsdom / headless: bail out gracefully
    const r = size / 2;
    const cx_ = r;
    const cy_ = r;
    if (shape === 'round') {
      cx.fillStyle = palette.colors[lvl];
      cx.beginPath();
      cx.arc(cx_, cy_, r, 0, Math.PI * 2);
      cx.fill();
    } else {
      // soft: radial gradient, opaque center → transparent edge
      const grad = cx.createRadialGradient(cx_, cy_, 0, cx_, cy_, r);
      grad.addColorStop(0, palette.colors[lvl]);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      cx.fillStyle = grad;
      cx.beginPath();
      cx.arc(cx_, cy_, r, 0, Math.PI * 2);
      cx.fill();
    }
    sprites.push(oc);
  }
  return sprites;
}

export function bucketize(particles: Particle[]): Particle[] {
  return particles.slice().sort((a, b) => a.lvl - b.lvl);
}

/**
 * Resolve the projected 2D position (and size multiplier) for a particle.
 * When `view` is provided, applies yaw/pitch perspective projection; otherwise
 * falls back to the flat mapNormalizedToRect path (sizeMul = 1).
 */
function resolvePosition(
  p: Particle,
  rect: Rect,
  view?: ViewParams,
): { x: number; y: number; sizeMul: number } {
  if (view) {
    const focal = view.focal ?? 1.8;
    const pivotX = view.pivotX ?? 0;
    const pivotY = view.pivotY ?? 0;
    const proj = project3d(p.x, p.y, p.z, view.yaw, view.pitch, focal, pivotX, pivotY);
    const mapped = mapNormalizedToRect(proj, rect);
    return { x: mapped.x, y: mapped.y, sizeMul: proj.scale };
  }
  const mapped = mapNormalizedToRect(p, rect);
  return { x: mapped.x, y: mapped.y, sizeMul: 1 };
}

export function draw(
  ctx: Ctx2D,
  field: Field,
  palette: Palette,
  rect: Rect,
  dpr: number,
  shape: ParticleShape = 'square',
  sprites: HTMLCanvasElement[] = [],
  view?: ViewParams,
): void {
  ctx.clearRect(rect.x * dpr, rect.y * dpr, rect.w * dpr, rect.h * dpr);
  const sorted = bucketize(field.particles);

  if (shape === 'square' || sprites.length === 0) {
    // Fast fillRect path (also fallback when no sprites).
    // Color buckets are batched by level; perspective only changes position + size.
    let cur = -1;
    for (const p of sorted) {
      if (p.lvl !== cur) {
        cur = p.lvl;
        ctx.fillStyle = palette.colors[cur];
      }
      const { x, y, sizeMul } = resolvePosition(p, rect, view);
      const size = palette.sizes[cur] * sizeMul;
      ctx.fillRect(x * dpr, y * dpr, size * dpr, size * dpr);
    }
  } else {
    // Sprite path: drawImage the pre-rendered offscreen canvas per particle.
    for (const p of sorted) {
      const sprite = sprites[p.lvl];
      if (!sprite) continue;
      const { x, y, sizeMul } = resolvePosition(p, rect, view);
      const halfSize = sprite.width * 0.5 * sizeMul;
      ctx.drawImage(sprite, x * dpr - halfSize, y * dpr - halfSize);
    }
  }
}
