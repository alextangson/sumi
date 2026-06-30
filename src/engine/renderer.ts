import type { Particle, Field } from './field';
import type { Palette } from './palette';
import type { Rect } from '../types';
import { mapNormalizedToRect } from '../stage/map';

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

export function draw(
  ctx: Ctx2D,
  field: Field,
  palette: Palette,
  rect: Rect,
  dpr: number,
  shape: ParticleShape = 'square',
  sprites: HTMLCanvasElement[] = [],
): void {
  ctx.clearRect(rect.x * dpr, rect.y * dpr, rect.w * dpr, rect.h * dpr);
  const sorted = bucketize(field.particles);

  if (shape === 'square' || sprites.length === 0) {
    // Original fast fillRect path (also used as fallback when no sprites)
    let cur = -1;
    for (const p of sorted) {
      if (p.lvl !== cur) {
        cur = p.lvl;
        ctx.fillStyle = palette.colors[cur];
      }
      const { x, y } = mapNormalizedToRect(p, rect);
      const size = palette.sizes[cur];
      ctx.fillRect(x * dpr, y * dpr, size * dpr, size * dpr);
    }
  } else {
    // Sprite path: drawImage the pre-rendered offscreen canvas per particle
    for (const p of sorted) {
      const sprite = sprites[p.lvl];
      if (!sprite) continue;
      const { x, y } = mapNormalizedToRect(p, rect);
      const halfSize = sprite.width * 0.5;
      ctx.drawImage(sprite, x * dpr - halfSize, y * dpr - halfSize);
    }
  }
}
