/**
 * sumi — reveal.js helper
 *
 * Injects a full-bleed, pointer-events:none ink canvas behind reveal.js slides
 * and runs a persistent ambient ink layer (sceneMorph by default, or imageReveal
 * if an image is provided).
 *
 * Usage:
 *   import { injectInkBackground } from 'sumi/adapters/reveal'
 *
 * @example
 * // In your reveal.js initialisation script:
 * import Reveal from 'reveal.js'
 * import { injectInkBackground } from 'sumi/adapters/reveal'
 * import { fromText } from 'sumi'
 *
 * Reveal.initialize({ ... })
 *
 * const handle = injectInkBackground(document.querySelector('.reveal'), {
 *   kind: 'scene',
 *   opts: {
 *     from: fromText('OPEN', 6000),
 *     to:   fromText('CLOSE', 6000),
 *   },
 * })
 *
 * // On teardown:
 * handle.destroy()
 */

import {
  sceneMorph,
  imageReveal,
  type SceneMorphOpts,
  type ImageRevealOpts,
  type InkStage,
} from '../src/index';

// ---------------------------------------------------------------------------
// Param types
// ---------------------------------------------------------------------------

export type InkBackgroundParamsScene = {
  kind: 'scene';
  opts: SceneMorphOpts;
};

export type InkBackgroundParamsImage = {
  kind: 'image';
  img: CanvasImageSource;
  opts?: ImageRevealOpts;
};

export type InkBackgroundParams =
  | InkBackgroundParamsScene
  | InkBackgroundParamsImage;

// ---------------------------------------------------------------------------
// Handle
// ---------------------------------------------------------------------------

export type InkBackgroundHandle = {
  /** The canvas element injected into the deck. */
  canvas: HTMLCanvasElement;
  /** The underlying InkStage (for manual morph calls etc.). */
  stage: InkStage;
  /** Remove the canvas from the DOM and destroy the stage. */
  destroy(): void;
};

// ---------------------------------------------------------------------------
// injectInkBackground
// ---------------------------------------------------------------------------

/**
 * Appends a full-bleed `pointer-events:none` canvas as the first child of
 * `deckEl` and starts an ink layer on it.
 *
 * The canvas sits at `z-index: 0` and the reveal.js `.slides` container sits
 * above it — no CSS changes to reveal's own layout are needed.
 *
 * @param deckEl  The `.reveal` wrapper element (or any container you control).
 * @param params  Which ink effect to run: `'scene'` (SceneMorph) or `'image'` (ImageReveal).
 */
export function injectInkBackground(
  deckEl: HTMLElement,
  params: InkBackgroundParams,
): InkBackgroundHandle {
  const canvas = document.createElement('canvas');

  // Full-bleed, behind everything, non-interactive.
  Object.assign(canvas.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '0',
  } satisfies Partial<CSSStyleDeclaration>);

  canvas.setAttribute('aria-hidden', 'true');

  // Insert before the first child so it sits behind the slides.
  deckEl.insertBefore(canvas, deckEl.firstChild);

  // Ensure the deck is a positioning context.
  if (getComputedStyle(deckEl).position === 'static') {
    deckEl.style.position = 'relative';
  }

  let stage: InkStage;

  if (params.kind === 'scene') {
    stage = sceneMorph(canvas, params.opts);
  } else {
    stage = imageReveal(canvas, params.img, params.opts);
  }

  return {
    canvas,
    stage,
    destroy() {
      stage.destroy();
      canvas.parentNode?.removeChild(canvas);
    },
  };
}
