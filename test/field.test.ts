import { describe, it, expect } from 'vitest';
import { createField } from '../src/engine/field';
import type { Pt } from '../src/types';
import type { Rng } from '../src/types';

// deterministic Rng stub: fixed value so phase is predictable
const constRng = (v: number): Rng => () => v;

function ptsOf(n: number, fn: (i: number) => Pt): Pt[] {
  return Array.from({ length: n }, (_, i) => fn(i));
}

describe('createField', () => {
  it('creates n particles with phase=rng()*2pi, x=y=0, lvl=0, empty targets', () => {
    const field = createField(3, constRng(0.5));
    expect(field.n).toBe(3);
    expect(field.particles).toHaveLength(3);
    for (const p of field.particles) {
      expect(p.x).toBe(0);
      expect(p.y).toBe(0);
      expect(p.lvl).toBe(0);
      expect(p.phase).toBeCloseTo(0.5 * 2 * Math.PI, 10);
      expect(p.targets).toEqual({});
    }
  });
});

describe('Field.setFormation', () => {
  it('throws when pts.length !== n', () => {
    const field = createField(4, constRng(0));
    expect(() => field.setFormation('a', ptsOf(3, (i) => ({ x: i, y: i, lvl: 0 })))).toThrow();
  });

  it('assigns targets[name][i] to each particle', () => {
    const field = createField(2, constRng(0));
    const pts = ptsOf(2, (i) => ({ x: i * 0.1, y: i * 0.2, lvl: i }));
    field.setFormation('start', pts);
    expect(field.particles[0].targets['start']).toEqual({ x: 0, y: 0, lvl: 0 });
    expect(field.particles[1].targets['start']).toEqual({ x: 0.1, y: 0.2, lvl: 1 });
  });
});

describe('Field.step', () => {
  it('m=0 puts each particle at the "from" target', () => {
    const field = createField(2, constRng(0));
    const a = ptsOf(2, (i) => ({ x: -0.4 + i * 0.1, y: 0.3 - i * 0.1, lvl: 0 }));
    const b = ptsOf(2, (i) => ({ x: 0.2 + i * 0.1, y: -0.1 + i * 0.1, lvl: 5 }));
    field.setFormation('a', a);
    field.setFormation('b', b);
    field.step({ from: 'a', to: 'b', m: 0 });
    expect(field.particles[0].x).toBe(a[0].x);
    expect(field.particles[0].y).toBe(a[0].y);
    expect(field.particles[1].x).toBe(a[1].x);
    expect(field.particles[1].y).toBe(a[1].y);
  });

  it('m=1 puts each particle at the "to" target and lvl from "to"', () => {
    const field = createField(2, constRng(0));
    const a = ptsOf(2, (i) => ({ x: -0.4 + i * 0.1, y: 0.3 - i * 0.1, lvl: 0 }));
    const b = ptsOf(2, (i) => ({ x: 0.2 + i * 0.1, y: -0.1 + i * 0.1, lvl: 5 }));
    field.setFormation('a', a);
    field.setFormation('b', b);
    field.step({ from: 'a', to: 'b', m: 1 });
    expect(field.particles[0].x).toBeCloseTo(b[0].x, 10);
    expect(field.particles[0].y).toBeCloseTo(b[0].y, 10);
    expect(field.particles[0].lvl).toBe(b[0].lvl);
    expect(field.particles[1].lvl).toBe(b[1].lvl);
  });

  it('m=0.5 with stagger 0 yields the midpoint', () => {
    const field = createField(1, constRng(0));
    const a: Pt[] = [{ x: -0.4, y: 0.2, lvl: 0 }];
    const b: Pt[] = [{ x: 0.4, y: -0.2, lvl: 3 }];
    field.setFormation('a', a);
    field.setFormation('b', b);
    field.step({ from: 'a', to: 'b', m: 0.5 });
    expect(field.particles[0].x).toBeCloseTo(0, 12);
    expect(field.particles[0].y).toBeCloseTo(0, 12);
    expect(field.particles[0].lvl).toBe(3);
  });
});
