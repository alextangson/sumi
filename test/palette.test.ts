import { describe, it, expect } from 'vitest';
import { createPalette, levelOf, type Palette } from '../src/engine/palette';

describe('levelOf', () => {
  it('maps k=0 to level 0', () => {
    expect(levelOf(0, 24)).toBe(0);
  });

  it('maps k=1 to the top level (levels-1)', () => {
    expect(levelOf(1, 24)).toBe(23);
  });

  it('clamps k below 0 to level 0', () => {
    expect(levelOf(-0.5, 24)).toBe(0);
  });

  it('clamps k above 1 to the top level', () => {
    expect(levelOf(2, 24)).toBe(23);
  });

  it('rounds intermediate values', () => {
    // k=0.5, levels=24 -> round(0.5*23)=round(11.5)=12
    expect(levelOf(0.5, 24)).toBe(12);
  });

  it('returns an integer for any in-range k', () => {
    const v = levelOf(0.37, 24);
    expect(Number.isInteger(v)).toBe(true);
  });

  it('handles levels=1 (single level) returning 0', () => {
    expect(levelOf(0, 1)).toBe(0);
    expect(levelOf(1, 1)).toBe(0);
  });
});

describe('createPalette', () => {
  const bg: [number, number, number] = [244, 243, 238];
  const ink: [number, number, number] = [17, 19, 24];

  it('produces exactly `levels` colors and sizes', () => {
    const p: Palette = createPalette(bg, ink, 24);
    expect(p.colors.length).toBe(24);
    expect(p.sizes.length).toBe(24);
    expect(p.levels).toBe(24);
  });

  it('color[0] is the background as an rgb() string', () => {
    const p = createPalette(bg, ink, 24);
    expect(p.colors[0]).toBe('rgb(244, 243, 238)');
  });

  it('color[levels-1] is the ink as an rgb() string', () => {
    const p = createPalette(bg, ink, 24);
    expect(p.colors[23]).toBe('rgb(17, 19, 24)');
  });

  it('lerps the midpoint channel-wise and rounds to integers', () => {
    // levels=3 -> k = 0, 0.5, 1; mid r = round(244 + (17-244)*0.5) = round(130.5) = 131 (banker-free Math.round = 131)
    const p = createPalette(bg, ink, 3);
    expect(p.colors[1]).toBe('rgb(131, 131, 131)');
  });

  it('sizes follow 1.3 + 1.9*k*k', () => {
    const p = createPalette(bg, ink, 24);
    expect(p.sizes[0]).toBeCloseTo(1.3, 6);          // k=0 -> 1.3
    expect(p.sizes[23]).toBeCloseTo(1.3 + 1.9, 6);   // k=1 -> 3.2
    // k=0.5 (levels=3) checked separately below
  });

  it('sizes are monotonically non-decreasing', () => {
    const p = createPalette(bg, ink, 24);
    for (let i = 1; i < p.sizes.length; i++) {
      expect(p.sizes[i]).toBeGreaterThanOrEqual(p.sizes[i - 1]);
    }
  });

  it('handles levels=1 without dividing by zero', () => {
    const p = createPalette(bg, ink, 1);
    expect(p.colors.length).toBe(1);
    expect(p.colors[0]).toBe('rgb(244, 243, 238)'); // k forced to 0
    expect(p.sizes[0]).toBeCloseTo(1.3, 6);
  });
});
