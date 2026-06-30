// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Pt } from '../src/types';

vi.mock('../src/engine/formations', () => ({
  fromText: (_text: string, n: number): Pt[] =>
    Array.from({ length: n }, (_, i) => ({ x: (i / n) - 0.5, y: 0, lvl: i % 24 })),
  fromImage: () => [],
}));

import { statReveal, parseStatValue } from '../src/components/stat-reveal';

beforeEach(() => {
  (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts = {
    ready: Promise.resolve(),
  };
});

afterEach(() => {
  document.body.innerHTML = '';
});

// ── parseStatValue unit tests ─────────────────────────────────────────────────

describe('parseStatValue', () => {
  it('parses a bare number', () => {
    expect(parseStatValue('42')).toEqual({ num: 42, prefix: '', suffix: '' });
  });

  it('parses percentage suffix', () => {
    expect(parseStatValue('95%')).toEqual({ num: 95, prefix: '', suffix: '%' });
  });

  it('parses number with commas', () => {
    const r = parseStatValue('1,200');
    expect(r).not.toBeNull();
    expect(r!.num).toBe(1200);
    expect(r!.prefix).toBe('');
    expect(r!.suffix).toBe('');
  });

  it('parses dollar prefix', () => {
    const r = parseStatValue('$42');
    expect(r).not.toBeNull();
    expect(r!.num).toBe(42);
    expect(r!.prefix).toBe('$');
    expect(r!.suffix).toBe('');
  });

  it('returns null for non-numeric strings', () => {
    expect(parseStatValue('hello')).toBeNull();
    expect(parseStatValue('')).toBeNull();
  });

  it('parses decimal number', () => {
    const r = parseStatValue('3.14');
    expect(r).not.toBeNull();
    expect(r!.num).toBeCloseTo(3.14);
  });

  it('parses negative integer: "-5" → num -5, no prefix', () => {
    const r = parseStatValue('-5');
    expect(r).not.toBeNull();
    expect(r!.num).toBe(-5);
    expect(r!.prefix).toBe('');
    expect(r!.suffix).toBe('');
  });

  it('parses negative decimal: "-3.14" → num -3.14, no prefix', () => {
    const r = parseStatValue('-3.14');
    expect(r).not.toBeNull();
    expect(r!.num).toBeCloseTo(-3.14);
    expect(r!.prefix).toBe('');
    expect(r!.suffix).toBe('');
  });
});

// ── statReveal component tests ────────────────────────────────────────────────

describe('statReveal', () => {
  it('returns an InkStage with morph/snapshotFor/isStatic/destroy', () => {
    const canvas = document.createElement('canvas');
    const el = document.createElement('span');
    el.textContent = '95%';
    document.body.appendChild(el);

    const stage = statReveal(canvas, el, { value: '95%', n: 16, seed: 1 });
    expect(typeof stage.morph).toBe('function');
    expect(typeof stage.isStatic).toBe('function');
    expect(typeof stage.snapshotFor).toBe('function');
    expect(typeof stage.destroy).toBe('function');
    stage.destroy();
  });

  it('sets canvas aria-hidden to "true"', () => {
    const canvas = document.createElement('canvas');
    const el = document.createElement('span');
    el.textContent = '42';
    document.body.appendChild(el);

    statReveal(canvas, el, { value: '42', n: 16, seed: 1 });
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
  });

  it('leaves the same el in the DOM', () => {
    const canvas = document.createElement('canvas');
    const el = document.createElement('div');
    el.id = 'stat';
    el.textContent = '1,200';
    document.body.appendChild(el);

    statReveal(canvas, el, { value: '1,200', n: 16, seed: 1 });

    const found = document.getElementById('stat');
    expect(found).toBe(el);
  });

  it('without countUp, el textContent equals value after settle', async () => {
    const canvas = document.createElement('canvas');
    const el = document.createElement('span');
    el.textContent = '95%';
    document.body.appendChild(el);

    statReveal(canvas, el, { value: '95%', n: 16, seed: 1 });

    await vi.waitFor(() => {
      expect(el.style.opacity).toBe('1');
    }, { timeout: 3000 });

    expect(el.textContent).toBe('95%');
  });

  it('with countUp, el starts with 0-form and eventually shows target after settle', async () => {
    const canvas = document.createElement('canvas');
    const el = document.createElement('span');
    el.textContent = '95%';
    document.body.appendChild(el);

    statReveal(canvas, el, { value: '95%', n: 16, seed: 1, countUp: true });

    // Before settle: el should show "0%" (countUp start)
    expect(el.textContent).toBe('0%');

    // After textReveal settle, onSettle fires and count-up rAF begins.
    // Wait for el opacity to reach '1' (set by textReveal's internal onSettle).
    await vi.waitFor(() => {
      expect(el.style.opacity).toBe('1');
    }, { timeout: 3000 });

    // count-up should eventually land on the target value
    await vi.waitFor(() => {
      expect(el.textContent).toBe('95%');
    }, { timeout: 3000 });
  });
});
