import { describe, it, expect } from 'vitest';
import { samplePixelBuffer } from '../src/engine/sample';
import type { PixelBuffer } from '../src/types';

// Helper: build a width×height all-white RGBA buffer, then paint pixels.
function makeBuffer(width: number, height: number): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  data.fill(255); // white, fully opaque
  return { data, width, height };
}

function setPixel(buf: PixelBuffer, px: number, py: number, r: number, g: number, b: number): void {
  const i = (py * buf.width + px) * 4;
  buf.data[i] = r;
  buf.data[i + 1] = g;
  buf.data[i + 2] = b;
  buf.data[i + 3] = 255;
}

describe('samplePixelBuffer', () => {
  it('returns [] for an all-white buffer', () => {
    const buf = makeBuffer(4, 4);
    const pts = samplePixelBuffer(buf, { step: 1, levels: 24 });
    expect(pts).toEqual([]);
  });

  it('yields exactly one WeightedPt for a single dark pixel with correct normalized x,y and positive weight', () => {
    const buf = makeBuffer(4, 4);
    // Pure black at column 1, row 2 -> darkness = 1, well above minInk.
    setPixel(buf, 1, 2, 0, 0, 0);
    const pts = samplePixelBuffer(buf, { step: 1, levels: 24 });

    expect(pts).toHaveLength(1);
    const pt = pts[0];
    // x = px/width - 0.5 = 1/4 - 0.5 = -0.25
    expect(pt.x).toBeCloseTo(-0.25, 10);
    // y = py/height - 0.5 = 2/4 - 0.5 = 0
    expect(pt.y).toBeCloseTo(0, 10);
    expect(pt.weight).toBeGreaterThan(0);
    // darkness = 1 -> levelOf(1, 24) = 23
    expect(pt.lvl).toBe(23);
  });

  it('skips pixels whose darkness is at or below minInk', () => {
    const buf = makeBuffer(4, 4);
    // luma for (240,240,240) = 240/255 ≈ 0.941 -> darkness ≈ 0.059 < default minInk 0.08
    setPixel(buf, 0, 0, 240, 240, 240);
    const pts = samplePixelBuffer(buf, { levels: 24 }); // default step=2, minInk=0.08
    expect(pts).toEqual([]);
  });

  it('walks the buffer by opts.step (default 2)', () => {
    const buf = makeBuffer(4, 4);
    // Paint every pixel black; with default step=2, only px in {0,2}, py in {0,2} are visited.
    for (let py = 0; py < 4; py++) {
      for (let px = 0; px < 4; px++) {
        setPixel(buf, px, py, 0, 0, 0);
      }
    }
    const pts = samplePixelBuffer(buf, { levels: 24 });
    // 2 columns (0,2) × 2 rows (0,2) = 4 sampled points.
    expect(pts).toHaveLength(4);
  });
});
