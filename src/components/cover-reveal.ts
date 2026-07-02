import type { Pt, Rng } from '../types';
import { createRng } from '../engine/rng';
import { fromText } from '../engine/formations';
import { createField } from '../engine/field';
import { createPalette } from '../engine/palette';
import { createInkStage, type InkStage, type TiltOpts } from '../stage/ink-stage';
import { withDepth } from '../engine/depth';
import type { ParticleShape } from '../engine/renderer';

export type CoverRevealOpts = {
  wordmark: HTMLElement;
  tagline?: HTMLElement;
  font?: string;
  n?: number;
  seed?: number;
  shape?: ParticleShape;
  tilt?: TiltOpts | false;
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
 * Hero cover. Unlike textReveal (which hands off to crisp DOM text and goes
 * still), coverReveal keeps the particle wordmark ALIVE — it coalesces from
 * ink dust and then perpetually shimmers + tilts in 3D. The living particles
 * ARE the visible wordmark; the DOM <h1> stays in the tree (visually yielded,
 * opacity 0) so SEO crawlers and assistive tech still read the real text, while
 * the canvas is aria-hidden to avoid a double announcement.
 */
export function coverReveal(canvas: HTMLCanvasElement, opts: CoverRevealOpts): InkStage {
  const { wordmark, tagline } = opts;
  const text = wordmark.textContent ?? '';

  canvas.setAttribute('aria-hidden', 'true');
  // The living particle wordmark is what the eye sees; keep the real <h1> in the
  // DOM for SEO/AT but let the particles carry the visible mark.
  wordmark.style.opacity = '0';

  if (tagline) {
    tagline.style.opacity = '0';
    tagline.style.transition = 'opacity 600ms ease';
  }

  const n = opts.n ?? 8000;
  const font = opts.font ?? '600 120px "Noto Serif SC", serif';
  const rng = createRng(opts.seed ?? 1);
  const palette = createPalette([244, 243, 238], [17, 19, 24], 24);
  const field = createField(n, rng);

  const tiltInput = opts.tilt;
  const tiltEnabled = tiltInput !== false && (tiltInput as TiltOpts | undefined)?.depth !== false;
  const amp = DEFAULT_DEPTH_AMPLITUDE;

  const rawCloud = dispersed(n, rng);
  const cloud = tiltEnabled ? withDepth(rawCloud, amp) : rawCloud;
  field.setFormation('from', cloud);
  field.setFormation('wordmark', cloud);

  const stage = createInkStage(canvas, field, palette, { shape: opts.shape, tilt: tiltInput });

  void (async () => {
    await document.fonts.ready;
    const rawText = fromText(text, n, { font, levels: 24 }, rng);
    const base = rawText.length > 0 ? rawText : rawCloud;
    const pts = tiltEnabled ? withDepth(base, amp) : base;
    field.setFormation('wordmark', pts);
    // Coalesce dust → wordmark. No canvas fade-out: the idle loop keeps the
    // settled formation shimmering + tilting (createInkStage default idle:true).
    stage.morph('from', 'wordmark', {
      durationMs: 1600,
      onSettle: () => {
        if (tagline) tagline.style.opacity = '1';
      },
    });
  })();

  return stage;
}
