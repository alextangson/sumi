import { describe, expect, it } from 'vitest';
import {
  createParticleRenderer,
  packMorphParticles,
  packParticles,
  particleShapeId,
  motionStyleId,
} from '../src/engine/renderer';
import type { Particle } from '../src/engine/field';
import type { Palette } from '../src/engine/palette';

function particle(overrides: Partial<Particle> = {}): Particle {
  return {
    targets: {},
    x: 0.1,
    y: -0.2,
    z: 0.3,
    lvl: 7,
    phase: 1.25,
    dep: 0.6,
    ...overrides,
  };
}

describe('packParticles', () => {
  it('packs one interleaved GPU record per particle', () => {
    const data = packParticles([
      particle(),
      particle({ x: -0.4, y: 0.5, z: -0.1, lvl: 20, phase: 2.5, dep: 0.9 }),
    ]);

    expect(data).toHaveLength(18);
    expect(Array.from(data)).toEqual([
      0.1, -0.2, 0.3, 7, 0.1, -0.2, 0.3, 1.25, 0.6,
      -0.4, 0.5, -0.1, 20, -0.4, 0.5, -0.1, 2.5, 0.9,
    ].map(Math.fround));
  });

  it('reuses a correctly-sized upload buffer', () => {
    const existing = new Float32Array(9);
    expect(packParticles([particle()], existing)).toBe(existing);
  });
});

describe('packMorphParticles', () => {
  it('packs named endpoints once for shader-driven interpolation', () => {
    const p = particle({
      targets: {
        cloud: { x: -0.4, y: 0.2, z: -0.1, lvl: 2 },
        title: { x: 0.3, y: -0.25, z: 0.15, lvl: 21 },
      },
    });

    const data = packMorphParticles([p], 'cloud', 'title');
    expect(Array.from(data)).toEqual([
      -0.4, 0.2, -0.1, 21,
      0.3, -0.25, 0.15, 1.25, 0.6,
    ].map(Math.fround));
  });

  it('fails clearly when a formation is missing', () => {
    expect(() => packMorphParticles([particle()], 'missing', 'title'))
      .toThrow('formation "missing"');
  });
});

describe('particleShapeId', () => {
  it('maps public shapes to stable shader modes', () => {
    expect(particleShapeId('square')).toBe(0);
    expect(particleShapeId('round')).toBe(1);
    expect(particleShapeId('soft')).toBe(2);
  });
});

describe('motionStyleId', () => {
  it('maps transition names to stable shader modes', () => {
    expect(motionStyleId('direct')).toBe(0);
    expect(motionStyleId('flow')).toBe(1);
    expect(motionStyleId('burst')).toBe(2);
    expect(motionStyleId('vortex')).toBe(3);
    expect(motionStyleId('wave')).toBe(4);
  });
});

describe('createParticleRenderer without WebGL2', () => {
  it('returns a safe unavailable backend without requesting Canvas2D', () => {
    let contextRequested = false;
    const canvas = {
      getContext() {
        contextRequested = true;
        return null;
      },
    } as unknown as HTMLCanvasElement;
    const palette: Palette = {
      colors: ['rgb(244, 243, 238)', 'rgb(17, 19, 24)'],
      sizes: [1, 3],
      levels: 2,
    };

    const renderer = createParticleRenderer(canvas, palette, 'soft', 1);
    expect(renderer.backend).toBe('unavailable');
    expect(contextRequested).toBe(false);
  });
});
