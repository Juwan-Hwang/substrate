//! Crucible — experiment runtime & benchmark scheduling.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Instant;

/// An experiment definition.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Experiment {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub parameters: HashMap<String, String>,
}

/// A single benchmark measurement.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Measurement {
    pub name: String,
    pub value: f64,
    pub unit: String,
}

/// The result of running an experiment.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExperimentResult {
    pub experiment_id: String,
    pub measurements: Vec<Measurement>,
    pub duration_ms: u64,
    pub timestamp: u64,
}

/// Schedule and run an experiment, returning its result.
pub fn run(experiment: &Experiment) -> ExperimentResult {
    let start = Instant::now();

    let iterations: usize = experiment
        .parameters
        .get("iterations")
        .and_then(|v| v.parse().ok())
        .unwrap_or(100);
    let node_count: usize = experiment
        .parameters
        .get("node_count")
        .and_then(|v| v.parse().ok())
        .unwrap_or(50);

    // Build a synthetic ring graph for benchmarking.
    let mut graph = crate::graph::KnowledgeGraph::default();
    for i in 0..node_count {
        let angle = (i as f32) / node_count as f32 * std::f32::consts::TAU;
        graph.nodes.push(crate::graph::GraphNode {
            id: format!("n{i}"),
            label: format!("Node {i}"),
            x: angle.cos(),
            y: angle.sin(),
            z: 0.0,
            weight: 1.0,
            metadata: serde_json::Value::Null,
        });
    }
    for i in 0..node_count {
        let j = (i + 1) % node_count;
        graph.edges.push(crate::graph::GraphEdgeNamed {
            source: format!("n{i}"),
            target: format!("n{j}"),
            weight: 1.0,
        });
    }

    // Run layout and measure timing.
    let layout_start = Instant::now();
    graph.layout(iterations);
    let layout_duration = layout_start.elapsed();

    // Measure convergence: average displacement in one more step.
    let prev: Vec<(f32, f32)> = graph.nodes.iter().map(|n| (n.x, n.y)).collect();
    graph.step_layout(0.1);
    let total_displacement: f64 = graph
        .nodes
        .iter()
        .zip(&prev)
        .map(|(n, (px, py))| {
            let dx = n.x - px;
            let dy = n.y - py;
            ((dx * dx + dy * dy) as f64).sqrt()
        })
        .sum();
    let avg_displacement = if node_count > 0 {
        total_displacement / node_count as f64
    } else {
        0.0
    };

    let measurements = vec![
        Measurement {
            name: "iterations".into(),
            value: iterations as f64,
            unit: "count".into(),
        },
        Measurement {
            name: "node_count".into(),
            value: node_count as f64,
            unit: "count".into(),
        },
        Measurement {
            name: "layout_time_ms".into(),
            value: layout_duration.as_millis() as f64,
            unit: "ms".into(),
        },
        Measurement {
            name: "avg_iteration_time_us".into(),
            value: if iterations > 0 {
                layout_duration.as_micros() as f64 / iterations as f64
            } else {
                0.0
            },
            unit: "µs".into(),
        },
        Measurement {
            name: "convergence_displacement".into(),
            value: avg_displacement,
            unit: "distance".into(),
        },
    ];

    ExperimentResult {
        experiment_id: experiment.id.clone(),
        measurements,
        duration_ms: start.elapsed().as_millis() as u64,
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0),
    }
}
