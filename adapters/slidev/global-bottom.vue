<template>
  <!--
    sumi — Slidev global-bottom layer
    =====================================
    Copy this file into your Slidev project at:
      components/global-bottom.vue

    It mounts a persistent full-bleed ink canvas behind ALL slides.
    The canvas is pointer-events:none so slide interactions are unaffected.

    Configuration: pass options via frontmatter in slides.md:
      ---
      ink:
        text: 'sumi'
        shape: 'soft'
        seed: 42
      ---

    Or hardcode opts below.
  -->
  <canvas
    ref="canvasRef"
    aria-hidden="true"
    style="
      position: fixed;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 0;
    "
  />
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
// In your Slidev project, install sumi and import from 'sumi'
// import { textReveal, sceneMorph, type InkStage } from 'sumi'
// For this example file, we use the relative path to the source:
import { textReveal, sceneMorph, type InkStage } from '../../src/index'
import { useSlideContext } from '@slidev/client'

// ---------------------------------------------------------------------------
// Configuration — adjust to taste or wire up via frontmatter
// ---------------------------------------------------------------------------
const INK_TEXT = 'sumi'
const INK_SHAPE = 'soft' as const
const INK_SEED = 1
const INK_N = 6000

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------
const canvasRef = ref<HTMLCanvasElement | null>(null)
let stage: InkStage | null = null
let h1El: HTMLElement | null = null

// Slidev exposes the current slide's frontmatter via useSlideContext (optional).
// Wrap in try/catch — this file may be used outside Slidev (e.g. plain Vite).
let slideFrontmatter: Record<string, unknown> = {}
try {
  const ctx = useSlideContext()
  slideFrontmatter = (ctx.frontmatter as Record<string, unknown>) ?? {}
} catch {
  // Not inside a Slidev context — use defaults above.
}

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return

  // Read optional overrides from frontmatter.ink
  const ink = (slideFrontmatter['ink'] ?? {}) as Record<string, unknown>
  const text = typeof ink['text'] === 'string' ? ink['text'] : INK_TEXT
  const shape = (ink['shape'] as typeof INK_SHAPE | undefined) ?? INK_SHAPE
  const seed = typeof ink['seed'] === 'number' ? ink['seed'] : INK_SEED
  const n = typeof ink['n'] === 'number' ? ink['n'] : INK_N

  // Create a hidden h1 sibling for the textReveal handoff.
  h1El = document.createElement('h1')
  h1El.textContent = text
  h1El.style.cssText = 'position:absolute;opacity:0;pointer-events:none;'
  canvas.parentElement?.appendChild(h1El)

  stage = textReveal(canvas, h1El, { text, shape, seed, n })
})

onBeforeUnmount(() => {
  stage?.destroy()
  h1El?.remove()
  h1El = null
  stage = null
})
</script>
