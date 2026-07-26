//! substrate-core — Core domain logic for Aevum.
//!
//! Powers the three subsystems:
//!  - Lattice  → graph layout & traversal algorithms
//!  - Crucible → experiment runtime & benchmark scheduling
//!  - Archive  → content parsing & indexing

pub mod graph;
pub mod experiment;
pub mod content;

/// The Aevum site brand.
pub const SITE_BRAND: &str = "Aevum";

/// The three subsystems of Aevum.
pub const SUBSYSTEMS: &[&str] = &["Lattice", "Crucible", "Archive"];
