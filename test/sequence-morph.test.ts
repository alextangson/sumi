// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { Pt } from '../src/types';

const stage = vi.hoisted(() => ({
  isStatic: vi.fn(() => false),
  snapshotFor: vi.fn(),
  morph: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  showFormation: vi.fn(),
  disperseOut: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock('../src/stage/ink-stage', () => ({
  createInkStage: () => stage,
}));

import { sequenceMorph } from '../src/components/sequence-morph';

const idea: Pt[] = [
  { x: -0.3, y: 0, lvl: 3 },
  { x: 0.3, y: 0, lvl: 9 },
];
const bars: Pt[] = [
  { x: -0.2, y: -0.2, lvl: 5 },
  { x: 0.2, y: 0.2, lvl: 12 },
];
const growth: Pt[] = [
  { x: -0.1, y: 0.25, lvl: 8 },
  { x: 0.1, y: -0.25, lvl: 18 },
];

describe('sequenceMorph', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    for (const spy of Object.values(stage)) spy.mockClear();
    stage.isStatic.mockReturnValue(false);
    stage.morph.mockImplementation((
      _from: string,
      _to: string,
      opts?: { onSettle?: () => void },
    ) => opts?.onSettle?.());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('plays named steps in order and reports each GPU motion', () => {
    const events: string[] = [];
    const sequence = sequenceMorph(document.createElement('canvas'), {
      formations: { idea, bars, growth },
      initial: 'idea',
      initialHoldMs: 0,
      defaultHoldMs: 0,
      steps: [
        { to: 'bars', motion: 'burst' },
        { to: 'growth', motion: 'vortex' },
      ],
      onStepChange: ({ from, to, motion }) => events.push(`${from}:${to}:${motion}`),
    });

    expect(stage.morph).toHaveBeenNthCalledWith(1, 'idea', 'bars', expect.objectContaining({ motion: 'burst' }));
    expect(stage.morph).toHaveBeenNthCalledWith(2, 'bars', 'growth', expect.objectContaining({ motion: 'vortex' }));
    expect(events).toEqual(['idea:bars:burst', 'bars:growth:vortex']);
    expect(sequence.getCurrentFormation()).toBe('growth');
    expect(sequence.getState()).toBe('complete');
  });

  it('pauses and resumes the remaining hold time without skipping a step', () => {
    const sequence = sequenceMorph(document.createElement('canvas'), {
      formations: { idea, bars },
      initial: 'idea',
      initialHoldMs: 100,
      steps: [{ to: 'bars' }],
      autoplay: false,
    });

    sequence.play();
    vi.advanceTimersByTime(40);
    sequence.pause();
    vi.advanceTimersByTime(200);
    expect(stage.morph).not.toHaveBeenCalled();
    expect(stage.pause).toHaveBeenCalledTimes(1);

    sequence.resume();
    vi.advanceTimersByTime(59);
    expect(stage.morph).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(stage.morph).toHaveBeenCalledTimes(1);
    expect(stage.resume).toHaveBeenCalledTimes(1);
  });

  it('jumps to the final formation for static and reduced-motion environments', () => {
    stage.isStatic.mockReturnValue(true);
    const onComplete = vi.fn();
    const sequence = sequenceMorph(document.createElement('canvas'), {
      formations: { idea, bars, growth },
      initial: 'idea',
      steps: [{ to: 'bars' }, { to: 'growth' }],
      onComplete,
    });

    expect(stage.showFormation).toHaveBeenCalledWith('growth');
    expect(stage.morph).not.toHaveBeenCalled();
    expect(sequence.getState()).toBe('complete');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('cancels delayed work when destroyed', () => {
    const sequence = sequenceMorph(document.createElement('canvas'), {
      formations: { idea, bars },
      initial: 'idea',
      initialHoldMs: 500,
      steps: [{ to: 'bars' }],
    });

    sequence.destroy();
    vi.runAllTimers();
    expect(stage.morph).not.toHaveBeenCalled();
    expect(stage.destroy).toHaveBeenCalledTimes(1);
    expect(sequence.getState()).toBe('destroyed');
  });

  it('rejects missing and mismatched formations with useful errors', () => {
    expect(() => sequenceMorph(document.createElement('canvas'), {
      formations: {},
      steps: [],
    })).toThrow('at least one formation');

    expect(() => sequenceMorph(document.createElement('canvas'), {
      formations: { idea, bars: bars.slice(0, 1) },
      steps: [{ to: 'bars' }],
    })).toThrow('formation "bars" expected 2 points');

    expect(() => sequenceMorph(document.createElement('canvas'), {
      formations: { idea },
      steps: [{ to: 'missing' }],
    })).toThrow('step target "missing"');
  });
});
