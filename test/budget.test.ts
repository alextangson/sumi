import { describe, it, expect } from 'vitest';
import { recommendedParticleCount } from '../src/engine/budget';

describe('recommendedParticleCount', () => {
  it('never exceeds 15000', () => {
    expect(recommendedParticleCount({ width: 9999, dpr: 0.5 })).toBeLessThanOrEqual(15000);
  });

  it('high-res desktop (1440px, dpr=1) → 15000', () => {
    expect(recommendedParticleCount({ width: 1440, dpr: 1 })).toBe(15000);
  });

  it('retina desktop (1440px, dpr=2) → 12000', () => {
    expect(recommendedParticleCount({ width: 1440, dpr: 2 })).toBe(12000);
  });

  it('normal desktop (1024px, dpr=1) → 8000', () => {
    expect(recommendedParticleCount({ width: 1024, dpr: 1 })).toBe(8000);
  });

  it('small tablet / landscape mobile (600px) → 4000', () => {
    expect(recommendedParticleCount({ width: 600, dpr: 1 })).toBe(4000);
  });

  it('portrait mobile (375px) → 2000', () => {
    expect(recommendedParticleCount({ width: 375, dpr: 2 })).toBe(2000);
  });

  it('boundary: exactly 768px → 8000', () => {
    expect(recommendedParticleCount({ width: 768, dpr: 1 })).toBe(8000);
  });

  it('boundary: exactly 480px → 4000', () => {
    expect(recommendedParticleCount({ width: 480, dpr: 1 })).toBe(4000);
  });
});
