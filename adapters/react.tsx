/**
 * sumi — React adapter
 *
 * Peer dependency: react ≥18. Import from your project after installing:
 *   npm i sumi   (sumi is a peerDep — framework package is not yet published)
 *
 * Usage:
 *   import { useInkReveal, InkText, InkImage } from 'sumi/adapters/react'
 */
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import {
  textReveal,
  imageReveal,
  type TextRevealOpts,
  type ImageRevealOpts,
  type InkStage,
} from '../src/index';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export type UseInkRevealResult = { stage: InkStage | null };

/**
 * Mount an ink stage on a canvas ref.
 *
 * @param canvasRef  A React ref pointing to an HTMLCanvasElement.
 * @param factory    A function that receives the canvas and returns an InkStage.
 *                   Called once on mount; the returned stage is destroyed on unmount.
 *
 * @example
 * const canvasRef = useRef<HTMLCanvasElement>(null);
 * useInkReveal(canvasRef, (canvas) =>
 *   textReveal(canvas, h1Ref.current!, { text: 'Hello' })
 * );
 */
export function useInkReveal(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  factory: (canvas: HTMLCanvasElement) => InkStage,
): void {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stage = factory(canvas);
    return () => stage.destroy();
    // factory is intentionally excluded — callers should memoize or define outside render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef]);
}

// ---------------------------------------------------------------------------
// <InkText>
// ---------------------------------------------------------------------------

export type InkTextProps = {
  text: string;
  font?: string;
  shape?: TextRevealOpts['shape'];
  seed?: number;
  n?: number;
  /** CSS class applied to the outer wrapper div. */
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Self-contained ink text reveal component.
 * Renders a full-bleed canvas + a visually hidden h1 for accessibility.
 *
 * @example
 * <InkText text="sumi" font="700 120px sans-serif" />
 */
export function InkText({
  text,
  font,
  shape,
  seed,
  n,
  className,
  style,
}: InkTextProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const h1Ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const h1 = h1Ref.current;
    if (!canvas || !h1) return;
    const stage = textReveal(canvas, h1, { text, font, shape, seed, n });
    return () => stage.destroy();
  }, [text, font, shape, seed, n]);

  return (
    <div
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%', ...style }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />
      <h1
        ref={h1Ref}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: 0,
        }}
      >
        {text}
      </h1>
    </div>
  );
}

// ---------------------------------------------------------------------------
// <InkImage>
// ---------------------------------------------------------------------------

export type InkImageProps = {
  /** URL to load; mutually exclusive with `img`. */
  src?: string;
  /** Pre-loaded image element; mutually exclusive with `src`. */
  img?: CanvasImageSource;
  alt?: string;
  shape?: ImageRevealOpts['shape'];
  seed?: number;
  n?: number;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Self-contained ink image reveal component.
 * Pass either `src` (URL) or a pre-loaded `img` (HTMLImageElement / ImageBitmap etc.).
 *
 * @example
 * <InkImage src="/hero.jpg" alt="Hero scene" />
 */
export function InkImage({
  src,
  img,
  alt,
  shape,
  seed,
  n,
  className,
  style,
}: InkImageProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let stage: InkStage;
    let cancelled = false;

    const opts: ImageRevealOpts = { alt, shape, seed, n };

    if (img) {
      stage = imageReveal(canvas, img, opts);
      return () => stage.destroy();
    }

    if (src) {
      const image = new Image();
      image.onload = () => {
        if (cancelled) return;
        stage = imageReveal(canvas, image, opts);
      };
      image.src = src;
      return () => {
        cancelled = true;
        // stage may not have been created yet if image hadn't loaded
        stage?.destroy();
      };
    }
  }, [src, img, alt, shape, seed, n]);

  return (
    <canvas
      ref={canvasRef}
      aria-label={alt}
      role={alt ? 'img' : undefined}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%', ...style }}
    />
  );
}
