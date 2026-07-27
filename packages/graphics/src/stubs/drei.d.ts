/**
 * Lightweight type stub for @react-three/drei.
 *
 * The real drei types transitively load all of Three.js + R3F,
 * consuming ~4GB RSS during type-check. This stub provides only
 * the components actually used by the graphics package.
 */

import type { ReactElement, ReactNode, Ref } from 'react';

// ── R3F event type (minimal) ────────────────────────────────────────

export type ThreeEvent<NativeEvent = unknown> = {
  stopPropagation: () => void;
  nativeEvent: NativeEvent;
  point: { x: number; y: number; z: number };
  object: unknown;
};

// ── Html ────────────────────────────────────────────────────────────

export type HtmlProps = {
  children?: ReactNode;
  position?: [number, number, number];
  center?: boolean;
  distanceFactor?: number;
  transform?: boolean;
  occlude?: boolean | unknown[];
  [key: string]: unknown;
};

export function Html(props: HtmlProps): ReactElement;

// ── Line ────────────────────────────────────────────────────────────

export type LineProps = {
  points?: Array<[number, number, number] | unknown>;
  color?: unknown;
  lineWidth?: number;
  dashed?: boolean;
  transparent?: boolean;
  opacity?: number;
  [key: string]: unknown;
};

export function Line(props: LineProps): ReactElement;

// ── OrbitControls ───────────────────────────────────────────────────

export type OrbitControlsProps = {
  enablePan?: boolean;
  enableZoom?: boolean;
  enableRotate?: boolean;
  minDistance?: number;
  maxDistance?: number;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  target?: [number, number, number];
  [key: string]: unknown;
};

export function OrbitControls(props: OrbitControlsProps): ReactElement;

// ── Sphere ──────────────────────────────────────────────────────────

export type SphereProps = {
  args?: [radius?: number, widthSegments?: number, heightSegments?: number];
  ref?: Ref<unknown>;
  children?: ReactNode;
  onClick?: (e: ThreeEvent) => void;
  onPointerOver?: (e: ThreeEvent) => void;
  onPointerOut?: (e: ThreeEvent) => void;
  position?: [number, number, number];
  [key: string]: unknown;
};

export function Sphere(props: SphereProps): ReactElement;
