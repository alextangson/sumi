// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Pt } from '../src/types';

vi.mock('../src/engine/formations', () => ({
  fromText: (_text: string, n: number): Pt[] =>
    Array.from({ length: n }, (_, i) => ({ x: (i / n) - 0.5, y: 0, lvl: i % 24 })),
  fromImage: () => [],
}));

import { coverReveal } from '../src/components/cover-reveal';

beforeEach(() => {
  (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts = {
    ready: Promise.resolve(),
  };
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('coverReveal', () => {
  it('returns an InkStage with morph/snapshotFor/isStatic/destroy', () => {
    const canvas = document.createElement('canvas');
    const wordmark = document.createElement('h1');
    wordmark.textContent = 'Stello';
    document.body.appendChild(wordmark);

    const stage = coverReveal(canvas, { wordmark, n: 16, seed: 1 });
    expect(typeof stage.morph).toBe('function');
    expect(typeof stage.isStatic).toBe('function');
    expect(typeof stage.snapshotFor).toBe('function');
    expect(typeof stage.destroy).toBe('function');
    stage.destroy();
  });

  it('sets canvas aria-hidden to "true"', () => {
    const canvas = document.createElement('canvas');
    const wordmark = document.createElement('h1');
    wordmark.textContent = 'Acme';
    document.body.appendChild(wordmark);

    coverReveal(canvas, { wordmark, n: 16, seed: 1 });
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
  });

  it('leaves the wordmark element in the DOM with unchanged textContent', () => {
    const canvas = document.createElement('canvas');
    const wordmark = document.createElement('h1');
    wordmark.id = 'brand';
    wordmark.textContent = 'Acme Corp';
    document.body.appendChild(wordmark);

    coverReveal(canvas, { wordmark, n: 16, seed: 1 });

    const found = document.getElementById('brand');
    expect(found).toBe(wordmark);
    expect(found?.textContent).toBe('Acme Corp');
  });

  it('hands off to the crisp DOM wordmark and fades the tagline in on settle', async () => {
    const canvas = document.createElement('canvas');
    const wordmark = document.createElement('h1');
    wordmark.textContent = 'Stello';
    document.body.appendChild(wordmark);

    const tagline = document.createElement('p');
    tagline.textContent = 'Build with intent';
    document.body.appendChild(tagline);

    const stage = coverReveal(canvas, { wordmark, tagline, n: 16, seed: 1 });

    // DOM text yields while the GPU particles assemble.
    expect(wordmark.style.opacity).toBe('0');

    // onSettle fires after the coalesce — tagline fades in.
    await vi.waitFor(() => {
      expect(tagline.style.opacity).toBe('1');
    }, { timeout: 3000 });

    expect(wordmark.style.opacity).toBe('1');
    expect(canvas.style.opacity).toBe('0');
    expect(tagline.style.transition).toContain('opacity');
    stage.destroy();
  });
});
