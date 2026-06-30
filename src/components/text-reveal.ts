import type { Pt, Rng } from '../types';
import { createRng } from '../engine/rng';
import { fromText } from '../engine/formations';
import { createField } from '../engine/field';
import { createPalette } from '../engine/palette';
import { createInkStage, type InkStage } from '../stage/ink-stage';

export type TextRevealOpts = { text: string; font?: string; n?: number; seed?: number };

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
  // Seed both formations with the dispersed cloud so the field is valid
  // before fonts.ready resolves; the text formation overwrites once sampled.
  const cloud = dispersed(n, rng);
  field.setFormation('dispersed', cloud);
  field.setFormation('text', cloud);

  const stage = createInkStage(canvas, field, palette);
  stage.scene('reveal', {
    formation: 'text',
    choreography: [{ until: 1 }],
  });

  void (async () => {
    await document.fonts.ready;
    const text = fromText(opts.text, n, { font, levels: 24 }, rng);
    field.setFormation('text', text);
    stage.goto('reveal');
    // Handoff: canvas fades out, native h1 fades to full opacity.
    // The h1 is NEVER removed or replaced — same DOM node throughout.
    canvas.style.opacity = '0';
    h1.style.opacity = '1';
  })();

  return stage;
}
