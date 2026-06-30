// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createInkStage } from '../src/stage/ink-stage';
import type { StageEnv } from '../src/stage/ink-stage';
import type { Field } from '../src/engine/field';
import type { Palette } from '../src/engine/palette';

// Minimal fakes — InkStage only reads canvas for the (untested) DOM/rAF wiring.
function fakeCanvas(): HTMLCanvasElement {
  return document.createElement('canvas');
}

function fakeField(): Field {
  return {
    particles: [],
    n: 0,
    setFormation() {},
    step() {},
  };
}

function fakePalette(): Palette {
  return { colors: ['#000'], sizes: [1], levels: 1 };
}

const ALL_OFF: StageEnv = { reducedMotion: false, mobile: false, printing: false };

describe('createInkStage().isStatic()', () => {
  it('mode "static" is always static, even with all env flags off', () => {
    const stage = createInkStage(fakeCanvas(), fakeField(), fakePalette(), {
      mode: 'static',
      env: ALL_OFF,
    });
    expect(stage.isStatic()).toBe(true);
    stage.destroy();
  });

  it('mode "animate" is never static, even with every env flag on', () => {
    const stage = createInkStage(fakeCanvas(), fakeField(), fakePalette(), {
      mode: 'animate',
      env: { reducedMotion: true, mobile: true, printing: true },
    });
    expect(stage.isStatic()).toBe(false);
    stage.destroy();
  });

  it('mode "auto" is static iff any env flag is set', () => {
    const palette = fakePalette();

    const none = createInkStage(fakeCanvas(), fakeField(), palette, { mode: 'auto', env: ALL_OFF });
    expect(none.isStatic()).toBe(false);
    none.destroy();

    const reduced = createInkStage(fakeCanvas(), fakeField(), palette, {
      mode: 'auto',
      env: { reducedMotion: true, mobile: false, printing: false },
    });
    expect(reduced.isStatic()).toBe(true);
    reduced.destroy();

    const mobile = createInkStage(fakeCanvas(), fakeField(), palette, {
      mode: 'auto',
      env: { reducedMotion: false, mobile: true, printing: false },
    });
    expect(mobile.isStatic()).toBe(true);
    mobile.destroy();

    const printing = createInkStage(fakeCanvas(), fakeField(), palette, {
      mode: 'auto',
      env: { reducedMotion: false, mobile: false, printing: true },
    });
    expect(printing.isStatic()).toBe(true);
    printing.destroy();
  });

  it('defaults to mode "auto" when no mode is given', () => {
    const stage = createInkStage(fakeCanvas(), fakeField(), fakePalette(), {
      env: { reducedMotion: true, mobile: false, printing: false },
    });
    expect(stage.isStatic()).toBe(true);
    stage.destroy();
  });
});
