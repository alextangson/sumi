import type { Rect } from '../types';
import type { Field } from '../engine/field';
import type { Palette } from '../engine/palette';
import type { Phase } from '../engine/choreography';
import { easeInOut } from '../engine/choreography';
import { draw } from '../engine/renderer';
import { mapNormalizedToRect } from './map';

export type StageEnv = { reducedMotion: boolean; mobile: boolean; printing: boolean };
export type StageMode = 'auto' | 'animate' | 'static';
export type SceneDef = { formation: string; choreography?: Phase[] };
export type MorphOpts = { durationMs?: number; stagger?: number; onSettle?: () => void };
export type InkStage = {
  scene(name: string, def: SceneDef): void;
  goto(name: string): void;
  next(): void;
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
  opts?: { mode?: StageMode; env?: StageEnv },
): InkStage {
  const mode: StageMode = opts?.mode ?? 'auto';
  const env: StageEnv = opts?.env ?? defaultEnv();

  const scenes = new Map<string, SceneDef>();
  const order: string[] = [];
  let current: string | null = null;

  let rafId = 0;
  const dpr = (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1;

  function isStatic(): boolean {
    return (
      mode === 'static' ||
      (mode !== 'animate' && (env.reducedMotion || env.mobile || env.printing))
    );
  }

  function scene(name: string, def: SceneDef): void {
    if (!scenes.has(name)) order.push(name);
    scenes.set(name, def);
    if (current === null) current = name;
  }

  function goto(name: string): void {
    if (scenes.has(name)) current = name;
  }

  function next(): void {
    if (current === null) return;
    const i = order.indexOf(current);
    if (i >= 0 && i + 1 < order.length) current = order[i + 1];
  }

  function snapshotFor(rect: Rect): void {
    if (current === null) return;
    const def = scenes.get(current);
    if (!def) return;
    // Settle: advance to the end of the morph, then draw a single static frame.
    field.step({ from: def.formation, to: def.formation, m: 1 });
    const ctx = canvas.getContext('2d') as unknown as Parameters<typeof draw>[0] | null;
    if (ctx) draw(ctx, field, palette, rect, dpr);
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
      if (ctx) draw(ctx, field, palette, fullRect(), currentDpr);
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
      const m = easeInOut(Math.min(1, (time - start) / durationMs));
      field.step({ from, to, m, stagger });
      if (ctx) draw(ctx, field, palette, fullRect(), currentDpr);
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
  }

  return { scene, goto, next, isStatic, snapshotFor, morph, destroy };
}

// `mapNormalizedToRect` re-exported so consumers can import the mapper from the
// stage entry; renderer (Task 9) already depends on it directly.
export { mapNormalizedToRect };
