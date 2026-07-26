/**
 * @substrate/graphics — GPU / knowledge graph / visual system (Lattice).
 *
 * Three.js r185 WebGPURenderer + React Three Fiber + TSL shaders.
 * WASM-accelerated force-directed layout via substrate-wasm.
 * Fallback: WebGPU (wgpu) → WebGL2 (Three.js) → Canvas → static HTML/CSS.
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

export type RendererTier = 'webgpu' | 'webgl2' | 'canvas' | 'static';

/** Detect best available renderer tier. */
export function detectRendererTier(): RendererTier {
  if (typeof navigator !== 'undefined' && 'gpu' in navigator) return 'webgpu';
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (gl) return 'webgl2';
    const ctx = c.getContext('2d');
    if (ctx) return 'canvas';
  }
  return 'static';
}

/**
 * Load the WASM module (substrate-wasm) dynamically.
 *
 * The WASM binary provides:
 *  - `WasmGraph` — CPU force-directed layout (always available)
 *  - `GpuLayout` — GPU compute shader layout (WebGPU required)
 *  - `hasWebGPU()` — feature detection
 *  - `parseContent()` — frontmatter parsing
 */
export async function loadWasm() {
  // The WASM pkg is built by `wasm-pack build --target web` into crates/wasm/pkg.
  // pnpm-workspace.yaml includes `crates/wasm/pkg` as a workspace package.
  const wasm = await import('@substrate/wasm');
  return wasm;
}

/**
 * Create a force-directed layout engine.
 *
 * Uses GPU (wgpu compute shader) when WebGPU is available,
 * falls back to CPU (WasmGraph) otherwise.
 */
export async function createLayout(graph: KnowledgeGraph) {
  const wasm = await loadWasm();

  if (wasm.has_webgpu()) {
    try {
      const gpu = await wasm.GpuLayout.create();
      gpu.load_graph(JSON.stringify(graph));
      return {
        type: 'gpu' as const,
        step: async (dt: number) => gpu.step(dt),
        positions: async () => gpu.read_positions(),
        nodeCount: () => gpu.node_count(),
      };
    } catch {
      // GPU init failed — fall through to CPU.
    }
  }

  // CPU fallback.
  const cpu = new wasm.WasmGraph();
  for (const node of graph.nodes) {
    cpu.add_node(node.id, node.label, node.position[0], node.position[1], node.position[2] ?? 0);
  }
  for (const edge of graph.edges) {
    cpu.add_edge(edge.source, edge.target);
  }
  return {
    type: 'cpu' as const,
    step: async (dt: number) => {
      cpu.step(dt);
    },
    positions: async () => cpu.positions(),
    nodeCount: () => cpu.node_count(),
  };
}

/** Synchronous CPU-only layout (no WASM required). */
export function createGraphLayout(graph: KnowledgeGraph): KnowledgeGraph {
  return graph;
}
