/**
 * Lightweight type stub for three/tsl (Three Shading Language).
 *
 * The real three/tsl type definitions pull in the entire Three.js type
 * tree (~4GB RSS during type-check). These minimal stubs provide
 * sufficient typing for the shader functions used by the graphics
 * package without the memory overhead.
 */

export type TSLNode = {
  x: TSLNode;
  y: TSLNode;
  z: TSLNode;
  mul(x: TSLNode | number): TSLNode;
  add(x: TSLNode | number): TSLNode;
};

export const time: TSLNode;
export function cos(x: TSLNode | number): TSLNode;
export function sin(x: TSLNode | number): TSLNode;
export function normalize(x: TSLNode): TSLNode;
export function Fn<P extends readonly unknown[]>(
  fn: (params: P) => TSLNode,
): (...args: P) => TSLNode;
