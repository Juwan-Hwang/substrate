/**
 * @substrate/observability — Telemetry, metrics, and tracing.
 *
 * Unified observability surface for all Aevum subsystems. Captures
 * Lattice render performance, Crucible experiment metrics, and
 * Archive content engagement signals.
 */
import type { SubsystemName } from '@substrate/contracts';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

export type LogEntry = {
  level: LogLevel;
  subsystem: SubsystemName;
  message: string;
  timestamp: number;
  context?: Record<string, unknown>;
};

export type Metric = {
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, string>;
  timestamp: number;
};

export interface Logger {
  log(entry: LogEntry): void;
  metric(metric: Metric): void;
}

export const createLogger = (subsystem: SubsystemName): Logger => {
  const log = (entry: LogEntry) => {
    // Placeholder: wire to OTLP exporter in production.
    if (entry.level === 'error') console.error(`[${subsystem}]`, entry.message);
  };
  return {
    log: (e) => log({ ...e, subsystem }),
    metric: (m) => {
      // Placeholder: wire to metrics exporter.
    },
  };
};
