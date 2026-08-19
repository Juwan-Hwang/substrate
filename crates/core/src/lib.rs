//! substrate-core — Core domain logic for Substrate.
//!
//! Provides graph layout algorithms, content parsing, experiment runtime,
//! and SIMD operations — all generic, with no application-specific knowledge.

pub mod content;
pub mod experiment;
pub mod graph;
pub mod simd;

// Re-export the most-used types at the crate root.
pub use content::{ContentEntry, parse as parse_content};
pub use experiment::{Experiment, ExperimentResult, Measurement, run as run_experiment};
pub use graph::{GraphEdge, GraphEdgeNamed, GraphNode, GraphVertex, IndexedGraph, KnowledgeGraph};
pub use simd::{attractive_forces_simd, repulsive_forces_simd};
