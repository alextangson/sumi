import { describe, it, expect, vi } from 'vitest';
import { easedProgress, easeInOut, phaseProgress, type Phase } from '../src/engine/choreography';

describe('easedProgress', () => {
  describe('default path (no phases, no ease) → easeInOut', () => {
    it('matches easeInOut at 0, 0.5, 1', () => {
      expect(easedProgress(0)).toBe(easeInOut(0));
      expect(easedProgress(0.5)).toBe(easeInOut(0.5));
      expect(easedProgress(1)).toBe(easeInOut(1));
    });

    it('clamps rawT below 0', () => {
      expect(easedProgress(-0.5)).toBe(easeInOut(0));
    });

    it('clamps rawT above 1', () => {
      expect(easedProgress(1.5)).toBe(easeInOut(1));
    });
  });

  describe('ease path (ease provided, no phases)', () => {
    it('calls the custom ease with clamped t', () => {
      const linear = (t: number) => t;
      expect(easedProgress(0.3, undefined, linear)).toBeCloseTo(0.3, 12);
      expect(easedProgress(-1, undefined, linear)).toBe(0);
      expect(easedProgress(2, undefined, linear)).toBe(1);
    });

    it('uses the return value of the custom ease function', () => {
      const squared = (t: number) => t * t;
      expect(easedProgress(0.5, undefined, squared)).toBeCloseTo(0.25, 12);
    });
  });

  describe('phases path (phases provided)', () => {
    const phases: Phase[] = [{ until: 0.5 }, { until: 1 }];

    it('delegates to phaseProgress', () => {
      for (const raw of [0, 0.25, 0.5, 0.75, 1]) {
        expect(easedProgress(raw, phases)).toBe(phaseProgress(raw, phases));
      }
    });

    it('passes rawT through unclamped to phaseProgress (phaseProgress clamps internally)', () => {
      // phaseProgress clamps internally so result is same as passing 0 or 1
      expect(easedProgress(-0.5, phases)).toBe(phaseProgress(-0.5, phases));
      expect(easedProgress(1.5, phases)).toBe(phaseProgress(1.5, phases));
    });

    it('phases take precedence over ease', () => {
      const alwaysHalf = () => 0.5;
      const result = easedProgress(1, phases, alwaysHalf);
      // phases path should be used, not alwaysHalf
      expect(result).toBe(phaseProgress(1, phases));
    });
  });

  describe('clamping', () => {
    it('output is always in [0, 1] for any rawT in default mode', () => {
      for (const t of [-10, -1, 0, 0.5, 1, 2, 10]) {
        const v = easedProgress(t);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    });
  });
});
