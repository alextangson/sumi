// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { fromImageData, fromImage } from '../src/engine/formations';
import { createRng } from '../src/engine/rng';
import type { PixelBuffer, SampleOpts } from '../src/types';

// Build a WxH RGBA buffer; `inkRows` top rows are black ink, rest is paper bg.
function makeBuffer(w: number, h: number, inkRows: number): PixelBuffer {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const ink = y < inkRows;
      data[i] = ink ? 0 : 244;     // R
      data[i + 1] = ink ? 0 : 243; // G
      data[i + 2] = ink ? 0 : 238; // B
      data[i + 3] = 255;           // A
    }
  }
  return { data, width: w, height: h };
}

const OPTS: SampleOpts = { step: 1, minInk: 0.01, levels: 24 };

describe('fromImageData', () => {
  it('returns exactly n points with valid lvls', () => {
    const buf = makeBuffer(4, 4, 2);
    const pts = fromImageData(buf, 50, OPTS, createRng(7));
    expect(pts.length).toBe(50);
    for (const p of pts) {
      expect(Number.isInteger(p.lvl)).toBe(true);
      expect(p.lvl).toBeGreaterThanOrEqual(0);
      expect(p.lvl).toBeLessThan(OPTS.levels);
      expect(p.x).toBeGreaterThanOrEqual(-0.5);
      expect(p.x).toBeLessThanOrEqual(0.5);
      expect(p.y).toBeGreaterThanOrEqual(-0.5);
      expect(p.y).toBeLessThanOrEqual(0.5);
    }
  });

  it('is deterministic for the same buffer + seed', () => {
    const a = fromImageData(makeBuffer(4, 4, 2), 30, OPTS, createRng(42));
    const b = fromImageData(makeBuffer(4, 4, 2), 30, OPTS, createRng(42));
    expect(a).toEqual(b);
  });

  it('produces different layouts for different seeds', () => {
    const a = fromImageData(makeBuffer(4, 4, 2), 30, OPTS, createRng(1));
    const b = fromImageData(makeBuffer(4, 4, 2), 30, OPTS, createRng(2));
    expect(a).not.toEqual(b);
  });
});

describe('fromImage (jsdom null-ctx fallback)', () => {
  it('returns [] when canvas getContext returns null (jsdom)', () => {
    // jsdom does not implement 2D canvas context, so getContext('2d') returns null.
    const src = document.createElement('canvas');
    const pts = fromImage(src, 100, { levels: 24 }, createRng(1));
    expect(pts).toEqual([]);
  });
});
