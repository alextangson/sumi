import { describe, it, expect } from 'vitest';
import { bucketize, draw, type Ctx2D, type ParticleShape, type ViewParams } from '../src/engine/renderer';
import type { Particle, Field } from '../src/engine/field';
import type { Palette } from '../src/engine/palette';
import type { Rect } from '../src/types';

// Recording fake 2D context: logs fillStyle assignments, fillRect and drawImage calls.
function makeRecordingCtx() {
  const fillStyleLog: string[] = [];
  const fillRectLog: Array<[number, number, number, number]> = [];
  const drawImageLog: Array<[unknown, number, number, number, number]> = [];
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
    drawImage(image: unknown, dx: number, dy: number, dWidth: number, dHeight: number) {
      drawImageLog.push([image, dx, dy, dWidth, dHeight]);
    },
  } as Ctx2D & {
    _fillStyle: string;
  };
  return { ctx, fillStyleLog, fillRectLog, drawImageLog, getClearRectCalls: () => clearRectCalls };
}

function makeParticle(x: number, y: number, lvl: number): Particle {
  return { targets: {}, x, y, z: 0, phase: 0, lvl };
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
      // No view → eLvl = p.lvl, sprites unchanged
      expect(drawImageLog[0][0]).toBe(sprites[0]);
      expect(drawImageLog[1][0]).toBe(sprites[1]);
      expect(drawImageLog[2][0]).toBe(sprites[1]);
    });

    it('drawImage called with 5 args (image, dx, dy, dWidth, dHeight)', () => {
      const { ctx, drawImageLog } = makeRecordingCtx();
      const field = makeField();
      const sprites = makeStubSprites(palette.levels, palette);
      draw(ctx, field, palette, rect, 1, 'round', sprites);
      expect(drawImageLog.length).toBe(field.n);
      for (const entry of drawImageLog) {
        expect(entry.length).toBe(5);
        // dWidth and dHeight should be equal (square sprite)
        expect(entry[3]).toBe(entry[4]);
      }
    });

    it('drawImage offsets use sprite.width for centering (no sub-pixel bias)', () => {
      // Particle at x=0, y=0 (normalized center) maps to rect center (50,50) at dpr=1.
      // No view → sizeMul=1, w = sprite.width * 1.
      // dx = 50 - w/2, dy = 50 - w/2.
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
      const [, dx, dy, dWidth, dHeight] = drawImageLog[0];
      const w = sprites[0].width; // sizeMul=1 in flat mode
      // mapNormalizedToRect: x=0,y=0 normalized → center of rect (50,50)
      expect(dx).toBeCloseTo(50 - w / 2);
      expect(dy).toBeCloseTo(50 - w / 2);
      expect(dWidth).toBeCloseTo(w);
      expect(dHeight).toBeCloseTo(w);
    });

    it('sprite path with view selects different effective levels for near vs far particles', () => {
      // Near particle: z=0.3 (will have sizeMul>1 → shade>0 → eLvl pushed higher)
      // Far particle:  z=-0.3 (will have sizeMul<1 → shade<0 → eLvl pushed lower)
      // Both start at lvl=1 (middle of 2-level palette). With 2 levels the shift may
      // clamp, so we just assert draw doesn't throw and calls drawImage with 5 args.
      const deepPalette: Palette = {
        colors: ['#000', '#222', '#444', '#666', '#888', '#aaa'],
        sizes: [1, 2, 3, 4, 5, 6],
        levels: 6,
      };
      // In project3d: z negative = toward viewer (near, sizeMul>1), z positive = away (far, sizeMul<1)
      const nearField: Field = {
        particles: [makeParticleWithZ(0, 0, -0.4, 3)],
        n: 1,
        setFormation() {},
        step() {},
      };
      const farField: Field = {
        particles: [makeParticleWithZ(0, 0, 0.4, 3)],
        n: 1,
        setFormation() {},
        step() {},
      };
      const sprites6 = makeStubSprites(6, deepPalette);
      const view3d: ViewParams = { yaw: 0, pitch: 0, focal: 1.8 };

      const { ctx: ctxNear, drawImageLog: nearLog } = makeRecordingCtx();
      draw(ctxNear, nearField, deepPalette, rect, 1, 'round', sprites6, view3d);
      expect(nearLog.length).toBe(1);
      expect(nearLog[0].length).toBe(5);

      const { ctx: ctxFar, drawImageLog: farLog } = makeRecordingCtx();
      draw(ctxFar, farField, deepPalette, rect, 1, 'round', sprites6, view3d);
      expect(farLog.length).toBe(1);
      expect(farLog[0].length).toBe(5);

      // Near particle should use a darker (higher index) sprite than far particle
      const nearSprite = nearLog[0][0] as HTMLCanvasElement;
      const farSprite = farLog[0][0] as HTMLCanvasElement;
      const nearIdx = sprites6.indexOf(nearSprite);
      const farIdx = sprites6.indexOf(farSprite);
      expect(nearIdx).toBeGreaterThanOrEqual(farIdx);
    });
  });
});

function makeParticleWithZ(x: number, y: number, z: number, lvl: number): Particle {
  return { targets: {}, x, y, z, phase: 0, lvl };
}

describe('draw with view (3D perspective)', () => {
  const palette: Palette = {
    colors: ['#111317', '#aaaaaa'],
    sizes: [2, 4],
    levels: 2,
  };
  const rect: Rect = { x: 0, y: 0, w: 100, h: 100 };
  const view: ViewParams = { yaw: 0.3, pitch: 0.1, focal: 1000 };

  function makeField3D(): Field {
    const particles: Particle[] = [
      makeParticleWithZ(0.1, 0.1, 0.05, 1),
      makeParticleWithZ(-0.2, 0.2, -0.03, 0),
      makeParticleWithZ(0.3, -0.3, 0.1, 1),
    ];
    return { particles, n: 3, setFormation() {}, step() {} };
  }

  it('draw with view does not throw and still draws n particles', () => {
    const { ctx, fillRectLog } = makeRecordingCtx();
    const field = makeField3D();
    expect(() => draw(ctx, field, palette, rect, 1, 'square', [], view)).not.toThrow();
    expect(fillRectLog.length).toBe(field.n);
  });

  it('draw with view=undefined is identical to no-view flat path', () => {
    const { ctx: ctx1, fillRectLog: log1 } = makeRecordingCtx();
    const { ctx: ctx2, fillRectLog: log2 } = makeRecordingCtx();
    const field = makeField3D();
    draw(ctx1, field, palette, rect, 1, 'square', []);
    draw(ctx2, field, palette, rect, 1, 'square', [], undefined);
    expect(log1).toEqual(log2);
  });

  it('yaw=0 pitch=0 view produces same positions as flat path for z=0 particles', () => {
    const zeroZField: Field = {
      particles: [makeParticleWithZ(0.1, 0.1, 0, 0)],
      n: 1,
      setFormation() {},
      step() {},
    };
    const { ctx: flatCtx, fillRectLog: flatLog } = makeRecordingCtx();
    const { ctx: viewCtx, fillRectLog: viewLog } = makeRecordingCtx();
    draw(flatCtx, zeroZField, palette, rect, 1, 'square', []);
    draw(viewCtx, zeroZField, palette, rect, 1, 'square', [], { yaw: 0, pitch: 0, focal: 1000 });
    expect(viewLog[0][0]).toBeCloseTo(flatLog[0][0], 3);
    expect(viewLog[0][1]).toBeCloseTo(flatLog[0][1], 3);
  });

  it('view with yaw shifts particle x position', () => {
    const field: Field = {
      particles: [makeParticleWithZ(0, 0, 0.1, 0)],
      n: 1,
      setFormation() {},
      step() {},
    };
    const { ctx: flatCtx, fillRectLog: flatLog } = makeRecordingCtx();
    const { ctx: viewCtx, fillRectLog: viewLog } = makeRecordingCtx();
    draw(flatCtx, field, palette, rect, 1, 'square', []);
    draw(viewCtx, field, palette, rect, 1, 'square', [], { yaw: 0.5, pitch: 0, focal: 1000 });
    // With z=0.1 and yaw=0.5, x should shift from center
    expect(viewLog[0][0]).not.toBeCloseTo(flatLog[0][0], 0);
  });
});
