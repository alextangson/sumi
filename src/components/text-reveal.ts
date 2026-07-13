import type { Pt, Rng } from '../types';
import { createRng } from '../engine/rng';
import { fromText } from '../engine/formations';
import { matchFormation } from '../engine/resample';
import { createField } from '../engine/field';
import { createPalette } from '../engine/palette';
import { createInkStage, type InkStage } from '../stage/ink-stage';
import type { ParticleShape } from '../engine/renderer';
import { textSampleOptsForElement } from './text-layout';

export type TextRevealOpts = { text: string; font?: string; n?: number; seed?: number; shape?: ParticleShape; onSettle?: () => void };

function dispersed(n: number, rng: Rng): Pt[] {
  return Array.from({ length: n }, () => ({
    x: rng() - 0.5,
    y: rng() - 0.5,
    lvl: Math.floor(rng() * 7),   // faint ink dust (not full-contrast noise) → the coalesce reads as ink condensing
  }));
}

export function textReveal(canvas: HTMLCanvasElement, h1: HTMLElement, opts: TextRevealOpts): InkStage {
  canvas.setAttribute('aria-hidden', 'true');

  const n = opts.n ?? 8000;
  const rng = createRng(opts.seed ?? 1);
  const palette = createPalette([244, 243, 238], [17, 19, 24], 24);

  const field = createField(n, rng);

  // textReveal's endgame is flat DOM text — tilt buys nothing post-handoff
  // and would leave a perpetual idle rAF running into an invisible canvas.
  // Flat coalesce → crisp <h1> is correct. tilt: false prevents startIdleLoop.
  const cloud = dispersed(n, rng);
  field.setFormation('dispersed', cloud);
  field.setFormation('text', cloud);

  // Start h1 invisible; both elements get CSS transitions for the handoff fade.
  h1.style.opacity = '0';
  h1.style.transition = 'opacity 600ms ease';
  canvas.style.transition = 'opacity 600ms ease';

  const baseStage = createInkStage(canvas, field, palette, { shape: opts.shape, tilt: false, idle: false });
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
    const sampleOpts = textSampleOptsForElement(canvas, h1, opts.font);
    const text = fromText(opts.text, n, sampleOpts, rng);
    field.setFormation('text', matchFormation(cloud, text));
    // Drive the particle coalesce animation; hand off to native h1 only after settle.
    stage.morph('dispersed', 'text', {
      durationMs: 1600,
      stagger: 0.12,
      onSettle: () => {
        if (destroyed) return;
        canvas.style.opacity = '0';
        h1.style.opacity = '1';
        opts.onSettle?.();
      },
    });
  })();

  return stage;
}
