import type { MotionStyle, Pt } from '../types';
import { createRng } from '../engine/rng';
import { createField } from '../engine/field';
import { matchFormation } from '../engine/resample';
import { createPalette } from '../engine/palette';
import { createInkStage, type InkStage, type TiltOpts } from '../stage/ink-stage';
import { withDepth } from '../engine/depth';
import type { ParticleShape } from '../engine/renderer';

export type SceneMorphOpts = {
  from: Pt[];
  to: Pt[];
  n?: number;
  seed?: number;
  shape?: ParticleShape;
  tilt?: TiltOpts | false;
  motion?: MotionStyle;
  durationMs?: number;
  stagger?: number;
};

const DEFAULT_DEPTH_AMPLITUDE = 0.22;

function addDepthToFlatFormation(points: Pt[], amplitude: number): Pt[] {
  return points.some((point) => point.z !== undefined)
    ? points
    : withDepth(points, amplitude);
}

export function sceneMorph(canvas: HTMLCanvasElement, opts: SceneMorphOpts): InkStage {
  canvas.setAttribute('aria-hidden', 'true');

  const n = opts.n ?? opts.from.length;
  const rng = createRng(opts.seed ?? 1);
  const palette = createPalette([244, 243, 238], [17, 19, 24], 24);

  // Tilt is on by default (matches createInkStage default).
  const tiltInput = opts.tilt;
  const tiltEnabled = tiltInput !== false && (tiltInput as TiltOpts | undefined)?.depth !== false;
  const amplitude = DEFAULT_DEPTH_AMPLITUDE;

  const field = createField(n, rng);
  const matchedTo = matchFormation(opts.from, opts.to);
  field.setFormation('from', tiltEnabled ? addDepthToFlatFormation(opts.from, amplitude) : opts.from);
  field.setFormation('to', tiltEnabled ? addDepthToFlatFormation(matchedTo, amplitude) : matchedTo);

  const stage = createInkStage(canvas, field, palette, { shape: opts.shape, tilt: tiltInput });
  stage.morph('from', 'to', {
    durationMs: opts.durationMs ?? 1600,
    stagger: opts.stagger ?? 0.1,
    motion: opts.motion ?? 'flow',
  });

  return stage;
}
