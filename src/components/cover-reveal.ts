import { textReveal } from './text-reveal';
import type { InkStage } from '../stage/ink-stage';
import type { ParticleShape } from '../engine/renderer';

export type CoverRevealOpts = {
  wordmark: HTMLElement;
  tagline?: HTMLElement;
  n?: number;
  seed?: number;
  shape?: ParticleShape;
};

export function coverReveal(canvas: HTMLCanvasElement, opts: CoverRevealOpts): InkStage {
  const { wordmark, tagline } = opts;
  const text = wordmark.textContent ?? '';

  if (tagline) {
    tagline.style.opacity = '0';
    tagline.style.transition = 'opacity 600ms ease';
  }

  const stage = textReveal(canvas, wordmark, {
    text,
    n: opts.n,
    seed: opts.seed,
    shape: opts.shape,
    onSettle: () => {
      if (tagline) {
        tagline.style.transition = tagline.style.transition || 'opacity 600ms ease';
        tagline.style.opacity = '1';
      }
    },
  });

  return stage;
}
