import type { TextSampleOpts } from '../engine/formations';

const DEFAULT_FONT = '700 120px sans-serif';

function computedCanvasFont(el: HTMLElement): string | undefined {
  if (typeof getComputedStyle !== 'function') return undefined;
  const style = getComputedStyle(el);
  if (!style.fontSize || !style.fontFamily) return undefined;
  return [
    style.fontStyle,
    style.fontVariant,
    style.fontWeight,
    style.fontSize,
    style.fontFamily,
  ].filter(Boolean).join(' ');
}

/** Match a sampled text formation to the live DOM element it will hand off to. */
export function textSampleOptsForElement(
  canvas: HTMLCanvasElement,
  el: HTMLElement,
  fontOverride?: string,
  levels = 24,
): TextSampleOpts {
  const canvasRect = canvas.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const fieldSize = Math.min(canvasRect.width, canvasRect.height);

  if (fieldSize <= 0 || elRect.width <= 0 || elRect.height <= 0) {
    return { font: fontOverride ?? computedCanvasFont(el) ?? DEFAULT_FONT, levels };
  }

  const canvasCenterX = canvasRect.left + canvasRect.width / 2;
  const canvasCenterY = canvasRect.top + canvasRect.height / 2;
  const elCenterX = elRect.left + elRect.width / 2;
  const elCenterY = elRect.top + elRect.height / 2;

  return {
    font: fontOverride ?? computedCanvasFont(el) ?? DEFAULT_FONT,
    levels,
    fit: Math.min(0.98, Math.max(elRect.width, elRect.height) / fieldSize),
    offsetX: (elCenterX - canvasCenterX) / fieldSize,
    offsetY: (elCenterY - canvasCenterY) / fieldSize,
  };
}
