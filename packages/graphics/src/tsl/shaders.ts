/**
 * TSL (Three Shading Language) shaders for the Lattice subsystem.
 * Hand-written WGSL compute shaders are loaded via substrate-wasm.
 */
import { cos, Fn, normalize, sin, type TSLNode, time } from 'three/tsl';

/** Procedural noise displacement for graph node surfaces. */
export const noiseDisplacement = Fn(([position]: [TSLNode]) => {
  const n = cos(position.x.mul(time))
    .add(sin(position.y.mul(time)))
    .add(cos(position.z.mul(time.mul(0.5))));
  return position.add(normalize(position).mul(n.mul(0.05)));
});

/** Glow edge shader for knowledge graph connections. */
export const edgeGlow = Fn(([baseColor]: [TSLNode]) => {
  const pulse = sin(time.mul(2)).mul(0.3).add(0.7);
  return baseColor.mul(pulse);
});
