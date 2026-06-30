import type { PixelBuffer, Rect, WeightedPt } from '../types';
import { levelOf } from './palette';

/**
 * Compute a contain-fit destination rect for `srcW × srcH` inside a `boxW × boxH` box.
 * The result is centered; non-covered area is left as background (paper).
 */
export function containRect(srcW: number, srcH: number, boxW: number, boxH: number): Rect {
  const scale = Math.min(boxW / srcW, boxH / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  const x = (boxW - w) / 2;
  const y = (boxH - h) / 2;
  return { x, y, w, h };
}

export type SampleOpts = { step?: number; minInk?: number; gamma?: number; levels: number };

export function samplePixelBuffer(buf: PixelBuffer, opts: SampleOpts): WeightedPt[] {
  const { data, width, height } = buf;
  const step = opts.step ?? 2;
  const minInk = opts.minInk ?? 0.08;
  const gamma = opts.gamma ?? 1;
  const out: WeightedPt[] = [];

  for (let py = 0; py < height; py += step) {
    for (let px = 0; px < width; px += step) {
      const i = (py * width + px) * 4;
      const luma = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
      const darkness = 1 - luma;
      if (darkness <= minInk) continue;
      const weight = Math.pow((darkness - minInk) / (1 - minInk), gamma);
      out.push({
        x: px / width - 0.5,
        y: py / height - 0.5,
        weight,
        lvl: levelOf(darkness, opts.levels),
      });
    }
  }

  return out;
}
