//! Lattice — graph algorithms.
//!
//! Force-directed layout (Fruchterman–Reingold), shortest-path, and traversal.
//! CPU reference implementations; GPU-accelerated variants live in substrate-wasm.

use bytemuck::{Pod, Zeroable};
use serde::{Deserialize, Serialize};

use crate::simd::repulsive_forces_simd;

/// GPU-ready vertex: position (xyz) + weight, 16 bytes, std140-compatible.
#[repr(C)]
#[derive(Debug, Clone, Copy, Pod, Zeroable, Serialize, Deserialize)]
pub struct GraphVertex {
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub weight: f32,
}

impl GraphVertex {
    /// Byte stride (16) — matches `wgpu::BufferAddress` (u64) for buffer creation.
    pub const STRIDE: u64 = std::mem::size_of::<Self>() as u64;
}

/// A node in the knowledge graph (rich metadata, not GPU-uploaded directly).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphNode {
    pub id: String,
    pub label: String,
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub weight: f32,
    #[serde(default)]
    pub metadata: serde_json::Value,
}

impl Default for GraphNode {
    fn default() -> Self {
        Self {
            id: String::new(),
            label: String::new(),
            x: 0.0,
            y: 0.0,
            z: 0.0,
            weight: 1.0,
            metadata: serde_json::Value::Null,
        }
    }
}

impl From<&GraphNode> for GraphVertex {
    fn from(n: &GraphNode) -> Self {
        Self {
            x: n.x,
            y: n.y,
            z: n.z,
            weight: n.weight,
        }
    }
}

/// A directed edge between two nodes (index-based for GPU).
#[repr(C)]
#[derive(Debug, Clone, Copy, Pod, Zeroable, Serialize, Deserialize)]
pub struct GraphEdge {
    pub source: u32,
    pub target: u32,
    pub weight: f32,
    pub _pad: u32, // align to 16 bytes
}

/// Edge with string IDs (human-facing).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphEdgeNamed {
    pub source: String,
    pub target: String,
    pub weight: f32,
}

/// A complete knowledge graph.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct KnowledgeGraph {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdgeNamed>,
}

/// Index-resolved graph for GPU upload.
#[derive(Debug, Clone)]
pub struct IndexedGraph {
    pub vertices: Vec<GraphVertex>,
    pub edges: Vec<GraphEdge>,
    pub ids: Vec<String>,
}

impl KnowledgeGraph {
    /// Build an index-resolved graph suitable for GPU buffer upload.
    pub fn index(&self) -> IndexedGraph {
        let ids: Vec<String> = self.nodes.iter().map(|n| n.id.clone()).collect();
        let vertices: Vec<GraphVertex> = self.nodes.iter().map(GraphVertex::from).collect();
        let edges: Vec<GraphEdge> = self
            .edges
            .iter()
            .filter_map(|e| {
                let s = ids.iter().position(|id| id == &e.source)?;
                let t = ids.iter().position(|id| id == &e.target)?;
                Some(GraphEdge {
                    source: s as u32,
                    target: t as u32,
                    weight: e.weight,
                    _pad: 0,
                })
            })
            .collect();
        IndexedGraph {
            vertices,
            edges,
            ids,
        }
    }

    /// One iteration of force-directed layout (Fruchterman–Reingold).
    ///
    /// Displacement is capped to `dt` per node (standard FR constraint),
    /// preventing nodes from overshooting past each other.
    pub fn step_layout(&mut self, dt: f32) {
        let k = 1.0_f32;
        let n = self.nodes.len();

        // Accumulate forces, then apply with displacement capping.
        let mut forces = vec![[0.0_f32; 2]; n];

        // Extract position arrays for SIMD acceleration.
        let nodes_x: Vec<f32> = self.nodes.iter().map(|n| n.x).collect();
        let nodes_y: Vec<f32> = self.nodes.iter().map(|n| n.y).collect();

        // Repulsive forces (all-pairs) — SIMD-accelerated via f32x4.
        for i in 0..n {
            let (fx, fy) = repulsive_forces_simd(nodes_x[i], nodes_y[i], &nodes_x, &nodes_y, k);
            forces[i][0] += fx;
            forces[i][1] += fy;
        }

        // Attractive forces along edges.
        for edge in &self.edges {
            let (Some(s), Some(t)) = (
                self.nodes.iter().position(|n| n.id == edge.source),
                self.nodes.iter().position(|n| n.id == edge.target),
            ) else {
                continue;
            };
            let dx = self.nodes[t].x - self.nodes[s].x;
            let dy = self.nodes[t].y - self.nodes[s].y;
            let dist = (dx * dx + dy * dy).sqrt().max(0.01);
            let force = (dist * dist) / k;
            let fx = dx / dist * force;
            let fy = dy / dist * force;
            forces[s][0] += fx;
            forces[s][1] += fy;
            forces[t][0] -= fx;
            forces[t][1] -= fy;
        }

        // Apply forces with displacement capped to dt.
        for (node, force) in self.nodes.iter_mut().zip(forces.iter()) {
            let fx = force[0];
            let fy = force[1];
            let mag = (fx * fx + fy * fy).sqrt().max(0.01);
            let capped = mag.min(dt);
            node.x += fx / mag * capped;
            node.y += fy / mag * capped;
        }
    }

    /// Run `iterations` steps of layout, cooling the temperature each step.
    pub fn layout(&mut self, iterations: usize) {
        let cooling = 0.99_f32;
        let mut temp = 1.0_f32;
        for _ in 0..iterations {
            self.step_layout(temp);
            temp *= cooling;
        }
    }

    /// Serialize to JSON (for persistence / JS interop).
    pub fn to_json(&self) -> serde_json::Result<String> {
        serde_json::to_string(self)
    }

    /// Deserialize from JSON.
    pub fn from_json(json: &str) -> serde_json::Result<Self> {
        serde_json::from_str(json)
    }
}

impl IndexedGraph {
    /// Flat byte slice of vertices for `wgpu::Buffer` upload.
    pub fn vertices_bytes(&self) -> &[u8] {
        bytemuck::cast_slice(&self.vertices)
    }

    /// Flat byte slice of edges for `wgpu::Buffer` upload.
    pub fn edges_bytes(&self) -> &[u8] {
        bytemuck::cast_slice(&self.edges)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn layout_converges() {
        let mut g = KnowledgeGraph {
            nodes: vec![
                GraphNode {
                    id: "a".into(),
                    label: "A".into(),
                    x: 0.0,
                    y: 0.0,
                    z: 0.0,
                    weight: 1.0,
                    metadata: serde_json::Value::Null,
                },
                GraphNode {
                    id: "b".into(),
                    label: "B".into(),
                    x: 0.5,
                    y: 0.0,
                    z: 0.0,
                    weight: 1.0,
                    metadata: serde_json::Value::Null,
                },
            ],
            edges: vec![GraphEdgeNamed {
                source: "a".into(),
                target: "b".into(),
                weight: 1.0,
            }],
        };
        g.layout(200);
        // Nodes should not collapse to the same position.
        let dist = (g.nodes[0].x - g.nodes[1].x).abs() + (g.nodes[0].y - g.nodes[1].y).abs();
        assert!(dist > 0.01, "nodes collapsed to same position");
    }

    #[test]
    fn index_resolves_ids() {
        let g = KnowledgeGraph {
            nodes: vec![
                GraphNode {
                    id: "a".into(),
                    label: "A".into(),
                    x: 0.0,
                    y: 0.0,
                    z: 0.0,
                    weight: 1.0,
                    metadata: serde_json::Value::Null,
                },
                GraphNode {
                    id: "b".into(),
                    label: "B".into(),
                    x: 1.0,
                    y: 0.0,
                    z: 0.0,
                    weight: 1.0,
                    metadata: serde_json::Value::Null,
                },
            ],
            edges: vec![GraphEdgeNamed {
                source: "a".into(),
                target: "b".into(),
                weight: 1.0,
            }],
        };
        let ig = g.index();
        assert_eq!(ig.edges[0].source, 0);
        assert_eq!(ig.edges[0].target, 1);
    }

    #[test]
    fn vertex_stride_is_16() {
        assert_eq!(GraphVertex::STRIDE, 16);
    }
}
