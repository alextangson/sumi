import { describe, it, expect } from 'vitest';
import {
  easeInOut,
  smoothstep,
  phaseProgress,
  particleT,
  type Phase,
} from '../src/engine/choreography';

describe('easeInOut', () => {
  it('pins the endpoints and the midpoint', () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 12);
  });

  it('is monotonically non-decreasing across the unit interval', () => {
    let prev = -Infinity;
    for (let k = 0; k <= 20; k++) {
      const v = easeInOut(k / 20);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('smoothstep', () => {
  it('clamps below e0 to 0 and above e1 to 1', () => {
    expect(smoothstep(0.2, 0.8, 0.1)).toBe(0);
    expect(smoothstep(0.2, 0.8, 0.9)).toBe(1);
  });

  it('returns the Hermite midpoint at the center', () => {
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 12);
  });
});

describe('phaseProgress', () => {
  const phases: Phase[] = [{ until: 0.5 }, { until: 1 }];

  it('returns 0 at t=0 and 1 at t=1', () => {
    expect(phaseProgress(0, phases)).toBe(0);
    expect(phaseProgress(1, phases)).toBe(1);
  });

  it('is monotonic non-decreasing from 0 to 1 across the whole range', () => {
    let prev = -Infinity;
    for (let k = 0; k <= 40; k++) {
      const v = phaseProgress(k / 40, phases);
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      prev = v;
    }
  });

  it('maps local progress through a phase-specific ease', () => {
    const single: Phase[] = [{ until: 1, ease: (t) => t }];
    expect(phaseProgress(0.3, single)).toBeCloseTo(0.3, 12);
  });
});

describe('particleT', () => {
  it('returns globalT unchanged when stagger is 0', () => {
    expect(particleT(0.42, 0, 3, 8000)).toBe(0.42);
  });

  it('returns globalT unchanged when stagger is negative', () => {
    expect(particleT(0.42, -0.1, 3, 8000)).toBe(0.42);
  });

  it('leads with particle i=0 ahead of particle i=n-1', () => {
    const n = 100;
    const lead = particleT(0.5, 0.4, 0, n);
    const trail = particleT(0.5, 0.4, n - 1, n);
    expect(lead).toBeGreaterThan(trail);
  });

  it('stays clamped to [0,1]', () => {
    expect(particleT(0, 0.5, 50, 100)).toBe(0);
    expect(particleT(1, 0.5, 50, 100)).toBe(1);
  });

  it('returns globalT unchanged when stagger is 1 (degenerate case)', () => {
    expect(particleT(0.5, 1, 0, 100)).toBe(0.5);
    expect(particleT(0.5, 1, 99, 100)).toBe(0.5);
    expect(particleT(0, 1, 50, 100)).toBe(0);
    expect(particleT(1, 1, 50, 100)).toBe(1);
  });

  it('remains finite for stagger >= 1', () => {
    expect(Number.isFinite(particleT(0.5, 1, 0, 100))).toBe(true);
    expect(Number.isFinite(particleT(0.5, 1, 50, 100))).toBe(true);
    expect(Number.isFinite(particleT(0.5, 1.5, 50, 100))).toBe(true);
  });
});
