import { describe, it, expect } from 'vitest';
import { bucketize, draw, type Ctx2D, type ParticleShape } from '../src/engine/renderer';
import type { Particle, Field } from '../src/engine/field';
import type { Palette } from '../src/engine/palette';
import type { Rect } from '../src/types';

// Recording fake 2D context: logs fillStyle assignments, fillRect and drawImage calls.
function makeRecordingCtx() {
  const fillStyleLog: string[] = [];
  const fillRectLog: Array<[number, number, number, number]> = [];
  const drawImageLog: Array<[unknown, number, number]> = [];
  let clearRectCalls = 0;
  const ctx = {
    _fillStyle: '',
    get fillStyle() {
      return this._fillStyle;
    },
    set fillStyle(v: string) {
      this._fillStyle = v;
      fillStyleLog.push(v);
    },
    clearRect(_x: number, _y: number, _w: number, _h: number) {
      clearRectCalls++;
    },
    fillRect(x: number, y: number, w: number, h: number) {
      fillRectLog.push([x, y, w, h]);
    },
    drawImage(image: unknown, dx: number, dy: number) {
      drawImageLog.push([image, dx, dy]);
    },
  } as Ctx2D & {
    _fillStyle: string;
  };
  return { ctx, fillStyleLog, fillRectLog, drawImageLog, getClearRectCalls: () => clearRectCalls };
}

function makeParticle(x: number, y: number, lvl: number): Particle {
  return { targets: {}, x, y, phase: 0, lvl };
}

// 3 particles across 2 levels (lvl 0 and lvl 1), intentionally unsorted.
function makeField(): Field {
  const particles: Particle[] = [
    makeParticle(0.1, 0.1, 1),
    makeParticle(-0.2, 0.2, 0),
    makeParticle(0.3, -0.3, 1),
  ];
  return {
    particles,
    n: 3,
    setFormation() {},
    step() {},
  };
}

// Stub sprite array: one HTMLCanvasElement per level (2 levels).
// We use plain objects — draw only calls drawImage(sprite, x, y) on them.
// width mirrors Math.ceil(palette.sizes[lvl] * dpr) at dpr=1: sizes=[2,4] → widths=[2,4].
function makeStubSprites(levels: number, palette?: { sizes: number[] }): HTMLCanvasElement[] {
  return Array.from({ length: levels }, (_, i) => {
    const size = palette ? Math.ceil(palette.sizes[i]) : 4;
    return { width: size, height: size } as unknown as HTMLCanvasElement;
  });
}

describe('bucketize', () => {
  it('returns a NEW array stable-sorted by lvl ascending', () => {
    const field = makeField();
    const original = field.particles;
    const sorted = bucketize(original);
    // new array, original untouched
    expect(sorted).not.toBe(original);
    expect(original.map((p) => p.lvl)).toEqual([1, 0, 1]);
    // sorted ascending by lvl
    expect(sorted.map((p) => p.lvl)).toEqual([0, 1, 1]);
    // stable: the two lvl-1 particles keep original relative order (x=0.1 before x=0.3)
    const lvl1 = sorted.filter((p) => p.lvl === 1);
    expect(lvl1.map((p) => p.x)).toEqual([0.1, 0.3]);
  });
});

describe('draw', () => {
  const palette: Palette = {
    colors: ['#111317', '#aaaaaa'],
    sizes: [2, 4],
    levels: 2,
  };
  const rect: Rect = { x: 0, y: 0, w: 100, h: 100 };

  it('clears the rect scaled by dpr exactly once', () => {
    const { ctx, getClearRectCalls } = makeRecordingCtx();
    draw(ctx, makeField(), palette, rect, 2);
    expect(getClearRectCalls()).toBe(1);
  });

  it('assigns fillStyle once per distinct level present (bucketized batching)', () => {
    const { ctx, fillStyleLog } = makeRecordingCtx();
    draw(ctx, makeField(), palette, rect, 1);
    // 2 distinct levels (0 and 1) => exactly 2 fillStyle assignments
    expect(fillStyleLog.length).toBe(2);
    expect(fillStyleLog).toEqual([palette.colors[0], palette.colors[1]]);
  });

  it('calls fillRect exactly field.n times', () => {
    const { ctx, fillRectLog } = makeRecordingCtx();
    const field = makeField();
    draw(ctx, field, palette, rect, 1);
    expect(fillRectLog.length).toBe(field.n);
  });

  it('scales fillRect position and size by dpr using the level size', () => {
    const { ctx, fillRectLog } = makeRecordingCtx();
    const dpr = 2;
    draw(ctx, makeField(), palette, rect, dpr);
    // first drawn particle is the lvl-0 one (x=-0.2,y=0.2) after bucketize
    const [, , w, h] = fillRectLog[0];
    // lvl 0 size = 2, scaled by dpr 2 => 4
    expect(w).toBe(palette.sizes[0] * dpr);
    expect(h).toBe(palette.sizes[0] * dpr);
  });

  describe('shape dispatch', () => {
    it('square: uses fillRect, no drawImage', () => {
      const { ctx, fillRectLog, drawImageLog } = makeRecordingCtx();
      const field = makeField();
      draw(ctx, field, palette, rect, 1, 'square');
      expect(fillRectLog.length).toBe(field.n);
      expect(drawImageLog.length).toBe(0);
    });

    it('round with sprites: uses drawImage, no fillRect', () => {
      const { ctx, fillRectLog, drawImageLog } = makeRecordingCtx();
      const field = makeField();
      const sprites = makeStubSprites(palette.levels, palette);
      draw(ctx, field, palette, rect, 1, 'round', sprites);
      expect(drawImageLog.length).toBe(field.n);
      expect(fillRectLog.length).toBe(0);
    });

    it('soft with sprites: uses drawImage, no fillRect', () => {
      const { ctx, fillRectLog, drawImageLog } = makeRecordingCtx();
      const field = makeField();
      const sprites = makeStubSprites(palette.levels, palette);
      draw(ctx, field, palette, rect, 1, 'soft', sprites);
      expect(drawImageLog.length).toBe(field.n);
      expect(fillRectLog.length).toBe(0);
    });

    it('round with empty sprites (jsdom fallback): falls back to fillRect', () => {
      const { ctx, fillRectLog, drawImageLog } = makeRecordingCtx();
      const field = makeField();
      draw(ctx, field, palette, rect, 1, 'round', []);
      // No sprites → fallback to square path
      expect(fillRectLog.length).toBe(field.n);
      expect(drawImageLog.length).toBe(0);
    });

    it('drawImage receives the correct sprite for each particle level', () => {
      const { ctx, drawImageLog } = makeRecordingCtx();
      const field = makeField();
      const sprites = makeStubSprites(palette.levels, palette);
      draw(ctx, field, palette, rect, 1, 'round', sprites);
      // After bucketize: lvl order is [0, 1, 1]
      expect(drawImageLog[0][0]).toBe(sprites[0]);
      expect(drawImageLog[1][0]).toBe(sprites[1]);
      expect(drawImageLog[2][0]).toBe(sprites[1]);
    });

    it('drawImage offsets use sprite.width for centering (no sub-pixel bias)', () => {
      // Particle at x=0, y=0 (normalized center) maps to rect center (50,50) at dpr=1.
      // With lvl-0 sprite width=2: halfSize=1, expected drawImage dx=50-1=49, dy=50-1=49.
      const singleParticleField: Field = {
        particles: [makeParticle(0, 0, 0)],
        n: 1,
        setFormation() {},
        step() {},
      };
      const singleRect: Rect = { x: 0, y: 0, w: 100, h: 100 };
      const { ctx, drawImageLog } = makeRecordingCtx();
      const sprites = makeStubSprites(palette.levels, palette);
      draw(ctx, singleParticleField, palette, singleRect, 1, 'round', sprites);
      const [, dx, dy] = drawImageLog[0];
      const halfSize = sprites[0].width * 0.5;
      // mapNormalizedToRect: x=0,y=0 normalized → center of rect (50,50)
      expect(dx).toBeCloseTo(50 - halfSize);
      expect(dy).toBeCloseTo(50 - halfSize);
    });
  });
});
