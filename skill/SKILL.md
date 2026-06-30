---
name: inkmote
description: >
  Generates self-contained HTML presentation decks with inkmote's ink sand-painting
  particle style — warm-white background, round ink-stipple particle moments on
  cover/section/stat slides, zero network dependency. Use this skill when the user
  asks for an HTML slideshow, presentation, or deck with a distinctive animated
  particle aesthetic.
---

# inkmote Agent Skill

Generate a **single self-contained HTML file** that looks and moves like an ink
sand-painting. The recognizable style is carried by two things:
- warm-white background `#f4f3ee` with ink-dark `#1e2124` particles
- "particle moments" on cover, section titles, and key stats — NOT every slide

Everything else (layout, fonts, copy) is the agent's tasteful call.

## Embedding the library

Inline `${CLAUDE_SKILL_DIR}/assets/inkmote.global.js` into a `<script>` tag at the
bottom of `<body>`. This exposes `window.Inkmote` with all components. No build,
no CDN, no network required at deck-generation time.

```html
<script>
/* paste full contents of ${CLAUDE_SKILL_DIR}/assets/inkmote.global.js here */
</script>
```

## Per-slide canvas pattern

Every slide that gets a particle moment needs a **full-bleed `<canvas>`** inside
its `<section>`. The lib auto-sizes it via CSS. Text content sits above via
`z-index`.

```html
<section class="slide active">
  <canvas class="ink-live" aria-hidden="true"></canvas>
  <h1 data-ink="title">Your Title</h1>
</section>
```

Slides without particle moments omit the canvas.

## Which component to use where

| Situation | Component | Declarative attr |
|---|---|---|
| Cover / wordmark | `Inkmote.coverReveal(canvas, { wordmark: h1El, tagline?: pEl })` | — |
| Section / chapter title | `Inkmote.textReveal(canvas, h1El, { text, font, n, seed })` | `data-ink="title"` on h1 + `Inkmote.autoInit(document)` |
| Key number / stat | `Inkmote.statReveal(canvas, el, { value, n, seed })` | `data-ink="stat" data-value="95%"` (parsed but not auto-wired) |
| AI-generated image | `Inkmote.imageReveal(canvas, imgEl, { n, seed, alt })` | — |
| Transition between ideas | `Inkmote.sceneMorph(canvas, { from, to, n, seed })` | `data-ink-transition` |

**Declarative shortcut**: add `data-ink` attributes and call `Inkmote.autoInit(document)`
— it wires `textReveal` automatically for `data-ink="title"` elements only. Stat and image
slides need explicit JS calls via `statReveal` and `imageReveal`.

**Particle moments belong on**: cover, section title slides, stat slides, image slides,
and scene-morph transitions. NOT on body/content slides — that kills readability.

## Initialization pattern

Wrap calls in `document.fonts.ready.then(...)` to coordinate font loading — especially
important for `imageReveal` with `image.onload`. Note: `textReveal`, `statReveal`, and
`coverReveal` already await `document.fonts.ready` internally (text sampling self-guards),
so wrapping is optional for these but harmless:

```js
document.fonts.ready.then(function () {
  var canvas = document.querySelector('#slide-cover canvas');
  var h1 = document.querySelector('#slide-cover h1');
  Inkmote.textReveal(canvas, h1, { text: h1.textContent, n: 8000, seed: 7 });
});
```

**Example: cover with wordmark and tagline (HTMLElements)**
```js
// cover: wordmark + tagline are real DOM elements
Inkmote.coverReveal(coverCanvas, { wordmark: document.querySelector('#brand'), tagline: document.querySelector('#tag') });
```

## A11y + perf

- Canvas elements: always `aria-hidden="true"` (lib sets it; add it as HTML fallback)
- Real text stays in the DOM — the lib fades the `<h1>` in after particles settle
- `n: 8000` is a good default; reduce to 4000–5000 for image slides
- Reduced-motion / mobile: the lib auto-degrades to a static snapshot

## CSS baseline

```css
:root { --bg: #f4f3ee; --ink: #1e2124; }
html, body { margin: 0; height: 100%; background: var(--bg); color: var(--ink); }
section.slide {
  position: fixed; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  visibility: hidden; opacity: 0; transition: opacity 0.4s ease;
}
section.slide.active { visibility: visible; opacity: 1; }
section.slide > canvas.ink-live {
  position: absolute; inset: 0; width: 100%; height: 100%;
  pointer-events: none; z-index: 0;
}
section.slide > *:not(canvas.ink-live) { position: relative; z-index: 1; }
```

## Reference files

- `reference/deck-template.html` — minimal 4-slide deck (cover, stat, image, body)
  the agent can adapt as a starting point
