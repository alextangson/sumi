import { describe, it, expect } from 'vitest';
import { containRect } from '../src/engine/sample';

describe('containRect', () => {
  it('square image fills the box exactly', () => {
    const r = containRect(100, 100, 200, 200);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(0);
    expect(r.w).toBeCloseTo(200);
    expect(r.h).toBeCloseTo(200);
  });

  it('2:1 wide image in a square box — letterboxed (centered, pillar-free, top/bottom bars)', () => {
    // 200×100 image into 200×200 box
    // scale = min(200/200, 200/100) = min(1, 2) = 1
    // w = 200*1 = 200, h = 100*1 = 100
    // x = (200-200)/2 = 0, y = (200-100)/2 = 50
    const r = containRect(200, 100, 200, 200);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(50);
    expect(r.w).toBeCloseTo(200);
    expect(r.h).toBeCloseTo(100);
  });

  it('1:2 tall image in a square box — pillarboxed (centered left/right)', () => {
    // 100×200 image into 200×200 box
    // scale = min(200/100, 200/200) = min(2, 1) = 1
    // w = 100*1 = 100, h = 200*1 = 200
    // x = (200-100)/2 = 50, y = 0
    const r = containRect(100, 200, 200, 200);
    expect(r.x).toBeCloseTo(50);
    expect(r.y).toBeCloseTo(0);
    expect(r.w).toBeCloseTo(100);
    expect(r.h).toBeCloseTo(200);
  });

  it('4:3 image into 1024×1024 box scales and centers correctly', () => {
    // 400×300 into 1024×1024
    // scale = min(1024/400, 1024/300) = min(2.56, 3.413) = 2.56
    // w = 400*2.56 = 1024, h = 300*2.56 = 768
    // x = 0, y = (1024-768)/2 = 128
    const r = containRect(400, 300, 1024, 1024);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(128);
    expect(r.w).toBeCloseTo(1024);
    expect(r.h).toBeCloseTo(768);
  });
});
