import { describe, it, expect } from 'vitest';
import { bucketize, draw, type Ctx2D } from '../src/engine/renderer';
import type { Particle, Field } from '../src/engine/field';
import type { Palette } from '../src/engine/palette';
import type { Rect } from '../src/types';

// Recording fake 2D context: logs fillStyle assignments and fillRect calls.
function makeRecordingCtx() {
  const fillStyleLog: string[] = [];
  const fillRectLog: Array<[number, number, number, number]> = [];
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
  } as Ctx2D & {
    _fillStyle: string;
  };
  return { ctx, fillStyleLog, fillRectLog, getClearRectCalls: () => clearRectCalls };
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
});
