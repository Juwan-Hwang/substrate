/**
 * Client-side Layout Worker manager.
 *
 * Spawns a Web Worker to run force-directed layout off the main thread.
 * Optionally transfers an OffscreenCanvas to the worker for direct rendering
 * (canvas-tier fallback).
 *
 * Usage:
 * ```ts
 * const manager = createLayoutWorker();
 * await manager.init(graph);
 * manager.onPositions((positions) => { ... });
 * manager.step(0.1);
 *
 * // Optionally transfer a canvas for worker-side rendering:
 * manager.transferCanvas(canvasEl);
 * ```
 */
import type { KnowledgeGraph } from './index';

export type WorkerResponse =
  | { type: 'ready'; nodeCount: number }
  | { type: 'positions'; positions: Float32Array }
  | { type: 'error'; message: string };

export type LayoutWorkerManager = {
  init(graph: KnowledgeGraph): Promise<number>;
  step(dt: number): void;
  layout(iterations: number): void;
  transferCanvas(canvas: HTMLCanvasElement): boolean;
  onPositions(cb: (positions: Float32Array) => void): void;
  onError(cb: (message: string) => void): void;
  terminate(): void;
};

/** Check if the current browser supports OffscreenCanvas. */
export function supportsOffscreenCanvas(): boolean {
  return typeof OffscreenCanvas !== 'undefined';
}

export function createLayoutWorker(): LayoutWorkerManager {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

  let positionsCb: ((positions: Float32Array) => void) | null = null;
  let errorCb: ((message: string) => void) | null = null;
  let readyResolve: ((nodeCount: number) => void) | null = null;

  worker.addEventListener('message', (e: MessageEvent<WorkerResponse>) => {
    const msg = e.data;
    switch (msg.type) {
      case 'ready':
        readyResolve?.(msg.nodeCount);
        readyResolve = null;
        break;
      case 'positions':
        positionsCb?.(msg.positions);
        break;
      case 'error':
        errorCb?.(msg.message);
        break;
    }
  });

  return {
    init(graph) {
      return new Promise<number>((resolve) => {
        readyResolve = resolve;
        worker.postMessage({ type: 'init', graph });
      });
    },

    step(dt) {
      worker.postMessage({ type: 'step', dt });
    },

    layout(iterations) {
      worker.postMessage({ type: 'layout', iterations });
    },

    transferCanvas(canvas) {
      if (!supportsOffscreenCanvas()) return false;

      const offscreen = canvas.transferControlToOffscreen();
      worker.postMessage(
        {
          type: 'canvas',
          canvas: offscreen,
          width: canvas.width,
          height: canvas.height,
        },
        [offscreen],
      );
      return true;
    },

    onPositions(cb) {
      positionsCb = cb;
    },

    onError(cb) {
      errorCb = cb;
    },

    terminate() {
      worker.terminate();
    },
  };
}
