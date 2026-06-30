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
  });

  if (tagline) {
    // Wrap the original onSettle: textReveal fires it internally; we need to
    // listen for the wordmark settling then fade in the tagline.
    // textReveal does not expose onSettle, so we observe opacity change instead.
    // Simplest correct approach: chain via MutationObserver on wordmark opacity.
    const observer = new MutationObserver(() => {
      if (wordmark.style.opacity === '1') {
        observer.disconnect();
        tagline.style.opacity = '1';
      }
    });
    observer.observe(wordmark, { attributes: true, attributeFilter: ['style'] });
  }

  return stage;
}
