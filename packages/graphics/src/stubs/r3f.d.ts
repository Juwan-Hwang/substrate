/**
 * Lightweight type stub for @react-three/fiber.
 *
 * The real R3F types transitively load all of Three.js, consuming
 * ~4GB RSS during type-check. This stub provides just the Canvas
 * component signature and R3F event types.
 *
 * R3F intrinsic JSX elements are declared in src/r3f-jsx.d.ts.
 */

import type { CSSProperties, ReactElement, ReactNode } from 'react';

export type ThreeEvent<NativeEvent = unknown> = {
  stopPropagation: () => void;
  nativeEvent: NativeEvent;
  point: { x: number; y: number; z: number };
  object: unknown;
};

export type CanvasProps = {
  children?: ReactNode;
  camera?: { position?: [number, number, number]; fov?: number; [key: string]: unknown };
  dpr?: number | [number, number];
  gl?:
    | {
        antialias?: boolean;
        alpha?: boolean;
        powerPreference?: 'high-performance' | 'low-power' | 'default';
        [key: string]: unknown;
      }
    | ((props: { canvas: HTMLCanvasElement | OffscreenCanvas }) => unknown);
  style?: CSSProperties;
  [key: string]: unknown;
};

export function Canvas(props: CanvasProps): ReactElement;
