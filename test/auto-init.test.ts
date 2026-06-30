// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { parseInkAttributes, type InkSpec } from '../src/auto-init';

describe('parseInkAttributes', () => {
  it('maps one of each data-ink attribute to a spec in document order', () => {
    document.body.innerHTML = `
      <h1 data-ink="title">  Hello Ink  </h1>
      <div data-ink="stat" data-value="42%">arr</div>
      <section data-ink-transition="morph"></section>
    `;

    const specs: InkSpec[] = parseInkAttributes(document.body);

    expect(specs).toHaveLength(3);
    expect(specs.map((s) => s.kind)).toEqual(['title', 'stat', 'transition']);

    const [title, stat, transition] = specs;

    expect(title.kind).toBe('title');
    expect(title.text).toBe('Hello Ink'); // textContent trimmed
    expect(title.el.tagName).toBe('H1');

    expect(stat.kind).toBe('stat');
    expect(stat.value).toBe('42%'); // from data-value
    expect(stat.text).toBeUndefined();

    expect(transition.kind).toBe('transition');
    expect(transition.value).toBeUndefined();
    expect(transition.text).toBeUndefined();
    expect(transition.el.tagName).toBe('SECTION');
  });

  it('ignores a data-ink="stat" element with no data-value', () => {
    document.body.innerHTML = `<div data-ink="stat">no value here</div>`;

    const specs = parseInkAttributes(document.body);

    expect(specs).toEqual([]);
  });

  it('returns an empty array when there are no ink attributes', () => {
    document.body.innerHTML = `<p>plain</p>`;
    expect(parseInkAttributes(document.body)).toEqual([]);
  });
});
