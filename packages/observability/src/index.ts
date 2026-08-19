/**
 * @substrate/observability — Telemetry, metrics, and tracing.
 *
 * OpenTelemetry → Grafana Cloud (Tempo for traces, Loki for logs,
 * Prometheus for metrics). Sentry for error tracking, PostHog for
 * product analytics. Langfuse for AI-specific tracing (bridged via
 * OTel in @substrate/ai).
 *
 * Captures render performance, experiment metrics, and content
 * engagement signals.
 */
// ── OTel SDK setup ──────────────────────────────────────────────────

export type OTelConfig = {
  /** Grafana Cloud OTLP endpoint (e.g. https://tempo-prod-XX.grafana.net/otlp). */
  endpoint: string;
  /** Grafana Cloud instance ID + API key, base64-encoded as "instanceId:apiKey". */
  headers?: Record<string, string>;
  /** Sample rate for traces (0.0 to 1.0). */
  traceSampleRate?: number;
  /** Service name for resource attribution. */
  serviceName?: string;
};

let otelStarted = false;

/**
 * Initialise the OpenTelemetry SDK and export traces/metrics/logs
 * to Grafana Cloud via OTLP.
 *
 * Call once at application startup (server-side only).
 * In Next.js, call from instrumentation.ts.
 */
export async function startOTEL(config: OTelConfig) {
  if (otelStarted) return;
  otelStarted = true;

  const { NodeSDK } = await import('@opentelemetry/sdk-node');
  const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
  const { OTLPMetricExporter } = await import('@opentelemetry/exporter-metrics-otlp-http');
  const { OTLPLogExporter } = await import('@opentelemetry/exporter-logs-otlp-http');
  const { PeriodicExportingMetricReader } = await import('@opentelemetry/sdk-metrics');
  const { BatchLogRecordProcessor } = await import('@opentelemetry/sdk-logs');
  const { diag, DiagConsoleLogger, DiagLogLevel } = await import('@opentelemetry/api');
  const { resourceFromAttributes } = await import('@opentelemetry/resources');
  const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = await import(
    '@opentelemetry/semantic-conventions'
  );
  const autoInstrumentations = await import('@opentelemetry/auto-instrumentations-node');

  const headers = config.headers ?? {};
  const serviceName = config.serviceName ?? 'substrate';

  const traceExporter = new OTLPTraceExporter({
    url: `${config.endpoint}/v1/traces`,
    headers,
  });

  const metricExporter = new OTLPMetricExporter({
    url: `${config.endpoint}/v1/metrics`,
    headers,
  });

  const logExporter = new OTLPLogExporter({
    url: `${config.endpoint}/v1/logs`,
    headers,
  });

  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? '0.1.0',
    }),
    traceExporter,
    metricReader: new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 10_000,
    }),
    logRecordProcessor: new BatchLogRecordProcessor({ exporter: logExporter }),
    instrumentations: [
      autoInstrumentations.getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();
  console.info('[OTel] SDK started — exporting to Grafana Cloud');

  // Graceful shutdown.
  process.on('SIGTERM', () => {
    sdk
      .shutdown()
      .then(() => console.info('[OTel] SDK shut down'))
      .catch((err) => console.error('[OTel] SDK shutdown error', err));
  });
}

// ── Logger ──────────────────────────────────────────────────────────

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

export type LogEntry = {
  level: LogLevel;
  scope: string;
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

export function createLogger(scope: string): Logger {
  const log = (entry: LogEntry) => {
    if (entry.level === 'error') console.error(`[${scope}]`, entry.message, entry.context ?? '');
    else if (entry.level === 'warn') console.warn(`[${scope}]`, entry.message, entry.context ?? '');
    else console.info(`[${scope}]`, entry.message, entry.context ?? '');
  };
  return {
    log: (e) => log({ ...e, scope }),
    metric: (m) => {
      // Metrics are auto-collected by OTel instrumentation.
      // Custom metrics can be added via meterProvider.getMeter().
      console.debug(`[metric:${scope}]`, m.name, m.value, m.unit ?? '', m.tags ?? '');
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
  return import('@sentry/nextjs').then((Sentry) => {
    Sentry.init({
      dsn: config.dsn,
      environment: config.environment,
      ...(config.release !== undefined ? { release: config.release } : {}),
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
