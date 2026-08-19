/**
 * Lightweight type stub for three/tsl (Three Shading Language).
 *
 * The real three/tsl type definitions pull in the entire Three.js type
 * tree (~4GB RSS during type-check). Since the calling code already
 * uses `any` for shader parameters, these minimal stubs provide
 * sufficient typing without the memory overhead.
 */

export type TSLNode = {
  mul(x: TSLNode | number): TSLNode;
  add(x: TSLNode | number): TSLNode;
};

export const time: TSLNode;
export function cos(x: TSLNode | number): TSLNode;
export function sin(x: TSLNode | number): TSLNode;
export function normalize(x: TSLNode): TSLNode;
// biome-ignore lint/suspicious/noExplicitAny: TSL Fn is variadic — params are destructured by the caller
export function Fn(fn: (params: any) => TSLNode): (...args: any[]) => TSLNode;
