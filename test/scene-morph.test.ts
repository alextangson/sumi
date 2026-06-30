// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { sceneMorph } from '../src/components/scene-morph';
import type { Pt } from '../src/types';

const from: Pt[] = [
  { x: -0.3, y: -0.2, lvl: 0 },
  { x: 0.1, y: 0.0, lvl: 5 },
  { x: 0.25, y: 0.3, lvl: 12 },
];
const to: Pt[] = [
  { x: 0.3, y: 0.2, lvl: 1 },
  { x: -0.1, y: 0.0, lvl: 6 },
  { x: -0.25, y: -0.3, lvl: 13 },
];

describe('sceneMorph', () => {
  it('returns an InkStage with morph/isStatic/destroy', () => {
    const canvas = document.createElement('canvas');
    const stage = sceneMorph(canvas, { from, to, n: 3, seed: 1 });
    expect(typeof stage.morph).toBe('function');
    expect(typeof stage.isStatic).toBe('function');
    expect(typeof stage.destroy).toBe('function');
  });

  it('sets canvas aria-hidden to "true"', () => {
    const canvas = document.createElement('canvas');
    sceneMorph(canvas, { from, to, n: 3 });
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
  });
});
