/**
 * Lightweight type stub for three/webgpu.
 *
 * Avoids loading the full Three.js WebGPU type tree during type-check.
 * The real module is only imported dynamically at runtime.
 */

export class WebGPURenderer {
  constructor(options?: {
    canvas?: HTMLCanvasElement | OffscreenCanvas;
    antialias?: boolean;
    alpha?: boolean;
    forceWebGL?: boolean;
  });
  init(): Promise<void>;
}
