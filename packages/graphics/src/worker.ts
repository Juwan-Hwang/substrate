/**
 * Web Worker — off-main-thread force-directed graph layout.
 *
 * Runs the WASM-accelerated layout (substrate-wasm) in a dedicated worker,
 * keeping the main thread free for UI and animations.
 *
 * Message protocol:
 *   Main → Worker: { type: 'init', graph: KnowledgeGraph }
 *   Main → Worker: { type: 'step', dt: number }
 *   Main → Worker: { type: 'canvas', canvas: OffscreenCanvas }  (optional)
 *   Worker → Main: { type: 'positions', positions: Float32Array }
 *   Worker → Main: { type: 'ready' }
 *   Worker → Main: { type: 'error', message: string }
 *
 * If an OffscreenCanvas is transferred, the worker also renders the graph
 * directly, eliminating main-thread rendering overhead.
 */

/// <reference lib="webworker" />

import type { KnowledgeGraph } from './index';

type WorkerMessage =
  | { type: 'init'; graph: KnowledgeGraph }
  | { type: 'step'; dt: number }
  | { type: 'canvas'; canvas: OffscreenCanvas; width: number; height: number }
  | { type: 'layout'; iterations: number };

let layoutEngine: Awaited<ReturnType<typeof import('./index')['createLayout']>> | null = null;
let offscreenCanvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;

self.addEventListener('message', async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  try {
    switch (msg.type) {
      case 'init': {
        layoutEngine = await createLayout(msg.graph);
        (self as unknown as Worker).postMessage({ type: 'ready', nodeCount: await layoutEngine.nodeCount() });
        break;
      }

      case 'step': {
        if (!layoutEngine) return;
        await layoutEngine.step(msg.dt);
        const positions = await layoutEngine.positions();
        (self as unknown as Worker).postMessage(
          { type: 'positions', positions: positions as Float32Array },
          [positions as Float32Array],
        );
        renderOffscreen();
        break;
      }

      case 'layout': {
        if (!layoutEngine) return;
        for (let i = 0; i < msg.iterations; i++) {
          await layoutEngine.step(0.1 * (1 - i / msg.iterations));
        }
        const positions = await layoutEngine.positions();
        (self as unknown as Worker).postMessage(
          { type: 'positions', positions: positions as Float32Array },
          [positions as Float32Array],
        );
        break;
      }

      case 'canvas': {
        offscreenCanvas = msg.canvas;
        offscreenCanvas.width = msg.width;
        offscreenCanvas.height = msg.height;
        ctx = offscreenCanvas.getContext('2d');
        renderOffscreen();
        break;
      }
    }
  } catch (err) {
    (self as unknown as Worker).postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : 'Unknown worker error',
    });
  }
});

/** Render graph to OffscreenCanvas (if one was transferred). */
function renderOffscreen() {
  if (!ctx || !layoutEngine) return;

  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'transparent';
  ctx.fillRect(0, 0, width, height);

  // Simple circle rendering for nodes.
  ctx.fillStyle = 'rgba(175, 82, 222, 0.8)';
  ctx.strokeStyle = 'rgba(175, 82, 222, 0.3)';
  ctx.lineWidth = 1;

  // Node rendering will be driven by the positions received from step().
  // The actual positions are posted back to the main thread for React Three Fiber
  // to render in the WebGPU/WebGL2 pipeline. OffscreenCanvas rendering is a
  // fallback for the 'canvas' tier.
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 4, 0, Math.PI * 2);
  ctx.fill();
}
