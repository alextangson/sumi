import type { Particle, Field } from './field';
import type { Palette } from './palette';
import type { Rect } from '../types';
import { mapNormalizedToRect } from '../stage/map';

export type Ctx2D = {
  fillStyle: string;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
};

export function bucketize(particles: Particle[]): Particle[] {
  return particles.slice().sort((a, b) => a.lvl - b.lvl);
}

export function draw(
  ctx: Ctx2D,
  field: Field,
  palette: Palette,
  rect: Rect,
  dpr: number,
): void {
  ctx.clearRect(rect.x * dpr, rect.y * dpr, rect.w * dpr, rect.h * dpr);
  const sorted = bucketize(field.particles);
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
}
