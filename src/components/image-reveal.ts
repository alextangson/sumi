import type { Pt, Rng } from '../types';
import { createRng } from '../engine/rng';
import { fromImage } from '../engine/formations';
import { createField } from '../engine/field';
import { createPalette } from '../engine/palette';
import { createInkStage, type InkStage } from '../stage/ink-stage';
import type { ParticleShape } from '../engine/renderer';

export type ImageRevealOpts = { n?: number; seed?: number; shape?: ParticleShape; alt?: string };

function dispersed(n: number, rng: Rng): Pt[] {
  return Array.from({ length: n }, () => ({
    x: rng() - 0.5,
    y: rng() - 0.5,
    lvl: Math.floor(rng() * 24),
  }));
}

export function imageReveal(
  canvas: HTMLCanvasElement,
  img: CanvasImageSource,
  opts?: ImageRevealOpts,
): InkStage {
  if (opts?.alt) {
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', opts.alt);
  } else {
    canvas.setAttribute('aria-hidden', 'true');
  }

  const n = opts?.n ?? 8000;
  const rng = createRng(opts?.seed ?? 1);
  const palette = createPalette([244, 243, 238], [17, 19, 24], 24);

  const field = createField(n, rng);

  // Dispersed cloud is the 'from' formation; image sample is the 'to'.
  const cloud = dispersed(n, rng);
  field.setFormation('from', cloud);

  // fromImage is browser-only; if ctx is null (jsdom) it returns an empty/origin
  // field which is fine — the unit test only checks stage shape and a11y attrs.
  const imagePts = fromImage(img, n, { levels: 24 }, rng);
  field.setFormation('image', imagePts.length > 0 ? imagePts : cloud);

  const stage = createInkStage(canvas, field, palette, { shape: opts?.shape });
  stage.morph('from', 'image', { durationMs: 1600 });

  return stage;
}
