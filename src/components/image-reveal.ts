import type { Pt, Rng } from '../types';
import { createRng } from '../engine/rng';
import { fromImage } from '../engine/formations';
import { createField } from '../engine/field';
import { createPalette } from '../engine/palette';
import { createInkStage, type InkStage, type TiltOpts } from '../stage/ink-stage';
import { withVolume } from '../engine/depth';
import type { ParticleShape } from '../engine/renderer';

export type ImageRevealOpts = { n?: number; seed?: number; shape?: ParticleShape; alt?: string; tilt?: TiltOpts | false };

const DEFAULT_DEPTH_AMPLITUDE = 0.22;

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

  // Tilt is on by default (matches createInkStage default).
  const tiltInput = opts?.tilt;
  const tiltEnabled = tiltInput !== false && (tiltInput as TiltOpts | undefined)?.depth !== false;
  const amplitude = (tiltInput as TiltOpts | undefined)?.amplitude ?? DEFAULT_DEPTH_AMPLITUDE;

  // Dispersed cloud is the 'from' formation; image sample is the 'to'.
  const rawCloud = dispersed(n, rng);
  const cloud = tiltEnabled ? withVolume(rawCloud, amplitude, rng) : rawCloud;
  field.setFormation('from', cloud);

  // fromImage is browser-only; if ctx is null (jsdom) it returns an empty/origin
  // field which is fine — the unit test only checks stage shape and a11y attrs.
  const rawImagePts = fromImage(img, n, { levels: 24 }, rng);
  const rawFallback = rawImagePts.length > 0 ? rawImagePts : rawCloud;
  const imagePts = tiltEnabled ? withVolume(rawFallback, amplitude, rng) : rawFallback;
  field.setFormation('image', imagePts);

  const stage = createInkStage(canvas, field, palette, { shape: opts?.shape, tilt: tiltInput });
  stage.morph('from', 'image', { durationMs: 1600 });

  return stage;
}
