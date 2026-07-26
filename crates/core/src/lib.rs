//! substrate-core — Core domain logic for Aevum.
//!
//! Powers the three subsystems:
//!  - Lattice  → graph layout & traversal algorithms
//!  - Crucible → experiment runtime & benchmark scheduling
//!  - Archive  → content parsing & indexing

pub mod content;
pub mod experiment;
pub mod graph;

// Re-export the most-used types at the crate root.
pub use content::{parse as parse_content, ContentEntry};
pub use experiment::{run as run_experiment, Experiment, ExperimentResult, Measurement};
pub use graph::{
    GraphEdge, GraphEdgeNamed, GraphNode, GraphVertex, IndexedGraph, KnowledgeGraph,
};

/// The Aevum site brand.
pub const SITE_BRAND: &str = "Aevum";

/// The three subsystems of Aevum.
pub const SUBSYSTEMS: &[&str] = &["Lattice", "Crucible", "Archive"];
