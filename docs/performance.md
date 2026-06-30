# Performance & Accessibility

## Particle budget

Inkmote caps particle count at **15,000** to keep frame time under 4ms on mainstream hardware.

Use `recommendedParticleCount(opts?)` to get an adaptive budget:

| Context | Width | DPR | Budget |
|---|---|---|---|
| Hi-res desktop | ≥ 1200 | ≤ 1 | 15 000 |
| Retina desktop | ≥ 1200 | > 1 | 12 000 |
| Normal desktop / tablet | ≥ 768 | any | 8 000 |
| Small tablet / landscape mobile | ≥ 480 | any | 4 000 |
| Portrait mobile | < 480 | any | 2 000 |

```js
import { recommendedParticleCount } from 'inkmote';
const N = recommendedParticleCount(); // auto-reads window.innerWidth + devicePixelRatio
```

## Rendering pipeline

- **Color-bucket batching**: particles are sorted by level before drawing; each bucket is drawn with one `fillStyle` set, minimizing context switches.
- **Sprite cache**: per-level bitmaps are rasterized once at stage creation (`buildSprites`), then `drawImage`-d per particle — no per-frame path construction.
- **rAF pause**: the animation loop stops when the morph settles (`m >= 1`) and does not fire again until the next `morph()` call.

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
- [ ] MacBook Air M1 (Safari/Chrome): confirm ≤4ms/frame at N=15000
- [ ] Windows laptop (Chrome): same

Pixel-level visual regression is deferred to CI via a headless browser (Playwright/Puppeteer).
