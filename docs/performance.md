# Performance & Accessibility

## Particle budget

sumi caps particle count at **15,000** to bound GPU buffer size and overdraw. Exact frame time depends on the device, DPR, particle material, and number of simultaneously visible stages.

Use `recommendedParticleCount(opts?)` to get an adaptive budget:

| Context | Width | DPR | Budget |
|---|---|---|---|
| Hi-res desktop | ≥ 1200 | ≤ 1 | 15 000 |
| Retina desktop | ≥ 1200 | > 1 | 12 000 |
| Normal desktop / tablet | ≥ 768 | any | 8 000 |
| Small tablet / landscape mobile | ≥ 480 | any | 4 000 |
| Portrait mobile | < 480 | any | 2 000 |

```js
import { recommendedParticleCount } from 'sumi';
const N = recommendedParticleCount(); // auto-reads window.innerWidth + devicePixelRatio
```

## Rendering pipeline

- **One upload per morph**: source/target positions, level, phase, and depth are packed into a reused interleaved `Float32Array` once. Animation frames update only small uniforms (`progress`, `stagger`, `scatter`, and view state).
- **One context per sequence**: `sequenceMorph` reuses the same field, buffer, renderer, and WebGL2 context for every timeline step. Pausing stops both morph and idle motion without losing progress.
- **One draw call**: WebGL2 `gl.POINTS` renders the whole field; the vertex shader handles perspective, parallax, shimmer, and point sizing, while the fragment shader draws square, round, or organic soft ink grains.
- **GPU choreography**: formation interpolation, per-particle stagger, and curved ink-flow paths execute in the vertex shader. CPU particle state is materialized only when a morph settles or is explicitly interrupted.
- **Depth testing**: volumetric formations use the GPU depth buffer instead of Canvas2D painter ordering.
- **rAF pause**: DOM handoff components stop completely after settle. Persistent scenes keep a lightweight idle loop only while the canvas is near the viewport; the loop also pauses when the document is hidden and is cancelled by `destroy()`.

Canvas2D remains only in the one-time sampling path that rasterizes source text,
images, SVG paths, or procedural shapes into point formations. It is never used
for animation-frame rendering.

## Reduced motion & mobile

`createInkStage` reads `prefers-reduced-motion` and `innerWidth < 760` at creation time. When either is true (mode `'auto'`):

- `isStatic()` returns `true`
- `morph()` settles in one synchronous step — no `requestAnimationFrame`
- `onSettle` fires immediately (no delay)

To force animation regardless of environment, pass `mode: 'animate'`.

## Manual checklist (real-device FPS)

Real-device frame rate measurement is a manual step — automated headless benchmarks don't reflect thermal throttling or GPU contention:

- [ ] iPhone 12 (Safari): scroll through deck, monitor FPS in Web Inspector
- [ ] Pixel 7 (Chrome): same
- [ ] MacBook Air M1 (Safari/Chrome): record frame time at N=15000
- [ ] Windows laptop (Chrome): same

Pixel-level visual regression is deferred to CI via a headless browser (Playwright/Puppeteer).
