// Stub — full implementation in Task 9.
// autoInit (src/auto-init.ts) calls this at runtime in the browser;
// it is NOT imported by the unit-test environment.
import type { InkStage } from '../stage/ink-stage';

export type TextRevealOpts = { text: string };

export function textReveal(
  _canvas: HTMLCanvasElement,
  _h1: HTMLElement,
  _opts: TextRevealOpts,
): InkStage {
  throw new Error('textReveal: not yet implemented — pending Task 9');
}
