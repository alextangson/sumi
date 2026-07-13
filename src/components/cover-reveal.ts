import type { Pt, Rng } from '../types';
import { createRng } from '../engine/rng';
import { fromText } from '../engine/formations';
import { matchFormation } from '../engine/resample';
import { createField } from '../engine/field';
import { createPalette } from '../engine/palette';
import { createInkStage, type InkStage, type TiltOpts } from '../stage/ink-stage';
import { withDepth } from '../engine/depth';
import type { ParticleShape } from '../engine/renderer';
import { textSampleOptsForElement } from './text-layout';

export type CoverRevealOpts = {
  wordmark: HTMLElement;
  tagline?: HTMLElement;
  font?: string;
  n?: number;
  seed?: number;
  shape?: ParticleShape;
  tilt?: TiltOpts | false;
  /** Keep the wordmark as living particles instead of handing off to DOM text. Default false. */
  persistent?: boolean;
};

const DEFAULT_DEPTH_AMPLITUDE = 0.22;

function dispersed(n: number, rng: Rng): Pt[] {
  return Array.from({ length: n }, () => ({
    x: rng() - 0.5,
    y: rng() - 0.5,
    lvl: Math.floor(rng() * 7),   // faint ink dust → the coalesce reads as ink condensing
  }));
}

/**
 * Hero cover. Ink gathers into the wordmark, then hands off to the exact DOM
 * text for a crisp, zero-idle final state. Pass `persistent:true` to keep the
 * particle wordmark alive for decorative scenes.
 */
export function coverReveal(canvas: HTMLCanvasElement, opts: CoverRevealOpts): InkStage {
  const { wordmark, tagline } = opts;
  const text = wordmark.textContent ?? '';

  canvas.setAttribute('aria-hidden', 'true');
  wordmark.style.transition = 'opacity 450ms ease';
  wordmark.style.opacity = '0';
  canvas.style.transition = 'opacity 450ms ease';

  if (tagline) {
    tagline.style.opacity = '0';
    tagline.style.transition = 'opacity 600ms ease';
  }

  const n = opts.n ?? 3200;
  const rng = createRng(opts.seed ?? 1);
  const palette = createPalette([244, 243, 238], [17, 19, 24], 24);
  const field = createField(n, rng);

  const persistent = opts.persistent === true;
  const tiltInput = persistent ? opts.tilt : false;
  const tiltEnabled = tiltInput !== false && (tiltInput as TiltOpts | undefined)?.depth !== false;
  const amp = DEFAULT_DEPTH_AMPLITUDE;

  const rawCloud = dispersed(n, rng);
  const cloud = tiltEnabled ? withDepth(rawCloud, amp) : rawCloud;
  field.setFormation('from', cloud);
  field.setFormation('wordmark', cloud);

  const baseStage = createInkStage(canvas, field, palette, {
    shape: opts.shape ?? 'round',
    tilt: tiltInput,
    idle: persistent,
  });
  let destroyed = false;
  const stage: InkStage = {
    ...baseStage,
    destroy(): void {
      destroyed = true;
      baseStage.destroy();
    },
  };

  void (async () => {
    await (document.fonts?.ready ?? Promise.resolve());
    if (destroyed) return;
    const sampleOpts = textSampleOptsForElement(canvas, wordmark, opts.font);
    const rawText = fromText(text, n, sampleOpts, rng);
    const base = rawText.length > 0 ? rawText : rawCloud;
    const matched = matchFormation(rawCloud, base);
    const pts = tiltEnabled ? withDepth(matched, amp) : matched;
    field.setFormation('wordmark', pts);
    // Coalesce dust → wordmark. No canvas fade-out: the idle loop keeps the
    // settled formation shimmering + tilting (createInkStage default idle:true).
    stage.morph('from', 'wordmark', {
      durationMs: 1600,
      stagger: 0.12,
      onSettle: () => {
        if (destroyed) return;
        if (!persistent) {
          canvas.style.opacity = '0';
          wordmark.style.opacity = '1';
        }
        if (tagline) tagline.style.opacity = '1';
      },
    });
  })();

  return stage;
}
