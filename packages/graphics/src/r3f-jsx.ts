/**
 * R3F intrinsic JSX elements — module augmentation.
 *
 * Augments React.JSX.IntrinsicElements with Three.js objects that
 * R3F injects at runtime (mesh, group, lights, materials, etc.).
 *
 * This file MUST be a .ts module (not .d.ts) for the augmentation
 * to be reliably processed by TypeScript 7.
 */

import type { ReactNode } from 'react';

type R3FElementProps = {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  ref?: unknown;
  children?: ReactNode;
  [key: string]: unknown;
};

type R3FMaterialProps = R3FElementProps & {
  color?: unknown;
  emissive?: unknown;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
  transparent?: boolean;
  opacity?: number;
  wireframe?: boolean;
  side?: number;
};

type R3FLightProps = R3FElementProps & {
  intensity?: number;
  color?: unknown;
  distance?: number;
  decay?: number;
};

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      group: R3FElementProps;
      mesh: R3FElementProps;
      ambientLight: R3FLightProps;
      pointLight: R3FLightProps;
      directionalLight: R3FLightProps;
      spotLight: R3FLightProps & { angle?: number; penumbra?: number };
      meshStandardMaterial: R3FMaterialProps;
      meshBasicMaterial: R3FMaterialProps;
      meshPhongMaterial: R3FMaterialProps;
      meshLambertMaterial: R3FMaterialProps;
      bufferGeometry: R3FElementProps;
      bufferAttribute: R3FElementProps & {
        array: ArrayLike<number>;
        itemSize: number;
        count?: number;
      };
      points: R3FElementProps;
      lineSegments: R3FElementProps;
      // 'line' omitted — conflicts with SVG <line> element in @types/react.
      // R3F's <line> is not used in this codebase; <Line> from drei is used instead.
      fog: R3FElementProps & { color?: unknown; near?: number; far?: number };
      boxGeometry: R3FElementProps & { args?: [number, number, number] };
      sphereGeometry: R3FElementProps & { args?: [number, number, number] };
      planeGeometry: R3FElementProps & { args?: [number, number] };
      cylinderGeometry: R3FElementProps & { args?: [number, number, number, number] };
    }
  }
}
