export type { Rng, Pt, WeightedPt, PixelBuffer, Rect } from './types';
export { createRng } from './engine/rng';
// fromImage exposed in P1 (needs contain-fit aspect handling)
export { fromText } from './engine/formations';
export { textReveal } from './components/text-reveal';
export type { TextRevealOpts } from './components/text-reveal';
export { sceneMorph } from './components/scene-morph';
export type { SceneMorphOpts } from './components/scene-morph';
export type { InkStage, MorphOpts } from './stage/ink-stage';
export { parseInkAttributes, autoInit } from './auto-init';
