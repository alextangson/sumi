import { textReveal } from './components/text-reveal';

export type InkSpec = {
  kind: 'title' | 'stat' | 'transition';
  text?: string;
  value?: string;
  el: Element;
};

export function parseInkAttributes(root: ParentNode): InkSpec[] {
  const els = root.querySelectorAll('[data-ink], [data-ink-transition]');
  const specs: InkSpec[] = [];

  for (const el of Array.from(els)) {
    if (el.hasAttribute('data-ink-transition')) {
      specs.push({ kind: 'transition', el });
      continue;
    }

    const ink = el.getAttribute('data-ink');

    if (ink === 'title') {
      specs.push({ kind: 'title', text: (el.textContent ?? '').trim(), el });
      continue;
    }

    if (ink === 'stat') {
      const value = el.getAttribute('data-value');
      if (value !== null) {
        specs.push({ kind: 'stat', value, el });
      }
    }
  }

  return specs;
}

// BROWSER-ONLY: build stages from specs. Thin by design — title specs wire a
// textReveal stage onto an injected/sibling <canvas>; stat/transition scene
// wiring is smoke-tested in demo/single-file-deck.html, not here.
export function autoInit(root: ParentNode): void {
  const specs = parseInkAttributes(root);

  for (const spec of specs) {
    if (spec.kind === 'title' && spec.el instanceof HTMLElement) {
      const canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      spec.el.parentNode?.insertBefore(canvas, spec.el);
      textReveal(canvas, spec.el, { text: spec.text ?? '' });
    }
  }
}
