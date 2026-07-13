import type { MotionStyle, Pt, Rng } from '../types';
import { particleT } from './choreography';

export type Particle = {
  targets: Record<string, Pt>;
  x: number;
  y: number;
  z: number;
  phase: number;
  /** Per-grain depth 0.3..1 → volumetric parallax (near/far grains shift by different amounts), not a rigid-body tilt. */
  dep: number;
  lvl: number;
};

export type Field = {
  particles: Particle[];
  n: number;
  setFormation(name: string, pts: Pt[]): void;
  step(opts: { from: string; to: string; m: number; stagger?: number; scatter?: number; motion?: MotionStyle }): void;
};

export function createField(n: number, rng: Rng): Field {
  const particles: Particle[] = Array.from({ length: n }, () => ({
    targets: {},
    x: 0,
    y: 0,
    z: 0,
    phase: rng() * 2 * Math.PI,
    dep: 0.3 + rng() * 0.7,
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
    step(opts: { from: string; to: string; m: number; stagger?: number; scatter?: number; motion?: MotionStyle }): void {
      const { from, to, m, stagger = 0, scatter = 0, motion = 'flow' } = opts;
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
        // Mid-morph ink flow: bend each path around its source→target vector,
        // then add a smaller phase-driven eddy. It remains exactly zero at both
        // endpoints but avoids the dense straight-line traffic jam of a raw lerp.
        if (scatter > 0 && motion !== 'direct') {
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distance = Math.hypot(dx, dy) || 1;
          const bendSign = Math.sin(p.phase * 1.73) >= 0 ? 1 : -1;
          const envelope = Math.sin(t * Math.PI) * scatter * (0.45 + p.dep * 0.55);
          const phaseX = Math.cos(p.phase);
          const phaseY = Math.sin(p.phase);
          if (motion === 'flow') {
            const eddy = Math.sin(t * Math.PI * 2 + p.phase) * 0.22;
            p.x += ((-dy / distance) * bendSign + phaseX * eddy) * envelope;
            p.y += ((dx / distance) * bendSign + phaseY * eddy) * envelope;
          } else if (motion === 'burst') {
            const rx = p.x + phaseX * 0.04;
            const ry = p.y + phaseY * 0.04;
            const radialLength = Math.hypot(rx, ry) || 1;
            p.x += (rx / radialLength) * envelope * 2.2;
            p.y += (ry / radialLength) * envelope * 2.2;
          } else if (motion === 'vortex') {
            const angle = envelope * 11 * bendSign;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const px = p.x;
            const py = p.y;
            p.x = px * cos - py * sin + phaseX * envelope * 0.3;
            p.y = px * sin + py * cos + phaseY * envelope * 0.3;
          } else {
            const px = p.x;
            const py = p.y;
            p.x += Math.sin(py * 18 + p.phase + t * Math.PI * 2) * envelope * 0.85;
            p.y += Math.cos(px * 18 - p.phase + t * Math.PI) * envelope * 0.85;
          }
        }
        p.lvl = b.lvl;
      }
    },
  };
}
