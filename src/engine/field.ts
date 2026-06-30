import type { Pt, Rng } from '../types';
import { particleT } from './choreography';

export type Particle = {
  targets: Record<string, Pt>;
  x: number;
  y: number;
  z: number;
  phase: number;
  lvl: number;
};

export type Field = {
  particles: Particle[];
  n: number;
  setFormation(name: string, pts: Pt[]): void;
  step(opts: { from: string; to: string; m: number; stagger?: number }): void;
};

export function createField(n: number, rng: Rng): Field {
  const particles: Particle[] = Array.from({ length: n }, () => ({
    targets: {},
    x: 0,
    y: 0,
    z: 0,
    phase: rng() * 2 * Math.PI,
    lvl: 0,
  }));

  return {
    particles,
    n,
    setFormation(name: string, pts: Pt[]): void {
      if (pts.length !== n) {
        throw new Error(
          `setFormation("${name}"): expected ${n} points, got ${pts.length}`,
        );
      }
      for (let i = 0; i < n; i++) {
        particles[i].targets[name] = pts[i];
      }
    },
    step(opts: { from: string; to: string; m: number; stagger?: number }): void {
      const { from, to, m, stagger = 0 } = opts;
      if (n > 0) {
        const probe = particles[0].targets;
        if (!probe[from]) throw new Error(`step: formation "${from}" not set`);
        if (!probe[to]) throw new Error(`step: formation "${to}" not set`);
      }
      for (let i = 0; i < n; i++) {
        const p = particles[i];
        const a = p.targets[from];
        const b = p.targets[to];
        const t = particleT(m, stagger, i, n);
        p.x = a.x + (b.x - a.x) * t;
        p.y = a.y + (b.y - a.y) * t;
        p.z = (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * t;
        p.lvl = b.lvl;
      }
    },
  };
}
