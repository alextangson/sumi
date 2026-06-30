// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import type { Pt } from '../src/types';

// Mock fromImage: jsdom getContext returns null, so we return a minimal cloud
// rather than letting the browser-only canvas path throw.
vi.mock('../src/engine/formations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/engine/formations')>();
  return {
    ...actual,
    fromImage: (_img: unknown, n: number): Pt[] =>
      Array.from({ length: n }, (_, i) => ({
        x: (i / n) - 0.5,
        y: 0,
        lvl: i % 24,
      })),
  };
});

import { imageReveal } from '../src/components/image-reveal';

describe('imageReveal', () => {
  it('returns an InkStage with morph / snapshotFor / isStatic / destroy', () => {
    const canvas = document.createElement('canvas');
    const img = document.createElement('canvas'); // stub CanvasImageSource
    const stage = imageReveal(canvas, img, { n: 16, seed: 1 });
    expect(typeof stage.morph).toBe('function');
    expect(typeof stage.snapshotFor).toBe('function');
    expect(typeof stage.isStatic).toBe('function');
    expect(typeof stage.destroy).toBe('function');
  });

  it('sets role="img" and aria-label when opts.alt is provided', () => {
    const canvas = document.createElement('canvas');
    const img = document.createElement('canvas');
    imageReveal(canvas, img, { n: 16, seed: 1, alt: 'An AI-generated landscape' });
    expect(canvas.getAttribute('role')).toBe('img');
    expect(canvas.getAttribute('aria-label')).toBe('An AI-generated landscape');
  });

  it('sets aria-hidden="true" when opts.alt is not provided', () => {
    const canvas = document.createElement('canvas');
    const img = document.createElement('canvas');
    imageReveal(canvas, img, { n: 16, seed: 1 });
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
  });

  it('sets aria-hidden="true" when opts is omitted entirely', () => {
    const canvas = document.createElement('canvas');
    const img = document.createElement('canvas');
    imageReveal(canvas, img);
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
  });
});
