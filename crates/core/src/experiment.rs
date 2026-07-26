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
    let measurements = vec![Measurement {
        name: "iterations".into(),
        value: 0.0,
        unit: "count".into(),
    }];
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
