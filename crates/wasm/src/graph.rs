//! WASM bindings for the Lattice graph subsystem.
//!
//! Exposes `WasmGraph` — a JS-callable wrapper around `KnowledgeGraph`
//! that runs force-directed layout on the CPU (always available).
//! For GPU acceleration, see `GpuLayout`.

use substrate_core::{GraphEdgeNamed, GraphNode, KnowledgeGraph};
use wasm_bindgen::prelude::*;

/// A knowledge graph with CPU-based force-directed layout.
///
/// ```js
/// const g = new WasmGraph();
/// g.addNode("a", "Node A", 0, 0, 0);
/// g.addNode("b", "Node B", 1, 0, 0);
/// g.addEdge("a", "b");
/// g.layout(100); // 100 iterations
/// const json = g.toJson(); // serialized positions
/// ```
#[wasm_bindgen]
pub struct WasmGraph {
    inner: KnowledgeGraph,
}

#[wasm_bindgen]
impl WasmGraph {
    /// Create an empty graph.
    #[wasm_bindgen(constructor)]
    pub fn new() -> WasmGraph {
        WasmGraph { inner: KnowledgeGraph::default() }
    }

    /// Add a node with position.
    pub fn add_node(&mut self, id: String, label: String, x: f32, y: f32, z: f32) {
        self.inner.nodes.push(GraphNode {
            id,
            label,
            x,
            y,
            z,
            weight: 1.0,
            metadata: serde_json::Value::Null,
        });
    }

    /// Add a directed edge between two node IDs.
    pub fn add_edge(&mut self, source: String, target: String) {
        self.inner.edges.push(GraphEdgeNamed { source, target, weight: 1.0 });
    }

    /// Run one step of force-directed layout with temperature `dt`.
    pub fn step(&mut self, dt: f32) {
        self.inner.step_layout(dt);
    }

    /// Run `iterations` steps of layout with cooling.
    pub fn layout(&mut self, iterations: usize) {
        self.inner.layout(iterations);
    }

    /// Get the number of nodes.
    pub fn node_count(&self) -> usize {
        self.inner.nodes.len()
    }

    /// Get the number of edges.
    pub fn edge_count(&self) -> usize {
        self.inner.edges.len()
    }

    /// Serialize the graph to JSON (nodes with positions + edges).
    pub fn to_json(&self) -> String {
        self.inner.to_json().unwrap_or_else(|_| "{}".into())
    }

    /// Load a graph from JSON.
    pub fn from_json(&mut self, json: &str) -> bool {
        match KnowledgeGraph::from_json(json) {
            Ok(g) => {
                self.inner = g;
                true
            }
            Err(_) => false,
        }
    }

    /// Get node positions as a flat Float32Array: [x0, y0, z0, x1, y1, z1, ...].
    pub fn positions(&self) -> js_sys::Float32Array {
        let flat: Vec<f32> = self
            .inner
            .nodes
            .iter()
            .flat_map(|n| [n.x, n.y, n.z])
            .collect();
        js_sys::Float32Array::from(&flat[..])
    }

    /// Get node positions as a JSON string (for debugging / fallback).
    pub fn positions_json(&self) -> String {
        let positions: Vec<[f32; 3]> =
            self.inner.nodes.iter().map(|n| [n.x, n.y, n.z]).collect();
        serde_json::to_string(&positions).unwrap_or_else(|_| "[]".into())
    }
}

impl Default for WasmGraph {
    fn default() -> Self {
        Self::new()
    }
}
