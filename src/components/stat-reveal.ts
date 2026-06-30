import { textReveal } from './text-reveal';
import type { InkStage } from '../stage/ink-stage';
import type { ParticleShape } from '../engine/renderer';

export type StatRevealOpts = {
  value: string;
  n?: number;
  seed?: number;
  shape?: ParticleShape;
  countUp?: boolean;
};

export type ParsedStatValue = { num: number; prefix: string; suffix: string } | null;

/** Parse a numeric-ish string like "95%", "1,200", "$42", "42". Returns null if not numeric. */
export function parseStatValue(value: string): ParsedStatValue {
  // Match optional prefix (non-digit, non-dot, non-comma chars), number, optional suffix
  const m = /^([^0-9]*)([0-9][0-9,.]*)([^0-9]*)$/.exec(value.trim());
  if (!m) return null;
  const num = parseFloat(m[2].replace(/,/g, ''));
  if (!Number.isFinite(num)) return null;
  return { num, prefix: m[1], suffix: m[3] };
}

function formatNum(num: number, originalNum: string): string {
  // Preserve comma formatting if original had commas
  if (originalNum.includes(',')) {
    return Math.round(num).toLocaleString('en-US');
  }
  // Preserve decimals if original had them
  const dotIdx = originalNum.indexOf('.');
  if (dotIdx !== -1) {
    const decimals = originalNum.length - dotIdx - 1;
    return num.toFixed(decimals);
  }
  return String(Math.round(num));
}

export function statReveal(
  canvas: HTMLCanvasElement,
  el: HTMLElement,
  opts: StatRevealOpts,
): InkStage {
  const { value, countUp } = opts;

  // Set the element to show the value text (used for particle sampling)
  el.textContent = value;

  const stage = textReveal(canvas, el, {
    text: value,
    n: opts.n,
    seed: opts.seed,
    shape: opts.shape,
  });

  if (countUp) {
    const parsed = parseStatValue(value);
    if (parsed !== null) {
      const { num: targetNum, prefix, suffix } = parsed;
      // Extract the raw numeric string for formatting reference
      const rawNumStr = /([0-9][0-9,.]*)/.exec(value)?.[1] ?? String(targetNum);

      // Start el at "0" display
      el.textContent = prefix + formatNum(0, rawNumStr) + suffix;

      // Observe the wordmark opacity to start count-up on settle
      const observer = new MutationObserver(() => {
        if (el.style.opacity === '1') {
          observer.disconnect();
          // Animate count-up over ~1s after particle settle
          const duration = 1000;
          const start = performance.now();
          function tick(now: number): void {
            const raw = Math.min(1, (now - start) / duration);
            // ease-out: square root
            const t = Math.sqrt(raw);
            el.textContent = prefix + formatNum(t * targetNum, rawNumStr) + suffix;
            if (raw < 1) {
              requestAnimationFrame(tick);
            } else {
              el.textContent = prefix + formatNum(targetNum, rawNumStr) + suffix;
            }
          }
          requestAnimationFrame(tick);
        }
      });
      observer.observe(el, { attributes: true, attributeFilter: ['style'] });
    }
  }

  return stage;
}
