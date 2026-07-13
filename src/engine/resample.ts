import type { Pt, WeightedPt, Rng } from '../types';

function mortonKey(p: Pt): number {
  const qx = Math.max(0, Math.min(1023, Math.round((p.x + 0.5) * 1023)));
  const qy = Math.max(0, Math.min(1023, Math.round((p.y + 0.5) * 1023)));
  let key = 0;
  for (let bit = 0; bit < 10; bit++) {
    key |= ((qx >> bit) & 1) << (bit * 2);
    key |= ((qy >> bit) & 1) << (bit * 2 + 1);
  }
  return key;
}

/**
 * Reorder a target formation so nearby source particles travel to nearby
 * target particles. Morton ordering is a compact O(n log n) approximation to
 * optimal transport that removes most long crossing paths without a dependency.
 */
export function matchFormation(source: Pt[], target: Pt[]): Pt[] {
  if (source.length !== target.length) {
    throw new Error(`matchFormation: expected equal lengths, got ${source.length} and ${target.length}`);
  }

  const sourceOrder = source.map((_, index) => index)
    .sort((a, b) => mortonKey(source[a]) - mortonKey(source[b]));
  const targetOrder = target.slice().sort((a, b) => mortonKey(a) - mortonKey(b));
  const matched = new Array<Pt>(target.length);

  for (let rank = 0; rank < sourceOrder.length; rank++) {
    matched[sourceOrder[rank]] = targetOrder[rank];
  }
  return matched;
}

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
