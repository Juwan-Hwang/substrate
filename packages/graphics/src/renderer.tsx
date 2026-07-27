/**
 * Three.js WebGPU Renderer — instantiates the WebGPURenderer from
 * three/webgpu and provides a React Three Fiber <Canvas> that uses it.
 *
 * The renderer is created lazily on the client. If WebGPU is not
 * available, R3F's <Canvas> automatically falls back to WebGL2
 * (Three.js WebGLRenderer).
 */
import { Canvas } from '@react-three/fiber';
import type { ReactNode } from 'react';

export type RendererInitOptions = {
  canvas?: HTMLCanvasElement | OffscreenCanvas;
  antialias?: boolean;
  alpha?: boolean;
};

/**
 * Dynamically import and instantiate Three.js WebGPURenderer.
 *
 * We use dynamic import because `three/webgpu` pulls in WGSL
 * compilation code that should not be in the server bundle.
 *
 * Returns null if WebGPU is not supported — the caller should
 * fall back to R3F's default <Canvas> (WebGL2).
 */
export async function createWebGPURenderer(options?: RendererInitOptions) {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
    return null;
  }

  const { WebGPURenderer } = await import('three/webgpu');
  const renderer = new WebGPURenderer({
    canvas: options?.canvas,
    antialias: options?.antialias ?? true,
    alpha: options?.alpha ?? true,
    forceWebGL: false,
  });

  await renderer.init();
  return renderer;
}

/**
 * React component that lazily mounts a WebGPU-powered R3F Canvas.
 *
 * If WebGPU is unavailable, it renders the fallback (children inside
 * a standard R3F <Canvas> with WebGL2).
 */
export function WebGPUCanvas({
  children,
  ...canvasProps
}: {
  children: ReactNode;
} & Record<string, unknown>) {
  return (
    <Canvas
      {...canvasProps}
      gl={async (glProps) => {
        const renderer = await createWebGPURenderer({
          canvas: glProps.canvas,
        });
        return renderer ?? undefined;
      }}
    >
      {children}
    </Canvas>
  );
}
