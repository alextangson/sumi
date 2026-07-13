import type { MotionStyle, Pt } from '../types';
import { createRng } from '../engine/rng';
import { createField } from '../engine/field';
import { matchFormation } from '../engine/resample';
import { createPalette } from '../engine/palette';
import { withDepth } from '../engine/depth';
import { createInkStage, type TiltOpts } from '../stage/ink-stage';
import type { ParticleShape } from '../engine/renderer';

export type SequenceStep = {
  /** Name of the formation this step settles on. */
  to: string;
  motion?: MotionStyle;
  durationMs?: number;
  /** Time to hold the settled target before the next step. */
  holdMs?: number;
  stagger?: number;
};

export type SequenceState = 'idle' | 'playing' | 'paused' | 'complete' | 'destroyed';

export type SequenceStepEvent = {
  index: number;
  from: string;
  to: string;
  motion: MotionStyle;
};

export type SequenceMorphOpts = {
  formations: Record<string, Pt[]>;
  steps: SequenceStep[];
  initial?: string;
  n?: number;
  seed?: number;
  shape?: ParticleShape;
  tilt?: TiltOpts | false;
  autoplay?: boolean;
  loop?: boolean;
  initialHoldMs?: number;
  loopDelayMs?: number;
  defaultDurationMs?: number;
  defaultHoldMs?: number;
  defaultStagger?: number;
  onStepChange?: (event: SequenceStepEvent) => void;
  onStateChange?: (state: SequenceState) => void;
  onComplete?: () => void;
};

export type ParticleSequence = {
  play(): void;
  pause(): void;
  resume(): void;
  replay(): void;
  getState(): SequenceState;
  getCurrentFormation(): string;
  destroy(): void;
};

const DEFAULT_DEPTH_AMPLITUDE = 0.22;

function now(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

function formationNames(opts: SequenceMorphOpts): string[] {
  const names = Object.keys(opts.formations);
  if (names.length === 0) throw new Error('sequenceMorph: expected at least one formation');
  return names;
}

function validateSequence(opts: SequenceMorphOpts, names: string[], initial: string, n: number): void {
  if (!opts.formations[initial]) {
    throw new Error(`sequenceMorph: initial formation "${initial}" is not defined`);
  }
  if (n < 0 || !Number.isInteger(n)) {
    throw new Error(`sequenceMorph: n must be a non-negative integer, got ${n}`);
  }
  for (const name of names) {
    const points = opts.formations[name];
    if (points.length !== n) {
      throw new Error(`sequenceMorph: formation "${name}" expected ${n} points, got ${points.length}`);
    }
  }
  for (const step of opts.steps) {
    if (!opts.formations[step.to]) {
      throw new Error(`sequenceMorph: step target "${step.to}" is not defined`);
    }
  }
}

function shouldAddDepth(tilt: TiltOpts | false | undefined): boolean {
  return tilt !== false && (tilt as TiltOpts | undefined)?.depth !== false;
}

export function sequenceMorph(
  canvas: HTMLCanvasElement,
  opts: SequenceMorphOpts,
): ParticleSequence {
  canvas.setAttribute('aria-hidden', 'true');

  const names = formationNames(opts);
  const initial = opts.initial ?? names[0];
  const n = opts.n ?? opts.formations[initial]?.length ?? 0;
  validateSequence(opts, names, initial, n);

  const field = createField(n, createRng(opts.seed ?? 1));
  const initialPoints = opts.formations[initial];
  const addDepth = shouldAddDepth(opts.tilt);
  for (const name of names) {
    const source = name === initial
      ? initialPoints
      : matchFormation(initialPoints, opts.formations[name]);
    const points = addDepth && !source.some((point) => point.z !== undefined)
      ? withDepth(source, DEFAULT_DEPTH_AMPLITUDE)
      : source;
    field.setFormation(name, points);
  }
  field.step({ from: initial, to: initial, m: 1, motion: 'direct' });

  const palette = createPalette([244, 243, 238], [17, 19, 24], 24);
  const stage = createInkStage(canvas, field, palette, {
    shape: opts.shape,
    tilt: opts.tilt,
  });

  let state: SequenceState = 'idle';
  let currentFormation = initial;
  let nextStepIndex = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pendingAction: (() => void) | undefined;
  let remainingDelay = 0;
  let timerStartedAt = 0;

  function setState(next: SequenceState): void {
    if (state === next) return;
    state = next;
    opts.onStateChange?.(state);
  }

  function clearTimer(): void {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }

  function runPendingAction(): void {
    const action = pendingAction;
    pendingAction = undefined;
    remainingDelay = 0;
    timer = undefined;
    action?.();
  }

  function schedule(delayMs: number, action: () => void): void {
    clearTimer();
    pendingAction = action;
    remainingDelay = Math.max(0, delayMs);
    if (remainingDelay === 0) {
      runPendingAction();
      return;
    }
    timerStartedAt = now();
    timer = setTimeout(runPendingAction, remainingDelay);
  }

  function finish(): void {
    opts.onComplete?.();
    if (opts.loop) {
      schedule(opts.loopDelayMs ?? 900, () => {
        stage.showFormation(initial);
        currentFormation = initial;
        nextStepIndex = 0;
        schedule(opts.initialHoldMs ?? 650, runNextStep);
      });
      return;
    }
    setState('complete');
  }

  function runNextStep(): void {
    if (state !== 'playing') return;
    const step = opts.steps[nextStepIndex];
    if (!step) {
      finish();
      return;
    }

    const from = currentFormation;
    const motion = step.motion ?? 'flow';
    opts.onStepChange?.({ index: nextStepIndex, from, to: step.to, motion });
    stage.morph(from, step.to, {
      motion,
      durationMs: step.durationMs ?? opts.defaultDurationMs ?? 1600,
      stagger: step.stagger ?? opts.defaultStagger ?? 0.1,
      onSettle: () => {
        if (state === 'destroyed') return;
        currentFormation = step.to;
        nextStepIndex += 1;
        schedule(step.holdMs ?? opts.defaultHoldMs ?? 450, runNextStep);
      },
    });
  }

  function finishStaticSequence(): void {
    const finalFormation = opts.steps[opts.steps.length - 1]?.to ?? initial;
    stage.showFormation(finalFormation);
    currentFormation = finalFormation;
    nextStepIndex = opts.steps.length;
    opts.onComplete?.();
    setState('complete');
  }

  function play(): void {
    if (state === 'destroyed' || state === 'playing') return;
    if (state === 'paused') {
      resume();
      return;
    }
    if (state === 'complete') {
      replay();
      return;
    }
    if (stage.isStatic()) {
      finishStaticSequence();
      return;
    }
    setState('playing');
    schedule(opts.initialHoldMs ?? 650, runNextStep);
  }

  function pause(): void {
    if (state !== 'playing') return;
    if (timer !== undefined) {
      clearTimer();
      remainingDelay = Math.max(0, remainingDelay - (now() - timerStartedAt));
    }
    stage.pause();
    setState('paused');
  }

  function resume(): void {
    if (state !== 'paused') return;
    setState('playing');
    stage.resume();
    if (pendingAction) schedule(remainingDelay, pendingAction);
  }

  function replay(): void {
    if (state === 'destroyed') return;
    clearTimer();
    pendingAction = undefined;
    stage.showFormation(initial);
    currentFormation = initial;
    nextStepIndex = 0;
    if (stage.isStatic()) {
      finishStaticSequence();
      return;
    }
    setState('playing');
    schedule(opts.initialHoldMs ?? 650, runNextStep);
  }

  function destroy(): void {
    if (state === 'destroyed') return;
    clearTimer();
    pendingAction = undefined;
    stage.destroy();
    setState('destroyed');
  }

  const sequence: ParticleSequence = {
    play,
    pause,
    resume,
    replay,
    getState: () => state,
    getCurrentFormation: () => currentFormation,
    destroy,
  };

  if (opts.autoplay !== false) play();
  return sequence;
}
