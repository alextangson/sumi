import { describe, expect, it } from 'vitest';
import { barChart, donutChart, lineChart } from '../src/engine/data-forms';
import { createRng } from '../src/engine/rng';

describe('data chart formations', () => {
  it.each([
    ['bar', () => barChart([3, 8, 5, 10], 900, undefined, createRng(1))],
    ['line', () => lineChart([3, 8, 5, 10], 900, undefined, createRng(2))],
    ['donut', () => donutChart([3, 8, 5, 10], 900, undefined, createRng(3))],
  ])('%s returns exactly n bounded, volumetric points', (_name, create) => {
    const points = create();
    expect(points).toHaveLength(900);
    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(-0.5);
      expect(point.x).toBeLessThanOrEqual(0.5);
      expect(point.y).toBeGreaterThanOrEqual(-0.5);
      expect(point.y).toBeLessThanOrEqual(0.5);
      expect(point.z).toBeDefined();
    }
  });

  it('is deterministic for a fixed seed', () => {
    expect(barChart([1, 4, 2], 200, {}, createRng(12)))
      .toEqual(barChart([1, 4, 2], 200, {}, createRng(12)));
    expect(lineChart([1, 4, 2], 200, {}, createRng(13)))
      .toEqual(lineChart([1, 4, 2], 200, {}, createRng(13)));
    expect(donutChart([1, 4, 2], 200, {}, createRng(14)))
      .toEqual(donutChart([1, 4, 2], 200, {}, createRng(14)));
  });

  it('rejects an empty dataset with a clear error', () => {
    expect(() => barChart([], 10, {}, createRng(1))).toThrow('at least one value');
    expect(() => lineChart([], 10, {}, createRng(1))).toThrow('at least one value');
    expect(() => donutChart([], 10, {}, createRng(1))).toThrow('at least one value');
  });
});
