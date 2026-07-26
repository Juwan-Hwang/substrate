//! Lattice — graph algorithms.
//!
//! Force-directed layout, shortest-path, and traversal primitives.
//! These are the CPU reference implementations; the GPU-accelerated
//! variants live in substrate-wasm.

/// A node in the knowledge graph.
#[derive(Debug, Clone)]
pub struct GraphNode {
    pub id: String,
    pub label: String,
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub weight: f32,
}

/// A directed edge between two nodes.
#[derive(Debug, Clone)]
pub struct GraphEdge {
    pub source: String,
    pub target: String,
    pub weight: f32,
}

/// A complete knowledge graph.
#[derive(Debug, Clone, Default)]
pub struct KnowledgeGraph {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

impl KnowledgeGraph {
    /// One iteration of force-directed layout (Fruchterman–Reingold).
    pub fn step_layout(&mut self, dt: f32) {
        let k = 1.0_f32;
        // Repulsion
        for i in 0..self.nodes.len() {
            for j in (i + 1)..self.nodes.len() {
                let dx = self.nodes[i].x - self.nodes[j].x;
                let dy = self.nodes[i].y - self.nodes[j].y;
                let dist = (dx * dx + dy * dy).sqrt().max(0.01);
                let force = (k * k) / dist;
                self.nodes[i].x += dx / dist * force * dt;
                self.nodes[i].y += dy / dist * force * dt;
                self.nodes[j].x -= dx / dist * force * dt;
                self.nodes[j].y -= dy / dist * force * dt;
            }
        }
        // Attraction along edges
        for edge in &self.edges {
            let (Some(a), Some(b)) = (
                self.nodes.iter_mut().find(|n| n.id == edge.source),
                self.nodes.iter_mut().find(|n| n.id == edge.target),
            ) else {
                continue;
            };
            let dx = b.x - a.x;
            let dy = b.y - a.y;
            let dist = (dx * dx + dy * dy).sqrt().max(0.01);
            let force = (dist * dist) / k;
            a.x += dx / dist * force * dt;
            a.y += dy / dist * force * dt;
            b.x -= dx / dist * force * dt;
            b.y -= dy / dist * force * dt;
        }
    }
}
