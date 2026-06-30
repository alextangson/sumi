import type { Pt } from '../types';
import { createRng } from '../engine/rng';
import { createField } from '../engine/field';
import { createPalette } from '../engine/palette';
import { createInkStage, type InkStage } from '../stage/ink-stage';

export type SceneMorphOpts = { from: Pt[]; to: Pt[]; n?: number; seed?: number };

export function sceneMorph(canvas: HTMLCanvasElement, opts: SceneMorphOpts): InkStage {
  canvas.setAttribute('aria-hidden', 'true');

  const n = opts.n ?? opts.from.length;
  const rng = createRng(opts.seed ?? 1);
  const palette = createPalette([244, 243, 238], [17, 19, 24], 24);

  const field = createField(n, rng);
  field.setFormation('from', opts.from);
  field.setFormation('to', opts.to);

  const stage = createInkStage(canvas, field, palette);
  stage.scene('morph', {
    formation: 'to',
    choreography: [{ until: 1 }],
  });
  stage.goto('morph');

  return stage;
}
