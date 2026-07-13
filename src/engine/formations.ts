import type { Pt, PixelBuffer, Rng } from '../types';
import { samplePixelBuffer, containRect, type SampleOpts } from './sample';
import { resampleToN } from './resample';

export type TextSampleOpts = {
  font: string;
  levels: number;
  /** Maximum glyph dimension in normalized field space. Default 0.8. */
  fit?: number;
  /** Normalized offset from the canvas center. */
  offsetX?: number;
  /** Normalized offset from the canvas center. */
  offsetY?: number;
};

// Pure composition: darkness-weighted sample -> resample to exactly n points.
// Deterministic for a fixed (buf, opts, rng seed).
export function fromImageData(
  buf: PixelBuffer,
  n: number,
  opts: SampleOpts,
  rng: Rng,
): Pt[] {
  return resampleToN(samplePixelBuffer(buf, opts), n, rng);
}

// --- BROWSER-ONLY wrappers below ---
// NOTE: fromText/fromImage need a real <canvas> 2D context, so they are NOT
// unit-tested in vitest; they are smoke-tested in demo/single-file-deck.html.

function canvasToPixelBuffer(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
): PixelBuffer {
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { data: img.data, width: img.width, height: img.height };
}

// CONTRACT: caller MUST `await document.fonts.ready` before calling, because
// this sync signature cannot await font load. The component layer (Task 12)
// awaits it before invoking fromText.
export function fromText(
  text: string,
  n: number,
  opts: TextSampleOpts,
  rng: Rng,
): Pt[] {
  // Use a square canvas so samplePixelBuffer's equal x/width and y/height
  // divisors map correctly onto the square coordinate space used by the renderer.
  // A 1024×256 canvas would compress y by 4× relative to x.
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f4f3ee';
  ctx.fillRect(0, 0, size, size);

  // Measure at the caller-supplied font, then scale the context rather than
  // rewriting the font string. This supports every CSS unit accepted by canvas
  // (including vw/vmin) and keeps complex font shorthands intact.
  ctx.font = opts.font;
  const metrics = ctx.measureText(text);
  const textW = metrics.width;
  const textH = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
  const maxDimension = Math.max(textW, textH);
  const fit = Math.max(0.02, Math.min(0.98, opts.fit ?? 0.8));
  const scale = maxDimension > 0 ? (size * fit) / maxDimension : 1;
  const offsetX = (opts.offsetX ?? 0) * size;
  const offsetY = (opts.offsetY ?? 0) * size;

  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.save();
  ctx.translate(size / 2 + offsetX, size / 2 + offsetY);
  ctx.scale(scale, scale);
  ctx.fillText(text, 0, 0);
  ctx.restore();
  const buf = canvasToPixelBuffer(canvas, ctx);
  const sampleOpts: SampleOpts = { levels: opts.levels };
  return fromImageData(buf, n, sampleOpts, rng);
}

export function fromImage(
  img: CanvasImageSource,
  n: number,
  opts: SampleOpts,
  rng: Rng,
): Pt[] {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  ctx.fillStyle = '#f4f3ee';
  ctx.fillRect(0, 0, size, size);
  const srcW = (img as HTMLImageElement).naturalWidth
    ?? (img as HTMLVideoElement).videoWidth
    ?? (img as HTMLCanvasElement).width
    ?? size;
  const srcH = (img as HTMLImageElement).naturalHeight
    ?? (img as HTMLVideoElement).videoHeight
    ?? (img as HTMLCanvasElement).height
    ?? size;
  const fit = containRect(srcW || size, srcH || size, size, size);
  ctx.drawImage(img, fit.x, fit.y, fit.w, fit.h);
  const buf = canvasToPixelBuffer(canvas, ctx);
  return fromImageData(buf, n, opts, rng);
}

// NOTE: fromShape and fromSVGPath are visually smoke-tested in the gallery/playground.
// They return [] in jsdom/SSR where getContext('2d') is null — see null-ctx guard.
export function fromShape(
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
  n: number,
  opts: SampleOpts,
  rng: Rng,
): Pt[] {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  ctx.fillStyle = '#f4f3ee';
  ctx.fillRect(0, 0, size, size);
  draw(ctx, size);
  const buf = canvasToPixelBuffer(canvas, ctx);
  return fromImageData(buf, n, opts, rng);
}

export function fromSVGPath(
  pathData: string,
  n: number,
  opts: SampleOpts & { viewBox?: [number, number, number, number] },
  rng: Rng,
): Pt[] {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  ctx.fillStyle = '#f4f3ee';
  ctx.fillRect(0, 0, size, size);
  const path = new Path2D(pathData);
  if (opts.viewBox) {
    const [minX, minY, vbW, vbH] = opts.viewBox;
    const fit = containRect(vbW, vbH, size, size);
    ctx.save();
    ctx.translate(fit.x - minX * (fit.w / vbW), fit.y - minY * (fit.h / vbH));
    ctx.scale(fit.w / vbW, fit.h / vbH);
  }
  ctx.fillStyle = '#11131A';
  ctx.fill(path);
  if (opts.viewBox) ctx.restore();
  const { viewBox: _vb, ...sampleOpts } = opts;
  const buf = canvasToPixelBuffer(canvas, ctx);
  return fromImageData(buf, n, sampleOpts, rng);
}
