// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { createInkStage } from '../src/stage/ink-stage';
import type { StageEnv } from '../src/stage/ink-stage';
import type { Field } from '../src/engine/field';
import type { Palette } from '../src/engine/palette';
import type { Pt } from '../src/types';

// Minimal fakes — InkStage only reads canvas for the (untested) DOM/rAF wiring.
function fakeCanvas(): HTMLCanvasElement {
  return document.createElement('canvas');
}

function fakeField(): Field {
  return {
    particles: [],
    n: 0,
    setFormation() {},
    step() {},
  };
}

function fakePalette(): Palette {
  return { colors: ['#000'], sizes: [1], levels: 1 };
}

const ALL_OFF: StageEnv = { reducedMotion: false, mobile: false, printing: false };

describe('createInkStage().isStatic()', () => {
  it('mode "static" is always static, even with all env flags off', () => {
    const stage = createInkStage(fakeCanvas(), fakeField(), fakePalette(), {
      mode: 'static',
      env: ALL_OFF,
    });
    expect(stage.isStatic()).toBe(true);
    stage.destroy();
  });

  it('mode "animate" is never static, even with every env flag on', () => {
    const stage = createInkStage(fakeCanvas(), fakeField(), fakePalette(), {
      mode: 'animate',
      env: { reducedMotion: true, mobile: true, printing: true },
    });
    expect(stage.isStatic()).toBe(false);
    stage.destroy();
  });

  it('mode "auto" is static iff any env flag is set', () => {
    const palette = fakePalette();

    const none = createInkStage(fakeCanvas(), fakeField(), palette, { mode: 'auto', env: ALL_OFF });
    expect(none.isStatic()).toBe(false);
    none.destroy();

    const reduced = createInkStage(fakeCanvas(), fakeField(), palette, {
      mode: 'auto',
      env: { reducedMotion: true, mobile: false, printing: false },
    });
    expect(reduced.isStatic()).toBe(true);
    reduced.destroy();

    const mobile = createInkStage(fakeCanvas(), fakeField(), palette, {
      mode: 'auto',
      env: { reducedMotion: false, mobile: true, printing: false },
    });
    expect(mobile.isStatic()).toBe(true);
    mobile.destroy();

    const printing = createInkStage(fakeCanvas(), fakeField(), palette, {
      mode: 'auto',
      env: { reducedMotion: false, mobile: false, printing: true },
    });
    expect(printing.isStatic()).toBe(true);
    printing.destroy();
  });

  it('defaults to mode "auto" when no mode is given', () => {
    const stage = createInkStage(fakeCanvas(), fakeField(), fakePalette(), {
      env: { reducedMotion: true, mobile: false, printing: false },
    });
    expect(stage.isStatic()).toBe(true);
    stage.destroy();
  });
});

describe('createInkStage() canvas sizing', () => {
  it('sizes canvas.width/height to non-default values on creation (jsdom fallback to innerWidth/innerHeight)', () => {
    const canvas = fakeCanvas();
    // jsdom: clientWidth=0, so resize() falls back to innerWidth (1024) / innerHeight (768).
    const dpr = Math.min((typeof devicePixelRatio === 'number' && devicePixelRatio) || 1, 2);
    const stage = createInkStage(canvas, fakeField(), fakePalette(), { env: ALL_OFF });
    expect(canvas.width).not.toBe(300);
    expect(canvas.width).toBeGreaterThan(0);
    expect(canvas.height).toBeGreaterThan(0);
    expect(canvas.width).toBe(Math.round((typeof innerWidth === 'number' ? innerWidth : 1024) * dpr));
    stage.destroy();
  });

  it('destroy() does not throw and removes the resize listener', () => {
    const canvas = fakeCanvas();
    const removed: string[] = [];
    const orig = window.removeEventListener.bind(window);
    const spy = (type: string, ...args: unknown[]) => {
      removed.push(type);
      return orig(type, ...(args as [EventListenerOrEventListenerObject]));
    };
    window.removeEventListener = spy as typeof window.removeEventListener;
    const stage = createInkStage(canvas, fakeField(), fakePalette(), { env: ALL_OFF });
    expect(() => stage.destroy()).not.toThrow();
    expect(removed).toContain('resize');
    window.removeEventListener = orig;
  });
});

describe('createInkStage().morph() animate path', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('animate path with custom ease terminates and fires onSettle (FIX 2 guard)', async () => {
    const n = 3;
    const pts = Array.from({ length: n }, (_, i) => ({ x: i / n - 0.5, y: 0, lvl: i }));
    const particles = pts.map((p) => ({ targets: {} as Record<string, { x: number; y: number; lvl: number }>, x: p.x, y: p.y, z: 0, phase: 0, lvl: p.lvl }));
    const field = {
      particles,
      n,
      setFormation(name: string, ps: typeof pts) {
        for (let i = 0; i < n; i++) particles[i].targets[name] = ps[i];
      },
      step({ from, to, m }: { from: string; to: string; m: number; stagger?: number }) {
        for (let i = 0; i < n; i++) {
          const a = particles[i].targets[from];
          const b = particles[i].targets[to];
          particles[i].x = a.x + (b.x - a.x) * m;
          particles[i].y = a.y + (b.y - a.y) * m;
          particles[i].lvl = b.lvl;
        }
      },
    };
    field.setFormation('a', pts);
    field.setFormation('b', pts.map((p) => ({ ...p, x: -p.x })));

    const canvas = document.createElement('canvas');
    // Use mode:'animate' so isStatic() returns false — exercises the rAF loop.
    const stage = createInkStage(canvas, field, fakePalette(), {
      mode: 'animate',
      env: ALL_OFF,
    });

    let settled = false;
    // A custom ease that never returns exactly 1 on its own (always returns 0.99*t).
    // The elapsed-time guard in morph must force m=1 to terminate the loop.
    const neverOne = (t: number) => t * 0.99;

    stage.morph('a', 'b', {
      durationMs: 50,
      ease: neverOne,
      onSettle: () => { settled = true; },
    });

    await vi.waitFor(() => {
      expect(settled).toBe(true);
    }, { timeout: 3000 });

    stage.destroy();
  });
});

describe('createInkStage() reduced-motion / mobile static fallback', () => {
  it('isStatic() is true when reducedMotion:true (mode auto)', () => {
    const stage = createInkStage(fakeCanvas(), fakeField(), fakePalette(), {
      mode: 'auto',
      env: { reducedMotion: true, mobile: false, printing: false },
    });
    expect(stage.isStatic()).toBe(true);
    stage.destroy();
  });

  it('isStatic() is true when mobile:true (mode auto)', () => {
    const stage = createInkStage(fakeCanvas(), fakeField(), fakePalette(), {
      mode: 'auto',
      env: { reducedMotion: false, mobile: true, printing: false },
    });
    expect(stage.isStatic()).toBe(true);
    stage.destroy();
  });

  it('morph() settles synchronously (onSettle fires immediately) in static mode', () => {
    const n = 2;
    const pts: Pt[] = [{ x: -0.25, y: 0, lvl: 0 }, { x: 0.25, y: 0, lvl: 1 }];
    const particles = pts.map(p => ({
      targets: {} as Record<string, Pt>,
      x: p.x, y: p.y, z: 0, phase: 0, lvl: p.lvl,
    }));
    const field = {
      particles, n,
      setFormation(name: string, ps: Pt[]) {
        for (let i = 0; i < n; i++) particles[i].targets[name] = ps[i];
      },
      step({ from, to, m }: { from: string; to: string; m: number; stagger?: number }) {
        for (let i = 0; i < n; i++) {
          const a = particles[i].targets[from];
          const b = particles[i].targets[to];
          particles[i].x = a.x + (b.x - a.x) * m;
        }
      },
    };
    field.setFormation('a', pts);
    field.setFormation('b', pts.map(p => ({ ...p, x: -p.x })));

    const stage = createInkStage(fakeCanvas(), field, fakePalette(), {
      mode: 'auto',
      env: { reducedMotion: true, mobile: false, printing: false },
    });

    let settled = false;
    // In static mode, morph() must call onSettle synchronously (no rAF).
    stage.morph('a', 'b', { onSettle: () => { settled = true; } });
    // No await — if this is not synchronous, settled will be false here.
    expect(settled).toBe(true);
    stage.destroy();
  });
});

describe('createInkStage().morph() static mode', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('calls onSettle synchronously in static mode and does not throw with null ctx', () => {
    const n = 3;
    const pts: Pt[] = Array.from({ length: n }, (_, i) => ({ x: i / n - 0.5, y: 0, lvl: i }));

    // Build a real-ish field with two formations so field.step can run.
    const particles = pts.map((p) => ({ targets: {} as Record<string, Pt>, x: p.x, y: p.y, z: 0, phase: 0, lvl: p.lvl }));
    const field = {
      particles,
      n,
      setFormation(name: string, ps: Pt[]) {
        for (let i = 0; i < n; i++) particles[i].targets[name] = ps[i];
      },
      step({ from, to, m }: { from: string; to: string; m: number; stagger?: number }) {
        for (let i = 0; i < n; i++) {
          const a = particles[i].targets[from];
          const b = particles[i].targets[to];
          particles[i].x = a.x + (b.x - a.x) * m;
          particles[i].y = a.y + (b.y - a.y) * m;
          particles[i].lvl = b.lvl;
        }
      },
    };
    field.setFormation('a', pts);
    field.setFormation('b', pts.map((p) => ({ ...p, x: -p.x })));

    const canvas = document.createElement('canvas');
    // jsdom returns null for getContext('2d') — this tests the null-ctx guard.
    const stage = createInkStage(canvas, field, fakePalette(), {
      mode: 'static',
      env: ALL_OFF,
    });

    let settled = false;
    expect(() => {
      stage.morph('a', 'b', { onSettle: () => { settled = true; } });
    }).not.toThrow();

    expect(settled).toBe(true);
    stage.destroy();
  });
});

// ── Idle loop + destroy cleanup ──────────────────────────────────────────────

describe('createInkStage() idle loop after morph settle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  /** Build a minimal but functional field with two formations. */
  function makeField(n = 3) {
    const pts = Array.from({ length: n }, (_, i) => ({ x: i / n - 0.5, y: 0, lvl: i }));
    const particles = pts.map((p) => ({
      targets: {} as Record<string, { x: number; y: number; lvl: number }>,
      x: p.x, y: p.y, z: 0, phase: 0, lvl: p.lvl,
    }));
    const field = {
      particles,
      n,
      setFormation(name: string, ps: typeof pts) {
        for (let i = 0; i < n; i++) particles[i].targets[name] = ps[i];
      },
      step({ from, to, m }: { from: string; to: string; m: number; stagger?: number }) {
        for (let i = 0; i < n; i++) {
          const a = particles[i].targets[from];
          const b = particles[i].targets[to];
          particles[i].x = a.x + (b.x - a.x) * m;
          particles[i].y = a.y + (b.y - a.y) * m;
          particles[i].lvl = b.lvl;
        }
      },
    };
    field.setFormation('a', pts);
    field.setFormation('b', pts.map((p) => ({ ...p, x: -p.x })));
    return field;
  }

  it('after morph settles, a new rAF is scheduled (idle loop active)', async () => {
    const rafCalls: number[] = [];
    const origRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = (cb) => {
      const id = origRaf(cb);
      rafCalls.push(id);
      return id;
    };

    const canvas = document.createElement('canvas');
    const stage = createInkStage(canvas, makeField(), fakePalette(), {
      mode: 'animate',
      env: ALL_OFF,
      // tilt is ON by default — idle loop only starts when tiltEnabled
    });

    let settled = false;
    stage.morph('a', 'b', {
      durationMs: 50,
      onSettle: () => { settled = true; },
    });

    await vi.waitFor(() => {
      expect(settled).toBe(true);
    }, { timeout: 3000 });

    // After settle the idle loop should have scheduled at least one more rAF.
    const afterSettleCount = rafCalls.length;
    expect(afterSettleCount).toBeGreaterThan(1);

    globalThis.requestAnimationFrame = origRaf;
    stage.destroy();
  });

  it('destroy() cancels the idle loop and removes mousemove + visibilitychange listeners', async () => {
    const cancelledIds: number[] = [];
    const origCancel = globalThis.cancelAnimationFrame;
    globalThis.cancelAnimationFrame = (id) => {
      cancelledIds.push(id);
      origCancel(id);
    };

    const removedCanvas: string[] = [];
    const removedDoc: string[] = [];

    const canvas = document.createElement('canvas');

    // Spy on canvas.removeEventListener
    const origCanvasRemove = canvas.removeEventListener.bind(canvas);
    canvas.removeEventListener = (type: string, ...args: Parameters<typeof canvas.removeEventListener> extends [string, ...infer R] ? R : never) => {
      removedCanvas.push(type);
      return origCanvasRemove(type, ...args);
    };

    // Spy on document.removeEventListener
    const origDocRemove = document.removeEventListener.bind(document);
    document.removeEventListener = (type: string, ...args: Parameters<typeof document.removeEventListener> extends [string, ...infer R] ? R : never) => {
      removedDoc.push(type);
      return origDocRemove(type, ...args);
    };

    const stage = createInkStage(canvas, makeField(), fakePalette(), {
      mode: 'animate',
      env: ALL_OFF,
    });

    let settled = false;
    stage.morph('a', 'b', {
      durationMs: 50,
      onSettle: () => { settled = true; },
    });

    await vi.waitFor(() => {
      expect(settled).toBe(true);
    }, { timeout: 3000 });

    // Now destroy — should cancel idle rAF and remove listeners
    stage.destroy();

    expect(cancelledIds.length).toBeGreaterThan(0);
    expect(removedCanvas).toContain('mousemove');
    expect(removedDoc).toContain('visibilitychange');

    globalThis.cancelAnimationFrame = origCancel;
    document.removeEventListener = origDocRemove;
  });

  it('destroy() with tilt disabled does NOT remove visibilitychange listener', () => {
    const removedDoc: string[] = [];
    const origDocRemove = document.removeEventListener.bind(document);
    document.removeEventListener = (type: string, ...args: Parameters<typeof document.removeEventListener> extends [string, ...infer R] ? R : never) => {
      removedDoc.push(type);
      return origDocRemove(type, ...args);
    };

    const stage = createInkStage(fakeCanvas(), fakeField(), fakePalette(), {
      mode: 'animate',
      env: ALL_OFF,
      tilt: false,
    });
    stage.destroy();

    expect(removedDoc).not.toContain('visibilitychange');

    document.removeEventListener = origDocRemove;
  });

  it('starting a new morph while idle loop runs cancels the idle loop (single loop discipline)', async () => {
    const cancelledIds: number[] = [];
    const origCancel = globalThis.cancelAnimationFrame;
    globalThis.cancelAnimationFrame = (id) => {
      cancelledIds.push(id);
      origCancel(id);
    };

    const canvas = document.createElement('canvas');
    const stage = createInkStage(canvas, makeField(), fakePalette(), {
      mode: 'animate',
      env: ALL_OFF,
    });

    // First morph → settles → idle loop starts
    let settled1 = false;
    stage.morph('a', 'b', { durationMs: 50, onSettle: () => { settled1 = true; } });
    await vi.waitFor(() => { expect(settled1).toBe(true); }, { timeout: 3000 });

    const cancelsBeforeSecondMorph = cancelledIds.length;

    // Second morph should cancel the idle loop before starting its own rAF
    stage.morph('b', 'a', { durationMs: 50 });

    // At least one extra cancellation should have happened for the idle loop
    expect(cancelledIds.length).toBeGreaterThan(cancelsBeforeSecondMorph);

    globalThis.cancelAnimationFrame = origCancel;
    stage.destroy();
  });
});
