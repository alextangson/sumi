/**
 * Inkmote — Vue composable adapter
 *
 * Peer dependency: vue ≥3. Import from your project after installing inkmote.
 *
 * Usage:
 *   import { useInkReveal } from 'inkmote/adapters/vue'
 *
 * Note: this file imports `onMounted` / `onBeforeUnmount` / `Ref` from 'vue'.
 * If vue is not installed as a devDependency in this repo, the type-checker
 * will error; in that case the minimal local Ref type below is used as a
 * fallback via the conditional import pattern documented here.
 */

// ---------------------------------------------------------------------------
// Minimal local Ref<T> type so this file type-checks even without vue installed.
// When consumed in a real Vue project, the user's own vue types take over.
// ---------------------------------------------------------------------------
type Ref<T> = { value: T };

// We import the lifecycle hooks from 'vue' at runtime (peer dep).
// The `// @ts-expect-error` below is intentional: vue is not in devDependencies
// of this repo. Remove it if you add vue as a devDep.
// @ts-expect-error — vue is a peer dependency, not installed in this repo
import { onMounted, onBeforeUnmount } from 'vue';

import { type InkStage } from '../src/index';

// ---------------------------------------------------------------------------
// useInkReveal
// ---------------------------------------------------------------------------

/**
 * Vue composable that mounts an ink stage on a canvas ref.
 *
 * @param canvasRef  A Vue `ref` pointing at an HTMLCanvasElement (or null).
 * @param factory    Called with the resolved canvas on mount; must return an InkStage.
 *                   The stage is destroyed before component unmount.
 *
 * @example
 * <script setup lang="ts">
 * import { ref } from 'vue'
 * import { textReveal } from 'inkmote'
 * import { useInkReveal } from 'inkmote/adapters/vue'
 *
 * const canvas = ref<HTMLCanvasElement | null>(null)
 * const h1    = ref<HTMLElement | null>(null)
 *
 * useInkReveal(canvas, (el) => textReveal(el, h1.value!, { text: 'Hello' }))
 * </script>
 *
 * <template>
 *   <canvas ref="canvas" style="width:100%;height:100%" />
 *   <h1 ref="h1">Hello</h1>
 * </template>
 */
export function useInkReveal(
  canvasRef: Ref<HTMLCanvasElement | null>,
  factory: (canvas: HTMLCanvasElement) => InkStage,
): void {
  let stage: InkStage | null = null;

  onMounted(() => {
    const canvas = canvasRef.value;
    if (!canvas) return;
    stage = factory(canvas);
  });

  onBeforeUnmount(() => {
    stage?.destroy();
    stage = null;
  });
}
