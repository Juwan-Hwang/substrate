/* tslint:disable */
/* eslint-disable */

/**
 * GPU-accelerated force-directed layout.
 *
 * ```js
 * const gpu = await GpuLayout.create();
 * gpu.loadGraph(graphJson);
 * await gpu.step(0.1);
 * const positions = await gpu.readPositions(); // Float32Array
 * ```
 */
export class GpuLayout {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Create a GPU layout engine. Returns `Err` if WebGPU is unavailable.
     */
    static create(): Promise<GpuLayout>;
    /**
     * Load a graph from JSON. Reallocates GPU buffers if the size changed.
     */
    loadGraph(json: string): boolean;
    /**
     * Get the number of nodes currently loaded.
     */
    nodeCount(): number;
    /**
     * Read back vertex positions as a Float32Array.
     *
     * Creates a staging buffer, copies data, maps it, and returns the data.
     */
    readPositions(): Promise<Float32Array>;
    /**
     * Run one compute step with the given temperature (`dt`).
     *
     * Dispatches the compute shader, then copies dst → src so the next
     * step reads the updated positions.
     */
    step(dt: number): Promise<void>;
}

/**
 * A knowledge graph with CPU-based force-directed layout.
 *
 * ```js
 * const g = new WasmGraph();
 * g.addNode("a", "Node A", 0, 0, 0);
 * g.addNode("b", "Node B", 1, 0, 0);
 * g.addEdge("a", "b");
 * g.layout(100); // 100 iterations
 * const json = g.toJson(); // serialized positions
 * ```
 */
export class WasmGraph {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Add a directed edge between two node IDs.
     */
    add_edge(source: string, target: string): void;
    /**
     * Add a node with position.
     */
    add_node(id: string, label: string, x: number, y: number, z: number): void;
    /**
     * Get the number of edges.
     */
    edge_count(): number;
    /**
     * Load a graph from JSON.
     */
    from_json(json: string): boolean;
    /**
     * Run `iterations` steps of layout with cooling.
     */
    layout(iterations: number): void;
    /**
     * Create an empty graph.
     */
    constructor();
    /**
     * Get the number of nodes.
     */
    node_count(): number;
    /**
     * Get node positions as a flat Float32Array: [x0, y0, z0, x1, y1, z1, ...].
     */
    positions(): Float32Array;
    /**
     * Get node positions as a JSON string (for debugging / fallback).
     */
    positions_json(): string;
    /**
     * Run one step of force-directed layout with temperature `dt`.
     */
    step(dt: number): void;
    /**
     * Serialize the graph to JSON (nodes with positions + edges).
     */
    to_json(): string;
}

/**
 * Detect WebGPU availability in the current browser.
 */
export function has_webgpu(): boolean;

/**
 * Initialize the WASM panic hook for better error messages in the console.
 */
export function init(): void;

/**
 * Parse frontmatter content (Archive subsystem).
 */
export function parse_content(raw: string): any;

/**
 * Returns the site brand.
 */
export function site_brand(): string;

/**
 * Returns the three subsystem names as a comma-separated string.
 */
export function subsystems(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_gpulayout_free: (a: number, b: number) => void;
    readonly __wbg_wasmgraph_free: (a: number, b: number) => void;
    readonly gpulayout_create: () => number;
    readonly gpulayout_loadGraph: (a: number, b: number, c: number) => number;
    readonly gpulayout_nodeCount: (a: number) => number;
    readonly gpulayout_readPositions: (a: number) => number;
    readonly gpulayout_step: (a: number, b: number) => number;
    readonly has_webgpu: () => number;
    readonly parse_content: (a: number, b: number) => number;
    readonly site_brand: (a: number) => void;
    readonly subsystems: (a: number) => void;
    readonly wasmgraph_add_edge: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly wasmgraph_add_node: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly wasmgraph_edge_count: (a: number) => number;
    readonly wasmgraph_from_json: (a: number, b: number, c: number) => number;
    readonly wasmgraph_layout: (a: number, b: number) => void;
    readonly wasmgraph_new: () => number;
    readonly wasmgraph_node_count: (a: number) => number;
    readonly wasmgraph_positions: (a: number) => number;
    readonly wasmgraph_positions_json: (a: number, b: number) => void;
    readonly wasmgraph_step: (a: number, b: number) => void;
    readonly wasmgraph_to_json: (a: number, b: number) => void;
    readonly init: () => void;
    readonly __wasm_bindgen_func_elem_1180: (a: number, b: number, c: number, d: number) => void;
    readonly __wasm_bindgen_func_elem_1195: (a: number, b: number, c: number, d: number) => void;
    readonly __wasm_bindgen_func_elem_265: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_export3: (a: number) => void;
    readonly __wbindgen_export4: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export5: (a: number, b: number) => void;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
