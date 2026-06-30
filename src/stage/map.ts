import type { Rect } from '../types';

export function mapNormalizedToRect(
  pt: { x: number; y: number },
  rect: Rect,
): { x: number; y: number } {
  const s = Math.min(rect.w, rect.h);
  return {
    x: rect.x + rect.w / 2 + pt.x * s,
    y: rect.y + rect.h / 2 + pt.y * s,
  };
}
