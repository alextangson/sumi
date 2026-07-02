import type { Rect } from '../types';
import type { Field } from '../engine/field';
import type { Palette } from '../engine/palette';
import { easedProgress, type Phase } from '../engine/choreography';
export type { Phase };
import { draw, buildSprites, type ParticleShape, type ViewParams } from '../engine/renderer';
export type { ViewParams };
import { mapNormalizedToRect } from './map';

export type StageEnv = { reducedMotion: boolean; mobile: boolean; printing: boolean };
export type StageMode = 'auto' | 'animate' | 'static';
export type MorphOpts = {
  durationMs?: number;
  stagger?: number;
  onSettle?: () => void;
  phases?: Phase[];
  /** Custom easing function. Should satisfy `ease(1) === 1`; the elapsed-time guard makes it safe regardless. */
  ease?: (t: number) => number;
};
export type InkStage = {
  isStatic(): boolean;
  snapshotFor(rect: Rect): void;
  morph(from: string, to: string, opts?: MorphOpts): void;
  destroy(): void;
};

/** 3D tilt / depth options. Pass `{ depth: false }` to disable the volumetric look. */
export type TiltOpts = {
  /** Set false to disable 3D tilt entirely (renders flat). Default true. */
  depth?: boolean;
  /**
   * Maximum yaw angle in radians driven by mouse X position.
   * Default 0.42 rad (~24°).
   */
  maxYaw?: number;
  /**
   * Maximum pitch angle in radians driven by mouse Y position.
   * Default 0.16 rad (~9°).
   */
  maxPitch?: number;
  /**
   * Smoothing factor per frame (0..1). Lower = more lag / smoother.
   * Default 0.06.
   */
  smoothing?: number;
  /** Fixed oblique yaw used in static mode (reduced-motion/mobile/print). Default 0.12. */
  staticYaw?: number;
  /** Fixed oblique pitch used in static mode. Default 0.06. */
  staticPitch?: number;
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
  opts?: { mode?: StageMode; env?: StageEnv; shape?: ParticleShape; tilt?: TiltOpts | false; idle?: boolean },
): InkStage {
  const mode: StageMode = opts?.mode ?? 'auto';
  const env: StageEnv = opts?.env ?? defaultEnv();
  const shape: ParticleShape = opts?.shape ?? 'soft';   // soft radial-gradient stipple = the tactile ink look, on by default
  // Idle loop keeps a settled field breathing (shimmer). textReveal opts out (idle:false) — it fades to a flat <h1>, so a perpetual rAF into an invisible canvas would be waste.
  const idleEnabled = opts?.idle !== false;

  // Tilt is ON by default; pass `tilt: false` or `tilt: { depth: false }` to disable.
  const tiltInput = opts?.tilt;
  const tiltEnabled = tiltInput !== false && (tiltInput as TiltOpts | undefined)?.depth !== false;
  const tiltOpts: Required<TiltOpts> = {
    depth: true,
    maxYaw: (tiltInput as TiltOpts | undefined)?.maxYaw ?? 0.42,
    maxPitch: (tiltInput as TiltOpts | undefined)?.maxPitch ?? 0.16,
    smoothing: (tiltInput as TiltOpts | undefined)?.smoothing ?? 0.06,
    staticYaw: (tiltInput as TiltOpts | undefined)?.staticYaw ?? 0.12,
    staticPitch: (tiltInput as TiltOpts | undefined)?.staticPitch ?? 0.06,
  };

  // Alive defaults (design.md §3): per-grain shimmer amplitude (px), max per-grain parallax (px), mid-morph scatter (normalized).
  const SHIMMER = 1.5, PARALLAX = 60, SCATTER = 0.09;

  let rafId = 0;
  const dpr = Math.min((typeof devicePixelRatio === 'number' && devicePixelRatio) || 1, 2);
  // Build sprite cache once per stage (not per frame)
  const sprites = buildSprites(palette, shape, dpr);

  // 3D view state — smooth tracked angles
  let currentYaw = 0;
  let currentPitch = 0;
  let targetYaw = 0;
  let targetPitch = 0;
  // Accumulated auto-drift offset
  let driftYaw = 0;

  // Size the canvas backing store to match its CSS layout size.
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
    snapshotFor(fullRect());
  }

  resize();
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', onResize);
  }

  // Mouse tracking: derive target yaw/pitch from normalized cursor position.
  function onMouseMove(e: MouseEvent): void {
    if (!tiltEnabled) return;
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;  // 0..1
    const ny = (e.clientY - rect.top) / rect.height;   // 0..1
    targetYaw = (nx - 0.5) * tiltOpts.maxYaw * 2;
    targetPitch = (ny - 0.5) * tiltOpts.maxPitch * 2;
  }

  if (tiltEnabled && typeof canvas.addEventListener === 'function') {
    canvas.addEventListener('mousemove', onMouseMove);
  }

  function isStatic(): boolean {
    return (
      mode === 'static' ||
      (mode !== 'animate' && (env.reducedMotion || env.mobile || env.printing))
    );
  }

  /** Build the ViewParams for the current frame, or undefined when tilt is off. */
  function currentView(overrideYaw?: number, overridePitch?: number): ViewParams | undefined {
    if (!tiltEnabled) return undefined;
    return {
      yaw: overrideYaw ?? currentYaw,
      pitch: overridePitch ?? currentPitch,
      focal: 1.8,
    };
  }

  function snapshotFor(rect: Rect): void {
    const ctx = canvas.getContext('2d') as unknown as Parameters<typeof draw>[0] | null;
    if (!ctx) return;
    const stat = isStatic();
    // In static mode render at the fixed oblique tilt for volumetric-but-still look.
    const view = tiltEnabled
      ? currentView(tiltOpts.staticYaw, tiltOpts.staticPitch)
      : undefined;
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    draw(ctx, field, palette, rect, dpr, shape, sprites, view, now, stat ? 0 : SHIMMER, tiltEnabled && !stat ? PARALLAX : 0);
    if (!stat && !rafId) startIdleLoop();   // keep the formation breathing (shimmer) even without a morph
  }

  function fullRect(): Rect {
    return {
      x: 0,
      y: 0,
      w: canvas.clientWidth || canvas.width,
      h: canvas.clientHeight || canvas.height,
    };
  }

  // ── Idle look-around loop ────────────────────────────────────────────────
  // After a morph settles (tilt-enabled, non-static), we keep rendering via
  // a lightweight idle rAF so mouse look-around + auto-drift stay live.
  // The loop is paused when the page is hidden (Page Visibility API).

  let idleRafId = 0;

  function idleTick(time: number): void {
    if (document.hidden) {
      idleRafId = 0;
      return; // Pause until visibilitychange resumes us
    }
    if (tiltEnabled) {
      // driftYaw is a PHASE that advances slowly; the actual yaw offset is a
      // BOUNDED sine sway (never runs away — unbounded accumulation would spin
      // the formation edge-on and scatter the random-depth grains into noise).
      driftYaw += 0.004;
      const drift = 0.05 * Math.sin(driftYaw);
      currentYaw += (targetYaw + drift - currentYaw) * tiltOpts.smoothing;
      currentPitch += (targetPitch - currentPitch) * tiltOpts.smoothing;
    }
    const dpr = (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1;
    const ctx = canvas.getContext('2d') as unknown as Parameters<typeof draw>[0] | null;
    // now-driven shimmer keeps the settled field breathing (design.md §3); parallax only when tilt is live.
    if (ctx) draw(ctx, field, palette, fullRect(), dpr, shape, sprites, currentView(), time, SHIMMER, tiltEnabled ? PARALLAX : 0);
    idleRafId = requestAnimationFrame(idleTick);
  }

  function startIdleLoop(): void {
    if (!idleEnabled || isStatic()) return; // opted-out / static: no perpetual idle rAF
    if (idleRafId) return; // already running
    if (!document.hidden) {
      idleRafId = requestAnimationFrame(idleTick);
    }
  }

  function stopIdleLoop(): void {
    if (idleRafId) {
      cancelAnimationFrame(idleRafId);
      idleRafId = 0;
    }
  }

  function onVisibilityChange(): void {
    // Page became visible while the idle loop was paused — resume it (startIdleLoop self-guards static/opted-out).
    if (!document.hidden && rafId === 0) startIdleLoop();
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  function morph(from: string, to: string, opts?: MorphOpts): void {
    const durationMs = opts?.durationMs ?? 1600;
    const stagger = opts?.stagger ?? 0;
    const currentDpr = (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1;
    const ctx = canvas.getContext('2d') as unknown as Parameters<typeof draw>[0] | null;

    if (isStatic()) {
      field.step({ from, to, m: 1, stagger });
      if (ctx) {
        // Static: render one settled frame at fixed oblique tilt.
        const view = tiltEnabled
          ? currentView(tiltOpts.staticYaw, tiltOpts.staticPitch)
          : undefined;
        draw(ctx, field, palette, fullRect(), currentDpr, shape, sprites, view);
      }
      opts?.onSettle?.();
      return;
    }

    // Cancel any in-flight morph AND the idle loop — we own the single rAF slot.
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    stopIdleLoop();

    let start = -1;

    function tick(time: number): void {
      if (start < 0) start = time;
      const rawM = easedProgress((time - start) / durationMs, opts?.phases, opts?.ease);
      const m = (time - start) >= durationMs ? 1 : rawM;
      field.step({ from, to, m, stagger, scatter: SCATTER });

      // Smooth tilt angles toward target each frame (bounded sine sway — never
      // accumulates unbounded, which would spin the formation edge-on).
      if (tiltEnabled) {
        driftYaw += 0.004;
        const drift = 0.05 * Math.sin(driftYaw);
        currentYaw += (targetYaw + drift - currentYaw) * tiltOpts.smoothing;
        currentPitch += (targetPitch - currentPitch) * tiltOpts.smoothing;
      }

      if (ctx) draw(ctx, field, palette, fullRect(), currentDpr, shape, sprites, currentView(), time, SHIMMER, tiltEnabled ? PARALLAX : 0);
      if (m >= 1) {
        rafId = 0;
        opts?.onSettle?.();
        // Morph settled — hand off to the idle loop so shimmer (and tilt, if on) stay live.
        startIdleLoop();
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
    stopIdleLoop();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', onResize);
    }
    if (tiltEnabled && typeof canvas.removeEventListener === 'function') {
      canvas.removeEventListener('mousemove', onMouseMove);
    }
  }

  return { isStatic, snapshotFor, morph, destroy };
}

// `mapNormalizedToRect` re-exported so consumers can import the mapper from the
// stage entry; renderer (Task 9) already depends on it directly.
export { mapNormalizedToRect };
