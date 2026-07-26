//! WASM Component Model bindings.
//!
//! Generates Rust bindings from the WIT interface definition (wit/world.wit)
//! and implements the exported `graph-layout` and `content` interfaces.
//!
//! When compiled for `wasm32-wasip2`, this produces a standalone WASM Component
//! that can be run in any WASI Preview 2 runtime (wasmtime, wasmer, etc.)
//! without JavaScript glue.
//!
//! Build:
//!   cargo build --target wasm32-wasip2 -p substrate-wasm --no-default-features --features component --release
//!   wasm-tools component new target/wasm32-wasip2/release/substrate_wasm.wasm -o substrate.component.wasm

use std::cell::RefCell;
use std::collections::HashMap;

use substrate_core::{GraphEdgeNamed, GraphNode, KnowledgeGraph};

wit_bindgen::generate!({
    path: "wit",
    world: "substrate",
});

/// Thread-local store for graph handles (WASI has no threads).
thread_local! {
    static GRAPHS: RefCell<HashMap<u32, KnowledgeGraph>> = RefCell::new(HashMap::new());
    static NEXT_HANDLE: RefCell<u32> = RefCell::new(1);
}

/// The component implementation — implements all exported interfaces.
struct SubstrateComponent;

impl GuestGraphLayout for SubstrateComponent {
    fn create(graph: Graph) -> u32 {
        let kg = KnowledgeGraph {
            nodes: graph
                .nodes
                .into_iter()
                .map(|n| GraphNode {
                    id: n.id,
                    label: n.label,
                    x: n.x,
                    y: n.y,
                    z: n.z,
                    weight: n.weight,
                    metadata: serde_json::Value::Null,
                })
                .collect(),
            edges: graph
                .edges
                .into_iter()
                .map(|e| GraphEdgeNamed {
                    source: e.source,
                    target: e.target,
                    weight: e.weight,
                })
                .collect(),
        };

        let handle = NEXT_HANDLE.with(|h| {
            let mut h = h.borrow_mut();
            let id = *h;
            *h += 1;
            id
        });

        GRAPHS.with(|g| g.borrow_mut().insert(handle, kg));
        handle
    }

    fn step(handle: u32, dt: f32) {
        GRAPHS.with(|g| {
            if let Some(kg) = g.borrow_mut().get_mut(&handle) {
                kg.step_layout(dt);
            }
        });
    }

    fn layout(handle: u32, iterations: u32) {
        GRAPHS.with(|g| {
            if let Some(kg) = g.borrow_mut().get_mut(&handle) {
                kg.layout(iterations as usize);
            }
        });
    }

    fn read_positions(handle: u32) -> Vec<f32> {
        GRAPHS.with(|g| {
            g.borrow()
                .get(&handle)
                .map(|kg| kg.nodes.iter().flat_map(|n| [n.x, n.y, n.z]).collect())
                .unwrap_or_default()
        })
    }

    fn node_count(handle: u32) -> u32 {
        GRAPHS.with(|g| {
            g.borrow()
                .get(&handle)
                .map(|kg| kg.nodes.len() as u32)
                .unwrap_or(0)
        })
    }

    fn has_webgpu() -> bool {
        // In a WASI Preview 2 runtime, WebGPU is not available.
        // This is only meaningful in a browser context.
        false
    }

    fn destroy(handle: u32) {
        GRAPHS.with(|g| {
            g.borrow_mut().remove(&handle);
        });
    }
}

impl GuestContent for SubstrateComponent {
    fn parse(raw: String) -> Entry {
        let entry = substrate_core::parse_content(&raw);
        Entry {
            slug: entry.slug,
            title: entry.title,
            body: entry.body,
            tags: entry.tags,
            excerpt: entry.excerpt,
        }
    }
}

// Implement the world's Guest trait — required for export!.
impl Guest for SubstrateComponent {}

export!(SubstrateComponent);
