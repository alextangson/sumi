// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
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

describe('createInkStage().morph() static mode', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('calls onSettle synchronously in static mode and does not throw with null ctx', () => {
    const n = 3;
    const pts: Pt[] = Array.from({ length: n }, (_, i) => ({ x: i / n - 0.5, y: 0, lvl: i }));

    // Build a real-ish field with two formations so field.step can run.
    const particles = pts.map((p) => ({ targets: {} as Record<string, Pt>, x: p.x, y: p.y, phase: 0, lvl: p.lvl }));
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
