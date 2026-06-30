import type { Rect } from '../types';
import type { Field } from '../engine/field';
import type { Palette } from '../engine/palette';
import { easedProgress, type Phase } from '../engine/choreography';
export type { Phase };
import { draw, buildSprites, type ParticleShape } from '../engine/renderer';
import { mapNormalizedToRect } from './map';

export type StageEnv = { reducedMotion: boolean; mobile: boolean; printing: boolean };
export type StageMode = 'auto' | 'animate' | 'static';
export type MorphOpts = { durationMs?: number; stagger?: number; onSettle?: () => void; phases?: Phase[]; ease?: (t: number) => number };
export type InkStage = {
  isStatic(): boolean;
  snapshotFor(rect: Rect): void;
  morph(from: string, to: string, opts?: MorphOpts): void;
  destroy(): void;
};

function defaultEnv(): StageEnv {
  const reducedMotion =
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = typeof innerWidth === 'number' && innerWidth < 760;
  return { reducedMotion, mobile, printing: false };
}

export function createInkStage(
  canvas: HTMLCanvasElement,
  field: Field,
  palette: Palette,
  opts?: { mode?: StageMode; env?: StageEnv; shape?: ParticleShape },
): InkStage {
  const mode: StageMode = opts?.mode ?? 'auto';
  const env: StageEnv = opts?.env ?? defaultEnv();
  const shape: ParticleShape = opts?.shape ?? 'round';

  let rafId = 0;
  const dpr = Math.min((typeof devicePixelRatio === 'number' && devicePixelRatio) || 1, 2);
  // Build sprite cache once per stage (not per frame)
  const sprites = buildSprites(palette, shape, dpr);

  // Size the canvas backing store to match its CSS layout size.
  // Called once at creation and on every window resize.
  function resize(): void {
    const cw = canvas.clientWidth || (typeof innerWidth === 'number' ? innerWidth : 300);
    const ch = canvas.clientHeight || (typeof innerHeight === 'number' ? innerHeight : 150);
    const bw = Math.round(cw * dpr);
    const bh = Math.round(ch * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
  }

  function onResize(): void {
    resize();
    // Redraw the last settled frame so the resized canvas isn't blank.
    snapshotFor(fullRect());
  }

  resize();
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', onResize);
  }

  function isStatic(): boolean {
    return (
      mode === 'static' ||
      (mode !== 'animate' && (env.reducedMotion || env.mobile || env.printing))
    );
  }

  function snapshotFor(rect: Rect): void {
    // Settle particles at their current target formation and draw a static frame.
    // Used by beforeprint handlers to render each slide's ink state to its own canvas.
    const ctx = canvas.getContext('2d') as unknown as Parameters<typeof draw>[0] | null;
    if (ctx) draw(ctx, field, palette, rect, dpr, shape, sprites);
  }

  function fullRect(): Rect {
    return {
      x: 0,
      y: 0,
      w: canvas.clientWidth || canvas.width,
      h: canvas.clientHeight || canvas.height,
    };
  }

  function morph(from: string, to: string, opts?: MorphOpts): void {
    const durationMs = opts?.durationMs ?? 1600;
    const stagger = opts?.stagger ?? 0;
    const currentDpr = (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1;
    const ctx = canvas.getContext('2d') as unknown as Parameters<typeof draw>[0] | null;

    if (isStatic()) {
      field.step({ from, to, m: 1, stagger });
      if (ctx) draw(ctx, field, palette, fullRect(), currentDpr, shape, sprites);
      opts?.onSettle?.();
      return;
    }

    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }

    let start = -1;

    function tick(time: number): void {
      if (start < 0) start = time;
      const m = easedProgress((time - start) / durationMs, opts?.phases, opts?.ease);
      field.step({ from, to, m, stagger });
      if (ctx) draw(ctx, field, palette, fullRect(), currentDpr, shape, sprites);
      if (m >= 1) {
        rafId = 0;
        opts?.onSettle?.();
      } else {
        rafId = requestAnimationFrame(tick);
      }
    }

    rafId = requestAnimationFrame(tick);
  }

  function destroy(): void {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', onResize);
    }
  }

  return { isStatic, snapshotFor, morph, destroy };
}

// `mapNormalizedToRect` re-exported so consumers can import the mapper from the
// stage entry; renderer (Task 9) already depends on it directly.
export { mapNormalizedToRect };
