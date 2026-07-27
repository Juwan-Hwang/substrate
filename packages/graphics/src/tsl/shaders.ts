/**
 * TSL (Three Shading Language) shaders for the Lattice subsystem.
 * Hand-written WGSL compute shaders are loaded via substrate-wasm.
 */
import { cos, Fn, normalize, sin, time } from 'three/tsl';

/** Procedural noise displacement for graph node surfaces. */
// biome-ignore lint/suspicious/noExplicitAny: TSL shader types are dynamic
export const noiseDisplacement = Fn(([position]: [any]) => {
  const n = cos(position.x.mul(time))
    .add(sin(position.y.mul(time)))
    .add(cos(position.z.mul(time.mul(0.5))));
  return position.add(normalize(position).mul(n.mul(0.05)));
});

/** Glow edge shader for knowledge graph connections. */
// biome-ignore lint/suspicious/noExplicitAny: TSL shader types are dynamic
export const edgeGlow = Fn(([baseColor]: [any]) => {
  const pulse = sin(time.mul(2)).mul(0.3).add(0.7);
  return baseColor.mul(pulse);
});
