// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { Pt } from '../src/types';

vi.mock('../src/engine/formations', () => ({
  fromText: (_text: string, n: number): Pt[] =>
    Array.from({ length: n }, (_, i) => ({
      x: (i / n) - 0.5,
      y: 0,
      lvl: i % 24,
    })),
}));

import { textReveal } from '../src/components/text-reveal';

beforeEach(() => {
  // jsdom has no FontFaceSet; provide a resolved fonts.ready.
  (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts = {
    ready: Promise.resolve(),
  };
});

afterEach(() => {
  // Reset body between tests so querySelector finds the right h1.
  document.body.innerHTML = '';
});

describe('textReveal', () => {
  it('sets canvas aria-hidden to "true"', () => {
    const canvas = document.createElement('canvas');
    const h1 = document.createElement('h1');
    h1.textContent = 'Stello';
    document.body.appendChild(h1);
    textReveal(canvas, h1, { text: 'Stello', n: 16, seed: 1 });
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
  });

  it('leaves the same h1 element in the DOM with unchanged textContent', () => {
    const canvas = document.createElement('canvas');
    const h1 = document.createElement('h1');
    h1.id = 'cover-title';
    h1.textContent = 'Stello';
    document.body.appendChild(h1);

    textReveal(canvas, h1, { text: 'Stello', n: 16, seed: 1 });

    const found = document.querySelector('h1');
    expect(found).toBe(h1);
    expect(found?.textContent).toBe('Stello');
  });

  it('returns an InkStage with scene/goto/next', () => {
    const canvas = document.createElement('canvas');
    const h1 = document.createElement('h1');
    h1.textContent = 'Stello';
    document.body.appendChild(h1);
    const stage = textReveal(canvas, h1, { text: 'Stello', n: 16 });
    expect(typeof stage.scene).toBe('function');
    expect(typeof stage.goto).toBe('function');
    expect(typeof stage.next).toBe('function');
  });

  it('h1 starts at opacity "0" and canvas has a CSS transition set', () => {
    const canvas = document.createElement('canvas');
    const h1 = document.createElement('h1');
    h1.textContent = 'Stello';
    document.body.appendChild(h1);
    textReveal(canvas, h1, { text: 'Stello', n: 16, seed: 1 });
    expect(h1.style.opacity).toBe('0');
    expect(canvas.style.transition).toContain('opacity');
    expect(h1.style.transition).toContain('opacity');
  });

  it('after morph settles: h1.opacity is "1" and canvas.opacity is "0"', async () => {
    const canvas = document.createElement('canvas');
    const h1 = document.createElement('h1');
    h1.textContent = 'Stello';
    document.body.appendChild(h1);

    textReveal(canvas, h1, { text: 'Stello', n: 16, seed: 1 });

    // jsdom runs rAF callbacks via its own scheduler; wait for settle.
    await vi.waitFor(() => {
      expect(h1.style.opacity).toBe('1');
    }, { timeout: 3000 });

    expect(canvas.style.opacity).toBe('0');
  });

  it('h1 DOM node is unchanged after settle (same node, same textContent)', async () => {
    const canvas = document.createElement('canvas');
    const h1 = document.createElement('h1');
    h1.id = 'cover-title';
    h1.textContent = 'Stello';
    document.body.appendChild(h1);

    textReveal(canvas, h1, { text: 'Stello', n: 16, seed: 1 });

    await vi.waitFor(() => {
      expect(h1.style.opacity).toBe('1');
    }, { timeout: 3000 });

    const found = document.querySelector('h1');
    expect(found).toBe(h1);
    expect(found?.textContent).toBe('Stello');
  });
});
