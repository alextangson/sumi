import type { Pt, WeightedPt, Rng } from '../types';

export function resampleToN(weighted: WeightedPt[], n: number, rng: Rng): Pt[] {
  const out: Pt[] = [];

  // Edge: nothing to sample -> n points parked at the origin.
  if (weighted.length === 0) {
    for (let i = 0; i < n; i++) {
      out.push({ x: 0, y: 0, lvl: 0 });
    }
    return out;
  }

  // Cumulative weight array; cum[i] is the running total up to and including
  // source i. total = cum[last].
  const cum = new Array<number>(weighted.length);
  let total = 0;
  for (let i = 0; i < weighted.length; i++) {
    total += weighted[i].weight;
    cum[i] = total;
  }

  // Jitter bound: +/- 0.5 over the larger output dimension so dense formations
  // do not collapse to identical pixels. n is the only size we have here, so
  // scale jitter by sqrt(n) as the per-axis grain; clamp the point into range.
  const grain = 0.5 / Math.sqrt(n);

  for (let i = 0; i < n; i++) {
    // Systematic / stratified target: one stratum per output slot, jittered
    // inside the stratum by rng() so the whole stride is deterministic.
    const target = ((i + rng()) / n) * total;

    // Binary-search the first cumulative bucket whose running total >= target.
    let lo = 0;
    let hi = weighted.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    const src = weighted[lo];

    // Small deterministic jitter in [-grain, +grain], clamped to [-0.5, 0.5].
    const jx = (rng() - 0.5) * 2 * grain;
    const jy = (rng() - 0.5) * 2 * grain;
    const x = Math.min(0.5, Math.max(-0.5, src.x + jx));
    const y = Math.min(0.5, Math.max(-0.5, src.y + jy));

    out.push({ x, y, lvl: src.lvl });
  }

  return out;
}
