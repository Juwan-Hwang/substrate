//! Crucible — experiment runtime & benchmark scheduling.

use std::collections::HashMap;

/// An experiment definition.
#[derive(Debug, Clone)]
pub struct Experiment {
    pub id: String,
    pub name: String,
    pub parameters: HashMap<String, String>,
}

/// The result of running an experiment.
#[derive(Debug, Clone)]
pub struct ExperimentResult {
    pub experiment_id: String,
    pub metrics: HashMap<String, f64>,
    pub duration_ms: u64,
}

/// Schedule and run an experiment, returning its result.
pub fn run(experiment: &Experiment) -> ExperimentResult {
    let start = std::time::Instant::now();
    // Placeholder: actual experiment logic is subsystem-specific.
    let mut metrics = HashMap::new();
    metrics.insert("iterations".to_string(), 0.0);
    ExperimentResult {
        experiment_id: experiment.id.clone(),
        metrics,
        duration_ms: start.elapsed().as_millis() as u64,
    }
}
