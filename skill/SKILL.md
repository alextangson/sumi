---
name: sumi
description: >
  Generates self-contained HTML decks / hero sections in sumi's ink sand-painting
  style — warm-white paper, monochrome ink particles that COALESCE into an image
  or wordmark, SHIMMER at rest, and tilt in 3D to the cursor. Use when the user
  asks for a slideshow, presentation, landing hero, or any moment that should
  "assemble from ink dust and feel alive." Zero network dependency.
---

# sumi Agent Skill

Generate a **single self-contained HTML file** that looks and moves like a living
ink sand-painting. sumi's whole identity is that the particles are **alive** — if
you ship a flat, frozen, or generic-looking result, you have failed the aesthetic,
even if the code runs.

## THE IRON LAW (read first)

Every particle moment MUST satisfy all three, or it reads as a pasted static image
("格格不入" — out of place):

1. **COALESCE / DISPERSE** — the field gathers *in* from a scatter of ink dust (and,
   on exit, scatters *out*). It never just fades in. Every morph bursts apart at its
   midpoint then gathers — a coalesce, not a slide.
2. **SHIMMER** — every grain carries a tiny perpetual jitter, so a *settled* formation
   still breathes. A frozen field is dead.
3. **3D DEPTH + parallax** — the formation carries a `z` axis, projects in perspective,
   and tilts to the cursor; near and far grains shift by different amounts (volumetric,
   not a flat plane).

**Good news:** the engine now does all three BY DEFAULT (shimmer + mid-morph scatter +
per-grain volumetric parallax are on out of the box, paused when the tab is hidden, and
degrade to a still snapshot under reduced-motion/mobile). Your job is to **not turn them
off** and to wrap them in a tasteful, on-brand page.

## BOUNDARIES (what NOT to do)

- **Never** pass `tilt: false` on a cover / hero / image moment. (The one exception is
  `textReveal`, which intentionally hands off to crisp DOM text — see below.)
- **Never** leave the paper flat `#f4f3ee` with no grain — always add the paper-grain overlay.
- **Never** use a generic heavy sans for large type — use a **warm serif** (Noto Serif SC
  600) for titles/wordmarks; a clean grotesk (Space Grotesk / system-ui) for body.
- **Never** crossfade or slide between two ideas where a particle **morph** should carry
  the transition (`sceneMorph`).
- **Never** put a particle moment on a dense body/content slide — it kills readability.
  Particle moments belong on **cover, section titles, key stats, images, and transitions.**
- **Never** use full-saturation color as the base — monochrome ink on warm paper; reserve
  living color for a single **finale reveal** if at all.

## Opinionated defaults (copy these)

- Palette: paper `#f4f3ee`, ink `#1e2124`. Monochrome.
- `shape: 'soft'` (the default) — tactile radial-gradient ink stipple, not hard discs.
- `tilt` ON for cover/section/image/scene moments.
- Large type: `Noto Serif SC` 600 (serif, warm). Body: `Space Grotesk`/grotesk.
- Paper-grain overlay on every page (see CSS baseline below).
- `n: 8000` default; 4000–6000 for image slides.
- **Pacing**: let a reveal settle and DWELL a beat before the next; don't fire morphs
  back-to-back. Reveals should build slowly then flourish; camera/scale moves are ONE
  calm motion, never a jerky reversal.

## Prefer depth-carrying reveals for heroes

`imageReveal` and `sceneMorph` persist a live, tilting, shimmering field — **prefer these
for cover/hero moments.** `textReveal` is the accessible path: it coalesces dust → the word,
then fades the canvas out and hands off to a real, selectable `<h1>` (so it goes still on
purpose — that's correct for section titles / SEO, not for a kiosk hero). If you want a
hero title that stays alive, render the wordmark via `coverReveal`/`imageReveal` (kept live)
rather than `textReveal`.

## Embedding the library

Inline `${CLAUDE_SKILL_DIR}/assets/sumi.global.js` into a `<script>` at the bottom of
`<body>` — exposes `window.Sumi`, no build/CDN/network.

```html
<script>/* paste full contents of ${CLAUDE_SKILL_DIR}/assets/sumi.global.js here */</script>
```

## Per-slide canvas pattern

```html
<section class="slide active">
  <canvas class="ink-live" aria-hidden="true"></canvas>
  <h1 data-ink="title">Your Title</h1>
</section>
```
Slides without a particle moment omit the canvas.

## Which component to use where

| Situation | Component | Notes |
|---|---|---|
| Cover / wordmark (keep alive) | `Sumi.coverReveal(canvas, { wordmark: h1El, tagline?: pEl })` | tilt on |
| Image → ink particles | `Sumi.imageReveal(canvas, imgEl, { n, seed, alt })` | tilt on; the signature move |
| Transition between two ideas | `Sumi.sceneMorph(canvas, { from, to, n, seed })` | tilt on; carries the transition |
| Key number / stat | `Sumi.statReveal(canvas, el, { value, n, seed })` | — |
| Accessible section title | `Sumi.textReveal(canvas, h1El, { text, font, n, seed })` | coalesces → real `<h1>` (then still) |

**Declarative shortcut**: `data-ink="title"` + `Sumi.autoInit(document)` wires `textReveal`.
For live heroes prefer an explicit `coverReveal`/`imageReveal` call.

**Tuning knobs** (beyond `n`): `seed` (determinism), `minInk`/`gamma` (image sampling
threshold/contrast), `shape:'soft'` (default). The engine's shimmer amplitude, mid-morph
scatter, and per-grain depth are on by default — leave them on.

## Exits & pacing (the iron law's "scatter OUT")

A scene should scatter back to dust on the way off, not hard-cut. Every stage exposes
`stage.disperseOut({ durationMs?, spread?, fade?, onSettle? })` — it flings the settled
grains outward along their own phase and fades the canvas. Keep the returned stage handle
so you can call it when leaving a slide/section, then tear it down in `onSettle`.

**Pace the handoff.** Never fire the next reveal the instant the last one ends — let the
exit read, DWELL a beat (~250ms), *then* coalesce the next. The reference deck implements
exactly this: on navigation it `disperseOut()`s the current slide, waits `HOLD_MS`, then
recreates the next slide's reveal so every visit coalesces fresh.

```js
// leaving a slide:
outStage.disperseOut({ durationMs: 700, onSettle: () => { outStage.destroy(); afterHold(); } });
// afterHold(): setTimeout(() => { activate(next); enterReveal(next); }, 260)
```

## Initialization

Wrap in `document.fonts.ready.then(...)` (matters for `imageReveal` + serif fonts):

```js
document.fonts.ready.then(function () {
  var canvas = document.querySelector('#slide-cover canvas');
  var h1 = document.querySelector('#slide-cover h1');
  Sumi.coverReveal(canvas, { wordmark: h1 });   // stays alive: shimmer + tilt
});
```

## A11y + perf

- Canvas always `aria-hidden="true"`; real text stays in the DOM.
- Reduced-motion / mobile: the lib auto-degrades to a still, tilt-frozen snapshot.
- Idle loop pauses when the tab is hidden.

## CSS baseline (includes the mandatory paper grain)

```css
:root { --bg: #f4f3ee; --ink: #1e2124; }
html, body { margin: 0; height: 100%; background: var(--bg); color: var(--ink);
  font-family: 'Space Grotesk', system-ui, sans-serif; }
h1, h2, .wordmark { font-family: 'Noto Serif SC', serif; font-weight: 600; }
/* Mandatory paper grain — the warm-white must feel like textured paper, not flat. */
body::after {
  content: ""; position: fixed; inset: 0; z-index: 9; pointer-events: none;
  opacity: .085; mix-blend-mode: multiply;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='170' height='170'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E");
  background-size: 170px 170px;
}
section.slide { position: fixed; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; visibility: hidden; opacity: 0;
  transition: opacity .4s ease; }
section.slide.active { visibility: visible; opacity: 1; }
section.slide > canvas.ink-live { position: absolute; inset: 0; width: 100%; height: 100%;
  pointer-events: none; z-index: 0; }
section.slide > *:not(canvas.ink-live) { position: relative; z-index: 1; }
```

## Reference

- `reference/deck-template.html` — a minimal deck (cover, stat, image, body) that already
  applies these defaults (serif titles, paper grain, live cover). Adapt it as a starting point.
