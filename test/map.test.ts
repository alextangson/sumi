import { describe, it, expect } from 'vitest';
import { mapNormalizedToRect } from '../src/stage/map';
import type { Rect } from '../src/types';

describe('mapNormalizedToRect', () => {
  it('maps center pt {0,0} to the rect center', () => {
    const rect: Rect = { x: 10, y: 20, w: 100, h: 60 };
    const out = mapNormalizedToRect({ x: 0, y: 0 }, rect);
    expect(out.x).toBeCloseTo(rect.x + rect.w / 2); // 60
    expect(out.y).toBeCloseTo(rect.y + rect.h / 2); // 50
  });

  it('contain-fits using the shorter side: pt {0.5,0} -> x + w/2 + 0.5*min(w,h)', () => {
    const rect: Rect = { x: 10, y: 20, w: 100, h: 60 };
    const s = Math.min(rect.w, rect.h); // 60
    const out = mapNormalizedToRect({ x: 0.5, y: 0 }, rect);
    expect(out.x).toBeCloseTo(rect.x + rect.w / 2 + 0.5 * s); // 10 + 50 + 30 = 90
    expect(out.y).toBeCloseTo(rect.y + rect.h / 2); // 50
  });

  it('scales y by the same shorter side: pt {0,0.5} -> y + h/2 + 0.5*min(w,h)', () => {
    const rect: Rect = { x: 0, y: 0, w: 200, h: 80 };
    const s = Math.min(rect.w, rect.h); // 80
    const out = mapNormalizedToRect({ x: 0, y: 0.5 }, rect);
    expect(out.x).toBeCloseTo(100);
    expect(out.y).toBeCloseTo(0 + 40 + 0.5 * s); // 80
  });
});
