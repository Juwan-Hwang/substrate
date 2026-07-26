//! substrate-wasm — WASM bindings for Aevum.
//!
//! Exposes the core domain logic to the browser, enabling in-page
//! GPU-accelerated graph layout (Lattice) and client-side experiment
//! execution (Crucible) without a server round-trip.

use wasm_bindgen::prelude::*;
use substrate_core::graph::{KnowledgeGraph, GraphNode, GraphEdge};

#[wasm_bindgen]
pub struct WasmGraph {
    inner: KnowledgeGraph,
}

#[wasm_bindgen]
impl WasmGraph {
    #[wasm_bindgen(constructor)]
    pub fn new() -> WasmGraph {
        WasmGraph { inner: KnowledgeGraph::default() }
    }

    pub fn add_node(&mut self, id: String, label: String, x: f32, y: f32) {
        self.inner.nodes.push(GraphNode {
            id,
            label,
            x,
            y,
            z: 0.0,
            weight: 1.0,
        });
    }

    pub fn add_edge(&mut self, source: String, target: String) {
        self.inner.edges.push(GraphEdge { source, target, weight: 1.0 });
    }

    pub fn step(&mut self, dt: f32) {
        self.inner.step_layout(dt);
    }

    pub fn node_count(&self) -> usize {
        self.inner.nodes.len()
    }
}

/// Returns the site brand.
#[wasm_bindgen]
pub fn site_brand() -> String {
    substrate_core::SITE_BRAND.to_string()
}
