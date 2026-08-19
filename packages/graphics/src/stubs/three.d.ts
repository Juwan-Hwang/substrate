/**
 * Lightweight type stub for the `three` module.
 *
 * The real @types/three pulls in the entire Three.js type tree
 * (~4GB RSS during type-check). This stub provides only the types
 * actually used by the graphics package, keeping memory under 50MB.
 */

export class Color {
  constructor(color?: string | number);
  r: number;
  g: number;
  b: number;
  set(color: string | number): this;
  clone(): Color;
}

export class Vector3 {
  constructor(x?: number, y?: number, z?: number);
  x: number;
  y: number;
  z: number;
  set(x: number, y: number, z: number): this;
  copy(v: Vector3): this;
  clone(): Vector3;
  add(v: Vector3): this;
  sub(v: Vector3): this;
  multiplyScalar(s: number): this;
  normalize(): this;
  length(): number;
  distanceTo(v: Vector3): number;
  toArray(): [number, number, number];
}

export class Vector2 {
  constructor(x?: number, y?: number);
  x: number;
  y: number;
  set(x: number, y: number): this;
  clone(): Vector2;
}

export class Mesh {
  scale: { setScalar(s: number): void };
  position: Vector3;
  rotation: { x: number; y: number; z: number };
  geometry: unknown;
  material: unknown;
}

export class Group {
  children: unknown[];
  add(obj: unknown): void;
  position: Vector3;
  rotation: { x: number; y: number; z: number };
}

export class BufferGeometry {
  setAttribute(name: string, value: unknown): this;
  setIndex(value: unknown): this;
}

export class BufferAttribute {
  constructor(array: ArrayLike<number>, itemSize: number);
}

export class LineBasicMaterial {
  constructor(params?: Record<string, unknown>);
  color: Color;
  transparent: boolean;
  opacity: number;
}

export class PointsMaterial {
  constructor(params?: Record<string, unknown>);
  color: Color;
  size: number;
}

export class ShaderMaterial {
  constructor(params?: Record<string, unknown>);
  uniforms: Record<string, unknown>;
}

export class WebGLRenderer {
  constructor(params?: Record<string, unknown>);
  setSize(w: number, h: number): void;
  setPixelRatio(ratio: number): void;
  render(scene: unknown, camera: unknown): void;
  dispose(): void;
}

export class Scene {
  add(obj: unknown): void;
}

export class PerspectiveCamera {
  constructor(fov?: number, aspect?: number, near?: number, far?: number);
  position: Vector3;
  lookAt(v: Vector3): void;
  aspect: number;
  updateProjectionMatrix(): void;
}

export class AmbientLight {
  constructor(color?: unknown, intensity?: number);
}

export class PointLight {
  constructor(color?: unknown, intensity?: number, distance?: number);
  position: Vector3;
}

export class Raycaster {
  setFromCamera(coords: Vector2, camera: unknown): void;
  intersectObjects(objects: unknown[]): Array<{ object: unknown }>;
}
