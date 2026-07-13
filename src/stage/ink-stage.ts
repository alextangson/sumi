import type { MotionStyle, Pt, Rect } from '../types';
import type { Field } from '../engine/field';
import type { Palette } from '../engine/palette';
import { easedProgress, type Phase } from '../engine/choreography';
export type { Phase };
import { createParticleRenderer, type ParticleShape, type ViewParams } from '../engine/renderer';
export type { ViewParams };
import { mapNormalizedToRect } from './map';

export type StageEnv = { reducedMotion: boolean; mobile: boolean; printing: boolean };
export type StageMode = 'auto' | 'animate' | 'static';
export type MorphOpts = {
  durationMs?: number;
  stagger?: number;
  /** GPU motion field used between formations. Default `flow`. */
  motion?: MotionStyle;
  onSettle?: () => void;
  phases?: Phase[];
  /** Custom easing function. Should satisfy `ease(1) === 1`; the elapsed-time guard makes it safe regardless. */
  ease?: (t: number) => number;
};
/** Exit animation: scatter the settled field back out to ink dust (the reverse of a coalesce). */
export type DisperseOpts = {
  durationMs?: number;
  /** Outward scatter distance in normalized field space (grains fling along their own phase). Default 0.55. */
  spread?: number;
  /** Fade the canvas to transparent as the grains fly apart. Default true. */
  fade?: boolean;
  onSettle?: () => void;
};

export type InkStage = {
  isStatic(): boolean;
  snapshotFor(rect: Rect): void;
  morph(from: string, to: string, opts?: MorphOpts): void;
  /** Pause the active morph or settled idle motion without losing progress. */
  pause(): void;
  /** Continue a morph or idle motion paused with `pause()`. */
  resume(): void;
  /** Cancel the active morph and render one named formation immediately. */
  showFormation(name: string): void;
  /** Scatter the current formation outward into faint dust — the on-exit counterpart to a reveal. */
  disperseOut(opts?: DisperseOpts): void;
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
  const SHIMMER = 0.8, PARALLAX = 60, SCATTER = 0.075;

  let rafId = 0;
  let isInViewport = true;
  let isPaused = false;
  let suspendMorph: (() => void) | undefined;
  let resumeMorph: (() => void) | undefined;
  // Set for one morph by disperseOut so the settled exit does NOT resume the breathing idle loop.
  let suppressIdleOnce = false;
  const dpr = Math.min((typeof devicePixelRatio === 'number' && devicePixelRatio) || 1, 2);
  const renderer = createParticleRenderer(canvas, palette, shape, dpr);
  canvas.dataset.sumiRenderer = renderer.backend;
  renderer.setField(field);
  let activeMorph: { from: string; to: string; m: number; stagger: number; motion: MotionStyle } | undefined;

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
    renderer.resize(bw, bh);
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
    if (rect.width <= 0 || rect.height <= 0) return;
    const nx = (e.clientX - rect.left) / rect.width;  // 0..1
    const ny = (e.clientY - rect.top) / rect.height;   // 0..1
    targetYaw = (nx - 0.5) * tiltOpts.maxYaw * 2;
    targetPitch = (ny - 0.5) * tiltOpts.maxPitch * 2;
  }

  // Track on window so full-bleed decorative canvases can keep
  // `pointer-events:none` without disabling the tilt interaction.
  if (tiltEnabled && typeof window !== 'undefined') {
    window.addEventListener('mousemove', onMouseMove);
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
    if (activeMorph) renderer.setMorph(field, activeMorph.from, activeMorph.to);
    else renderer.setField(field);
    const stat = isStatic();
    // In static mode render at the fixed oblique tilt for volumetric-but-still look.
    const view = tiltEnabled
      ? currentView(tiltOpts.staticYaw, tiltOpts.staticPitch)
      : undefined;
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    renderer.render(
      rect,
      cssWidth(),
      cssHeight(),
      view,
      now,
      stat ? 0 : SHIMMER,
      tiltEnabled && !stat ? PARALLAX : 0,
      activeMorph?.m ?? 1,
      activeMorph?.stagger ?? 0,
      activeMorph ? SCATTER : 0,
      activeMorph?.motion ?? 'direct',
    );
    if (!stat && !rafId) startIdleLoop();   // keep the formation breathing (shimmer) even without a morph
  }

  function cssWidth(): number {
    return canvas.clientWidth || canvas.width / dpr;
  }

  function cssHeight(): number {
    return canvas.clientHeight || canvas.height / dpr;
  }

  function fullRect(): Rect {
    return {
      x: 0,
      y: 0,
      w: cssWidth(),
      h: cssHeight(),
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
    // GPU-driven point rendering keeps the settled field breathing with one draw call.
    renderer.render(fullRect(), cssWidth(), cssHeight(), currentView(), time, SHIMMER, tiltEnabled ? PARALLAX : 0);
    idleRafId = requestAnimationFrame(idleTick);
  }

  function startIdleLoop(): void {
    if (!idleEnabled || isStatic()) return; // opted-out / static: no perpetual idle rAF
    if (isPaused) return;
    if (!isInViewport) return;
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

  const intersectionObserver = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        isInViewport = entry.isIntersecting;
        if (isInViewport) {
          if (rafId === 0) startIdleLoop();
        } else {
          stopIdleLoop();
        }
      }, { rootMargin: '120px' })
    : undefined;
  intersectionObserver?.observe(canvas);

  function morph(from: string, to: string, opts?: MorphOpts): void {
    const durationMs = opts?.durationMs ?? 1600;
    const stagger = opts?.stagger ?? 0;
    const motion = opts?.motion ?? 'flow';
    // Consume the exit flag exactly once per morph, whatever path we take.
    const suppressIdle = suppressIdleOnce;
    suppressIdleOnce = false;
    renderer.setMorph(field, from, to);
    activeMorph = { from, to, m: 0, stagger, motion };
    isPaused = false;
    suspendMorph = undefined;
    resumeMorph = undefined;

    if (isStatic()) {
      field.step({ from, to, m: 1, stagger, motion });
      renderer.setField(field);
      activeMorph = undefined;
      // Static: render one settled frame at fixed oblique tilt.
      const view = tiltEnabled
        ? currentView(tiltOpts.staticYaw, tiltOpts.staticPitch)
        : undefined;
      renderer.render(fullRect(), cssWidth(), cssHeight(), view);
      suspendMorph = undefined;
      resumeMorph = undefined;
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
    let pausedAt = -1;

    function tick(time: number): void {
      if (start < 0) start = time;
      const rawM = easedProgress((time - start) / durationMs, opts?.phases, opts?.ease);
      const m = (time - start) >= durationMs ? 1 : rawM;
      if (activeMorph) activeMorph.m = m;

      // Smooth tilt angles toward target each frame (bounded sine sway — never
      // accumulates unbounded, which would spin the formation edge-on).
      if (tiltEnabled) {
        driftYaw += 0.004;
        const drift = 0.05 * Math.sin(driftYaw);
        currentYaw += (targetYaw + drift - currentYaw) * tiltOpts.smoothing;
        currentPitch += (targetPitch - currentPitch) * tiltOpts.smoothing;
      }

      renderer.render(
        fullRect(),
        cssWidth(),
        cssHeight(),
        currentView(),
        time,
        SHIMMER,
        tiltEnabled ? PARALLAX : 0,
        m,
        stagger,
        SCATTER,
        motion,
      );
      if (m >= 1) {
        field.step({ from, to, m: 1, stagger, motion });
        renderer.setField(field);
        activeMorph = undefined;
        rafId = 0;
        suspendMorph = undefined;
        resumeMorph = undefined;
        opts?.onSettle?.();
        // Morph settled — hand off to the idle loop so shimmer (and tilt, if on) stay
        // live. An exit (disperseOut) suppresses this: no breathing into a torn-down canvas.
        if (!suppressIdle) startIdleLoop();
      } else {
        rafId = requestAnimationFrame(tick);
      }
    }

    suspendMorph = () => {
      pausedAt = typeof performance !== 'undefined' ? performance.now() : 0;
    };
    resumeMorph = () => {
      const now = typeof performance !== 'undefined' ? performance.now() : 0;
      if (start >= 0 && pausedAt >= 0) start += now - pausedAt;
      pausedAt = -1;
      isPaused = false;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  function pause(): void {
    if (isPaused) return;
    isPaused = true;
    stopIdleLoop();
    if (activeMorph && rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
      suspendMorph?.();
    }
  }

  function resume(): void {
    if (!isPaused) return;
    if (activeMorph && resumeMorph) {
      resumeMorph();
      return;
    }
    isPaused = false;
    startIdleLoop();
  }

  function showFormation(name: string): void {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    stopIdleLoop();
    isPaused = false;
    suspendMorph = undefined;
    resumeMorph = undefined;
    activeMorph = undefined;
    field.step({ from: name, to: name, m: 1, motion: 'direct' });
    renderer.setField(field);
    const view = isStatic() && tiltEnabled
      ? currentView(tiltOpts.staticYaw, tiltOpts.staticPitch)
      : currentView();
    renderer.render(fullRect(), cssWidth(), cssHeight(), view);
    startIdleLoop();
  }

  // ── Disperse-out (exit) ──────────────────────────────────────────────────
  // The reverse of a coalesce: capture the field where it sits, fling each grain
  // outward along its own phase into faint dust, and fade the canvas. The iron
  // law wants scenes to scatter OUT on the way off, not just cut.
  const EXIT_FROM = '__exitFrom';
  const EXIT_TO = '__exitTo';

  function disperseOut(opts?: DisperseOpts): void {
    if (field.n === 0) { opts?.onSettle?.(); return; }
    if (activeMorph) {
      field.step({
        from: activeMorph.from,
        to: activeMorph.to,
        m: activeMorph.m,
        stagger: activeMorph.stagger,
        scatter: SCATTER,
        motion: activeMorph.motion,
      });
      renderer.setField(field);
      activeMorph = undefined;
    }
    const spread = opts?.spread ?? 0.55;
    const durationMs = opts?.durationMs ?? 800;
    const fromPts: Pt[] = field.particles.map((p) => ({ x: p.x, y: p.y, z: p.z, lvl: p.lvl }));
    const toPts: Pt[] = field.particles.map((p) => {
      const mag = spread * (0.35 + p.dep * 0.9);   // depth-weighted: nearer grains fling farther
      return {
        x: p.x + Math.cos(p.phase) * mag,
        y: p.y + Math.sin(p.phase) * mag,
        z: p.z,
        lvl: Math.floor((p.phase / (Math.PI * 2)) * 6),   // fade toward faint ink dust
      };
    });
    field.setFormation(EXIT_FROM, fromPts);
    field.setFormation(EXIT_TO, toPts);
    if (opts?.fade !== false) {
      canvas.style.transition = `opacity ${durationMs}ms ease`;
      canvas.style.opacity = '0';
    }
    suppressIdleOnce = true;   // exit: don't resume the breathing idle loop
    morph(EXIT_FROM, EXIT_TO, { durationMs, onSettle: opts?.onSettle });
  }

  function destroy(): void {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    stopIdleLoop();
    isPaused = true;
    suspendMorph = undefined;
    resumeMorph = undefined;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', onResize);
    }
    if (tiltEnabled && typeof window !== 'undefined') {
      window.removeEventListener('mousemove', onMouseMove);
    }
    intersectionObserver?.disconnect();
    renderer.destroy();
  }

  return { isStatic, snapshotFor, morph, pause, resume, showFormation, disperseOut, destroy };
}

// `mapNormalizedToRect` re-exported so consumers can import the mapper from the
// stage entry; renderer (Task 9) already depends on it directly.
export { mapNormalizedToRect };
