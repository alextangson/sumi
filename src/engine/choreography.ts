export type Phase = { until: number; ease?: (t: number) => number };

export const easeInOut: (t: number) => number = (t) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export const smoothstep: (e0: number, e1: number, x: number) => number = (
  e0,
  e1,
  x,
) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export function phaseProgress(t: number, phases: Phase[]): number {
  const clamped = Math.max(0, Math.min(1, t));
  let prevUntil = 0;
  for (const phase of phases) {
    if (clamped <= phase.until || phase.until >= 1) {
      const span = phase.until - prevUntil;
      const local = span <= 0 ? 1 : (clamped - prevUntil) / span;
      const ease = phase.ease ?? easeInOut;
      const eased = ease(Math.max(0, Math.min(1, local)));
      // Cumulative: interpolate from prevUntil to phase.until
      return prevUntil + eased * (phase.until - prevUntil);
    }
    prevUntil = phase.until;
  }
  return 1;
}

export function particleT(
  globalT: number,
  stagger: number,
  i: number,
  n: number,
): number {
  if (stagger <= 0 || stagger >= 1) return globalT;
  const start = (i / n) * stagger;
  const local = (globalT - start) / (1 - stagger);
  return Math.max(0, Math.min(1, local));
}
