import type { Pt, PixelBuffer, Rng } from '../types';
import { samplePixelBuffer, containRect, type SampleOpts } from './sample';
import { resampleToN } from './resample';

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
  opts: { font: string; levels: number },
  rng: Rng,
): Pt[] {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f4f3ee';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  ctx.font = opts.font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
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
