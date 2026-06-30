/**
 * sumi — Svelte action adapter
 *
 * Svelte actions are plain TS — no Svelte import needed.
 * Compatible with Svelte 4 and 5 (use:inkReveal directive).
 *
 * Usage:
 *   import { inkReveal } from 'sumi/adapters/svelte'
 *
 * @example
 * <script lang="ts">
 *   import { inkReveal } from 'sumi/adapters/svelte'
 *   import type { InkRevealParams } from 'sumi/adapters/svelte'
 * </script>
 *
 * <!-- text reveal -->
 * <canvas use:inkReveal={{ kind: 'text', text: 'Hello', h1El: titleEl }} />
 * <h1 bind:this={titleEl}>Hello</h1>
 *
 * <!-- image reveal (src string) -->
 * <canvas use:inkReveal={{ kind: 'image', src: '/hero.jpg', alt: 'Hero' }} />
 *
 * <!-- image reveal (pre-loaded element) -->
 * <canvas use:inkReveal={{ kind: 'image', img: preloadedImg }} />
 */

import {
  textReveal,
  imageReveal,
  sceneMorph,
  type TextRevealOpts,
  type ImageRevealOpts,
  type SceneMorphOpts,
  type InkStage,
} from '../src/index';

// ---------------------------------------------------------------------------
// Param types
// ---------------------------------------------------------------------------

export type InkRevealParamsText = {
  kind: 'text';
  /** The text to reveal. */
  text: string;
  /** The h1/heading element that receives the text after particle settle. */
  h1El: HTMLElement;
  font?: TextRevealOpts['font'];
  shape?: TextRevealOpts['shape'];
  seed?: number;
  n?: number;
};

export type InkRevealParamsImage = {
  kind: 'image';
  /** URL string — action loads it into an Image before calling imageReveal. */
  src?: string;
  /** Pre-loaded CanvasImageSource — used directly if provided (takes priority over src). */
  img?: CanvasImageSource;
  alt?: string;
  shape?: ImageRevealOpts['shape'];
  seed?: number;
  n?: number;
};

export type InkRevealParamsScene = {
  kind: 'scene';
  opts: SceneMorphOpts;
};

export type InkRevealParams =
  | InkRevealParamsText
  | InkRevealParamsImage
  | InkRevealParamsScene;

// ---------------------------------------------------------------------------
// Action return type (Svelte action contract)
// ---------------------------------------------------------------------------

export type InkRevealAction = {
  update?: (params: InkRevealParams) => void;
  destroy: () => void;
};

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

function createStage(node: HTMLCanvasElement, params: InkRevealParams): InkStage | null {
  if (params.kind === 'text') {
    return textReveal(node, params.h1El, {
      text: params.text,
      font: params.font,
      shape: params.shape,
      seed: params.seed,
      n: params.n,
    });
  }

  if (params.kind === 'image') {
    const opts: ImageRevealOpts = {
      alt: params.alt,
      shape: params.shape,
      seed: params.seed,
      n: params.n,
    };
    if (params.img) {
      return imageReveal(node, params.img, opts);
    }
    if (params.src) {
      const image = new Image();
      // Stage is created once image loads; action returns synchronously with a
      // placeholder so destroy() is always callable. We capture stage via closure.
      let stage: InkStage | null = null;
      let cancelled = false;
      image.onload = () => {
        if (!cancelled) {
          stage = imageReveal(node, image, opts);
        }
      };
      image.src = params.src;
      // Return a synthetic handle that delegates to the real stage once it exists.
      return {
        isStatic: () => stage?.isStatic() ?? false,
        snapshotFor: (rect) => stage?.snapshotFor(rect),
        morph: (from, to, morphOpts) => stage?.morph(from, to, morphOpts),
        destroy: () => {
          cancelled = true;
          stage?.destroy();
        },
      } as InkStage;
    }
    return null;
  }

  if (params.kind === 'scene') {
    return sceneMorph(node, params.opts);
  }

  return null;
}

/**
 * Svelte action: mount an ink stage on a canvas element.
 *
 * The action creates the stage when the element is added to the DOM and
 * calls `destroy()` when it is removed. Passing new params triggers a
 * destroy + re-create (simplest safe strategy for thin adapters).
 */
export function inkReveal(
  node: HTMLCanvasElement,
  params: InkRevealParams,
): InkRevealAction {
  let stage: InkStage | null = createStage(node, params);

  return {
    update(newParams: InkRevealParams) {
      stage?.destroy();
      stage = createStage(node, newParams);
    },
    destroy() {
      stage?.destroy();
      stage = null;
    },
  };
}
