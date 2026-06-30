import type { PixelBuffer, WeightedPt } from '../types';
import { levelOf } from './palette';

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
