/**
 * @substrate/observability — Telemetry, metrics, and tracing.
 *
 * OpenTelemetry → Grafana Cloud (Tempo + Loki + Prometheus).
 * Sentry for error tracking, PostHog for product analytics.
 * Captures Lattice render performance, Crucible experiment metrics,
 * and Archive content engagement signals.
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

export function createLogger(subsystem: SubsystemName): Logger {
  const log = (entry: LogEntry) => {
    // Wire to OTLP exporter in production.
    if (entry.level === 'error') console.error(`[${subsystem}]`, entry.message, entry.context ?? '');
  };
  return {
    log: (e) => log({ ...e, subsystem }),
    metric: (m) => {
      // Wire to Prometheus exporter.
    },
  };
}

// ── Sentry ───────────────────────────────────────────────────────────

export type SentryConfig = {
  dsn: string;
  environment: string;
  release?: string;
};

export function initSentry(config: SentryConfig) {
  // Dynamic import to avoid bundling Sentry in edge environments.
  return import('@sentry/nextjs').then((Sentry) => {
    Sentry.init({
      dsn: config.dsn,
      environment: config.environment,
      release: config.release,
      tracesSampleRate: 0.1,
    });
  });
}

// ── PostHog ──────────────────────────────────────────────────────────

export type PostHogConfig = {
  apiKey: string;
  host?: string;
};

export function createPostHog(config: PostHogConfig) {
  return import('posthog-node').then(({ PostHog }) => {
    return new PostHog(config.apiKey, { host: config.host ?? 'https://app.posthog.com' });
  });
}
