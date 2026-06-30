import type { Pt } from '../types';
import { createRng } from '../engine/rng';
import { createField } from '../engine/field';
import { createPalette } from '../engine/palette';
import { createInkStage, type InkStage, type TiltOpts } from '../stage/ink-stage';
import { withDepth } from '../engine/depth';
import type { ParticleShape } from '../engine/renderer';

export type SceneMorphOpts = { from: Pt[]; to: Pt[]; n?: number; seed?: number; shape?: ParticleShape; tilt?: TiltOpts | false };

const DEFAULT_DEPTH_AMPLITUDE = 0.22;

export function sceneMorph(canvas: HTMLCanvasElement, opts: SceneMorphOpts): InkStage {
  canvas.setAttribute('aria-hidden', 'true');

  const n = opts.n ?? opts.from.length;
  const rng = createRng(opts.seed ?? 1);
  const palette = createPalette([244, 243, 238], [17, 19, 24], 24);

  // Tilt is on by default (matches createInkStage default).
  const tiltInput = opts.tilt;
  const tiltEnabled = tiltInput !== false && (tiltInput as TiltOpts | undefined)?.depth !== false;
  const amplitude = (tiltInput as TiltOpts | undefined)?.amplitude ?? DEFAULT_DEPTH_AMPLITUDE;

  const field = createField(n, rng);
  field.setFormation('from', tiltEnabled ? withDepth(opts.from, amplitude) : opts.from);
  field.setFormation('to', tiltEnabled ? withDepth(opts.to, amplitude) : opts.to);

  const stage = createInkStage(canvas, field, palette, { shape: opts.shape, tilt: tiltInput });
  stage.morph('from', 'to', { durationMs: 1600 });

  return stage;
}
