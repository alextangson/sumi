// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createInkStage } from '../src/stage/ink-stage';
import type { StageEnv } from '../src/stage/ink-stage';
import type { Pt } from '../src/types';

const ALL_OFF: StageEnv = { reducedMotion: false, mobile: false, printing: false };

function fakeCanvas(): HTMLCanvasElement {
  return document.createElement('canvas');
}

function makeFakeField() {
  const pts: Pt[] = Array.from({ length: 3 }, (_, i) => ({ x: i / 3 - 0.5, y: 0, lvl: i }));
  const particles = pts.map((p) => ({
    targets: {} as Record<string, Pt>,
    x: p.x,
    y: p.y,
    z: 0,
    phase: 0,
    lvl: p.lvl,
  }));
  const n = 3;
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
        if (!a || !b) return;
        particles[i].x = a.x + (b.x - a.x) * m;
        particles[i].y = a.y + (b.y - a.y) * m;
      }
    },
  };
  field.setFormation('a', pts);
  field.setFormation('b', pts.map((p) => ({ ...p, x: -p.x })));
  return field;
}

function fakePalette() {
  return { colors: ['#000'], sizes: [1], levels: 1 };
}

describe('morph() with phases/ease options', () => {
  it('accepts phases option without throwing and fires onSettle in static mode', () => {
    const stage = createInkStage(fakeCanvas(), makeFakeField(), fakePalette(), {
      mode: 'static',
      env: ALL_OFF,
    });
    let settled = false;
    expect(() => {
      stage.morph('a', 'b', {
        phases: [{ until: 0.6 }, { until: 1 }],
        onSettle: () => { settled = true; },
      });
    }).not.toThrow();
    expect(settled).toBe(true);
    stage.destroy();
  });

  it('accepts ease option without throwing and fires onSettle in static mode', () => {
    const stage = createInkStage(fakeCanvas(), makeFakeField(), fakePalette(), {
      mode: 'static',
      env: ALL_OFF,
    });
    let settled = false;
    expect(() => {
      stage.morph('a', 'b', {
        ease: (t) => t,
        onSettle: () => { settled = true; },
      });
    }).not.toThrow();
    expect(settled).toBe(true);
    stage.destroy();
  });
});
