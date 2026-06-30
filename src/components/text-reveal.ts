import type { Pt, Rng } from '../types';
import { createRng } from '../engine/rng';
import { fromText } from '../engine/formations';
import { createField } from '../engine/field';
import { createPalette } from '../engine/palette';
import { createInkStage, type InkStage, type TiltOpts } from '../stage/ink-stage';
import { withVolume } from '../engine/depth';
import type { ParticleShape } from '../engine/renderer';

export type TextRevealOpts = { text: string; font?: string; n?: number; seed?: number; shape?: ParticleShape; onSettle?: () => void; tilt?: TiltOpts | false };

const DEFAULT_DEPTH_AMPLITUDE = 0.22;

function dispersed(n: number, rng: Rng): Pt[] {
  return Array.from({ length: n }, () => ({
    x: rng() - 0.5,
    y: rng() - 0.5,
    lvl: Math.floor(rng() * 24),
  }));
}

export function textReveal(canvas: HTMLCanvasElement, h1: HTMLElement, opts: TextRevealOpts): InkStage {
  canvas.setAttribute('aria-hidden', 'true');

  const n = opts.n ?? 8000;
  const font = opts.font ?? '700 120px sans-serif';
  const rng = createRng(opts.seed ?? 1);
  const palette = createPalette([244, 243, 238], [17, 19, 24], 24);

  const field = createField(n, rng);

  // Tilt is on by default (matches createInkStage default).
  const tiltInput = opts.tilt;
  const tiltEnabled = tiltInput !== false && (tiltInput as TiltOpts | undefined)?.depth !== false;
  const amplitude = (tiltInput as TiltOpts | undefined)?.amplitude ?? DEFAULT_DEPTH_AMPLITUDE;

  // Seed both formations with the dispersed cloud so the field is valid
  // before fonts.ready resolves; the text formation overwrites once sampled.
  const rawCloud = dispersed(n, rng);
  const cloud = tiltEnabled ? withVolume(rawCloud, amplitude, rng) : rawCloud;
  field.setFormation('dispersed', cloud);
  field.setFormation('text', cloud);

  // Start h1 invisible; both elements get CSS transitions for the handoff fade.
  h1.style.opacity = '0';
  h1.style.transition = 'opacity 600ms ease';
  canvas.style.transition = 'opacity 600ms ease';

  const stage = createInkStage(canvas, field, palette, { shape: opts.shape, tilt: tiltInput });

  void (async () => {
    await document.fonts.ready;
    const rawText = fromText(opts.text, n, { font, levels: 24 }, rng);
    const text = tiltEnabled ? withVolume(rawText, amplitude, rng) : rawText;
    field.setFormation('text', text);
    // Drive the particle coalesce animation; hand off to native h1 only after settle.
    stage.morph('dispersed', 'text', {
      durationMs: 1600,
      onSettle: () => {
        canvas.style.opacity = '0';
        h1.style.opacity = '1';
        opts.onSettle?.();
      },
    });
  })();

  return stage;
}
