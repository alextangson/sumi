# Inkmote Framework Adapters

Thin, framework-idiomatic wrappers over the vanilla `inkmote` API.
Each adapter: mounts a canvas → calls the right `Inkmote.*` fn → calls `stage.destroy()` on unmount/cleanup.

All frameworks are **peer dependencies** — install them separately. Inkmote ships zero framework code in its main dist.

---

## React

```tsx
// npm i inkmote react
import { useRef } from 'react'
import { textReveal } from 'inkmote'
import { useInkReveal, InkText, InkImage } from 'inkmote/adapters/react'

// Hook — bring-your-own canvas
function HeroSection() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const h1Ref = useRef<HTMLHeadingElement>(null)

  useInkReveal(canvasRef, (canvas) =>
    textReveal(canvas, h1Ref.current!, { text: 'Hello' })
  )

  return (
    <>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
      <h1 ref={h1Ref}>Hello</h1>
    </>
  )
}

// Self-contained components
<InkText text="inkmote" font="700 120px sans-serif" shape="soft" />
<InkImage src="/hero.jpg" alt="Hero scene" />
```

---

## Vue

```vue
<script setup lang="ts">
// npm i inkmote vue
import { ref } from 'vue'
import { textReveal } from 'inkmote'
import { useInkReveal } from 'inkmote/adapters/vue'

const canvas = ref<HTMLCanvasElement | null>(null)
const h1     = ref<HTMLElement | null>(null)

useInkReveal(canvas, (el) => textReveal(el, h1.value!, { text: 'Hello' }))
</script>

<template>
  <canvas ref="canvas" style="width:100%;height:100%" />
  <h1 ref="h1">Hello</h1>
</template>
```

---

## Svelte

```svelte
<script lang="ts">
  // npm i inkmote svelte
  import { inkReveal } from 'inkmote/adapters/svelte'
  let titleEl: HTMLElement
</script>

<!-- text reveal -->
<canvas use:inkReveal={{ kind: 'text', text: 'Hello', h1El: titleEl }} />
<h1 bind:this={titleEl}>Hello</h1>

<!-- image reveal -->
<canvas use:inkReveal={{ kind: 'image', src: '/hero.jpg', alt: 'Hero' }} />
```

The action supports `kind: 'text' | 'image' | 'scene'`. Passing new params triggers a destroy + re-create automatically via Svelte's `update` lifecycle.

---

## reveal.js

```js
// npm i inkmote reveal.js
import Reveal from 'reveal.js'
import { fromText } from 'inkmote'
import { injectInkBackground } from 'inkmote/adapters/reveal'

Reveal.initialize({ /* ... */ })

const handle = injectInkBackground(document.querySelector('.reveal'), {
  kind: 'scene',
  opts: {
    from: fromText('OPEN', 6000),
    to:   fromText('CLOSE', 6000),
  },
})

// On teardown:
handle.destroy()
```

`injectInkBackground` appends a `pointer-events:none; z-index:0` canvas as the **first child** of the deck element. The reveal.js `.slides` container sits above it automatically. Returns `{ canvas, stage, destroy }`.

---

## Slidev

Copy `adapters/slidev/global-bottom.vue` into your Slidev project:

```
cp node_modules/inkmote/adapters/slidev/global-bottom.vue \
   components/global-bottom.vue
```

Slidev automatically picks up `components/global-bottom.vue` as a persistent layer rendered beneath every slide. The component mounts a full-bleed ink canvas and runs a `textReveal` animation.

Optional frontmatter overrides in `slides.md`:

```yaml
---
ink:
  text: 'inkmote'
  shape: 'soft'
  seed: 42
  n: 6000
---
```

---

## Astro

Astro is server-rendered — use the vanilla `Inkmote.*` API in a `<script>` tag, or drop in the React adapter if you're using `@astrojs/react`.

**Vanilla (recommended):**

```astro
---
// MyHero.astro — no imports needed server-side
---
<canvas id="ink-canvas" style="width:100%;height:400px" />
<h1 id="ink-title">inkmote</h1>

<script>
  import { textReveal } from 'inkmote'
  const canvas = document.getElementById('ink-canvas') as HTMLCanvasElement
  const h1     = document.getElementById('ink-title') as HTMLElement
  textReveal(canvas, h1, { text: 'inkmote' })
</script>
```

**React adapter (if `@astrojs/react` is configured):**

```astro
---
import { InkText } from 'inkmote/adapters/react'
---
<InkText client:only="react" text="inkmote" />
```

---

## Peer dependency matrix

| Adapter file        | Peer dep required | devDep in this repo |
|---------------------|-------------------|---------------------|
| `react.tsx`         | `react ≥18`       | `react`, `@types/react` |
| `vue.ts`            | `vue ≥3`          | none (minimal local Ref type) |
| `svelte.ts`         | `svelte ≥4`       | none (plain TS, no svelte import) |
| `reveal.ts`         | `reveal.js`       | none (plain DOM TS) |
| `slidev/global-bottom.vue` | `vue`, `@slidev/client` | example-only, excluded from tsconfig |

The main `npm run build` bundles **only** `src/index.ts` — adapters are not included in the dist.
