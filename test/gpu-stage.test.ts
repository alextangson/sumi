// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { Pt } from '../src/types';
import type { Field } from '../src/engine/field';
import type { Palette } from '../src/engine/palette';

const gpu = vi.hoisted(() => ({
  setField: vi.fn(),
  setMorph: vi.fn(),
  render: vi.fn(),
  resize: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock('../src/engine/renderer', () => ({
  createParticleRenderer: () => ({ backend: 'webgl2', ...gpu }),
}));

import { createInkStage } from '../src/stage/ink-stage';

describe('InkStage GPU morph hot path', () => {
  it('uploads endpoints once and only materializes CPU state at settle', async () => {
    for (const spy of Object.values(gpu)) spy.mockClear();

    const from: Pt[] = [
      { x: -0.4, y: 0, lvl: 2 },
      { x: 0.4, y: 0, lvl: 4 },
    ];
    const to: Pt[] = [
      { x: -0.15, y: -0.2, lvl: 20 },
      { x: 0.15, y: 0.2, lvl: 22 },
    ];
    const particles = from.map((point, index) => ({
      targets: { from: point, to: to[index] },
      x: point.x,
      y: point.y,
      z: 0,
      lvl: point.lvl,
      phase: index + 0.25,
      dep: 0.5,
    }));
    const step = vi.fn(({ m }: { m: number }) => {
      for (let i = 0; i < particles.length; i++) {
        particles[i].x = from[i].x + (to[i].x - from[i].x) * m;
        particles[i].y = from[i].y + (to[i].y - from[i].y) * m;
        particles[i].lvl = to[i].lvl;
      }
    });
    const field: Field = {
      particles,
      n: particles.length,
      setFormation() {},
      step,
    };
    const palette: Palette = {
      colors: ['rgb(244, 243, 238)', 'rgb(17, 19, 24)'],
      sizes: [1, 3],
      levels: 2,
    };
    const canvas = document.createElement('canvas');
    const stage = createInkStage(canvas, field, palette, {
      mode: 'animate',
      env: { reducedMotion: false, mobile: false, printing: false },
      tilt: false,
      idle: false,
    });

    let settled = false;
    stage.morph('from', 'to', {
      durationMs: 50,
      stagger: 0.1,
      onSettle: () => { settled = true; },
    });

    await vi.waitFor(() => expect(settled).toBe(true), { timeout: 3000 });

    expect(gpu.setMorph).toHaveBeenCalledTimes(1);
    expect(gpu.render.mock.calls.length).toBeGreaterThan(1);
    expect(step).toHaveBeenCalledTimes(1);
    expect(step).toHaveBeenLastCalledWith(expect.objectContaining({ m: 1 }));
    expect(gpu.setField).toHaveBeenCalledTimes(2); // initial snapshot + settled state

    stage.destroy();
    expect(gpu.destroy).toHaveBeenCalledTimes(1);
  });

  it('pauses, resumes, and can jump to a named formation', () => {
    for (const spy of Object.values(gpu)) spy.mockClear();

    const callbacks = new Map<number, FrameRequestCallback>();
    let nextFrameId = 0;
    const originalRaf = globalThis.requestAnimationFrame;
    const originalCancelRaf = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      const id = ++nextFrameId;
      callbacks.set(id, callback);
      return id;
    });
    globalThis.cancelAnimationFrame = vi.fn((id: number) => {
      callbacks.delete(id);
    });

    const from: Pt[] = [{ x: -0.25, y: 0, lvl: 2 }];
    const to: Pt[] = [{ x: 0.25, y: 0, lvl: 18 }];
    const particles = [{
      targets: { from: from[0], to: to[0] },
      x: from[0].x,
      y: from[0].y,
      z: 0,
      lvl: from[0].lvl,
      phase: 0.25,
      dep: 0.5,
    }];
    const step = vi.fn(({ from: source, to: target, m }: { from: string; to: string; m: number }) => {
      const a = particles[0].targets[source as 'from' | 'to'];
      const b = particles[0].targets[target as 'from' | 'to'];
      particles[0].x = a.x + (b.x - a.x) * m;
      particles[0].y = a.y + (b.y - a.y) * m;
    });
    const field: Field = { particles, n: 1, setFormation() {}, step };
    const palette: Palette = { colors: ['#fff', '#000'], sizes: [1, 3], levels: 2 };
    const inkStage = createInkStage(document.createElement('canvas'), field, palette, {
      mode: 'animate',
      env: { reducedMotion: false, mobile: false, printing: false },
      tilt: false,
      idle: false,
    });

    try {
      inkStage.morph('from', 'to', { durationMs: 1000 });
      expect(callbacks.size).toBe(1);
      inkStage.pause();
      expect(callbacks.size).toBe(0);

      inkStage.resume();
      expect(callbacks.size).toBe(1);
      const first = callbacks.entries().next().value as [number, FrameRequestCallback];
      callbacks.delete(first[0]);
      first[1](0);
      expect(callbacks.size).toBe(1);

      inkStage.showFormation('to');
      expect(callbacks.size).toBe(0);
      expect(step).toHaveBeenLastCalledWith(expect.objectContaining({ from: 'to', to: 'to', m: 1 }));
      expect(gpu.setField).toHaveBeenCalledTimes(2);
    } finally {
      inkStage.destroy();
      globalThis.requestAnimationFrame = originalRaf;
      globalThis.cancelAnimationFrame = originalCancelRaf;
    }
  });
});
