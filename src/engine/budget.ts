/**
 * Adaptive particle budget helper.
 * Pure function — no DOM access required; width/dpr default from globals when available.
 *
 * Tier table (desktop-first):
 *   width ≥ 1200, dpr ≤ 1  → 15000  (high-res desktop, low dpr)
 *   width ≥ 1200, dpr > 1  → 12000  (high-res desktop, high dpr)
 *   width ≥ 768             →  8000  (normal desktop / large tablet)
 *   width ≥ 480             →  4000  (small tablet / landscape mobile)
 *   width  < 480            →  2000  (portrait mobile)
 *
 * Cap: never exceeds 15000 (the spec ≤15k bound).
 */
export function recommendedParticleCount(opts?: {
  width?: number;
  dpr?: number;
}): number {
  const width = opts?.width ?? (typeof innerWidth === 'number' ? innerWidth : 1280);
  const dpr = opts?.dpr ?? (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1);

  let budget: number;
  if (width >= 1200 && dpr <= 1) {
    budget = 15000;
  } else if (width >= 1200) {
    budget = 12000;
  } else if (width >= 768) {
    budget = 8000;
  } else if (width >= 480) {
    budget = 4000;
  } else {
    budget = 2000;
  }

  return Math.min(budget, 15000);
}
