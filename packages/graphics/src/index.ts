/**
 * @substrate/graphics — GPU / knowledge graph / visual system (Lattice).
 *
 * WebGL rendering primitives, shader pipelines, and graph layout algorithms
 * powering the Lattice subsystem of Aevum.
 */

export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];
export type Vec4 = readonly [number, number, number, number];

export type GraphNode = {
  id: string;
  label: string;
  position: Vec3;
  weight?: number;
  metadata?: Record<string, unknown>;
};

export type GraphEdge = {
  source: string;
  target: string;
  weight?: number;
};

export type KnowledgeGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

/** Force-directed layout seed — actual GPU compute lives in substrate-wasm. */
export const createGraphLayout = (graph: KnowledgeGraph): KnowledgeGraph => {
  // Placeholder: WASM-accelerated layout will replace this.
  return graph;
};
