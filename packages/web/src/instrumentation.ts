/**
 * Next.js Instrumentation — registers OpenTelemetry SDK at startup.
 *
 * Next.js calls `register()` once when the server starts. We use this
 * to bootstrap the OTel pipeline (traces → Tempo, metrics → Prometheus,
 * logs → Loki) exporting to Grafana Cloud.
 *
 * Credentials are read from environment variables:
 *   OTEL_EXPORTER_OTLP_ENDPOINT  — Grafana Cloud OTLP URL
 *   OTEL_EXPORTER_OTLP_HEADERS   — "Authorization=Basic <base64>"
 *   OTEL_SERVICE_NAME            — defaults to "aevum-web"
 */
export async function register() {
  // Initialise feature manifest first — other modules reference it.
  const { initFeatures, fullPlatformFeatures, validateEnv } = await import('@substrate/config/features');
  initFeatures(fullPlatformFeatures);

  // Warn about missing env vars for enabled features.
  const missing = validateEnv();
  if (missing.length > 0) {
    console.warn(`[features] Missing env vars: ${missing.join(', ')}`);
  }

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startOTEL } = await import('@substrate/observability');

    const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    if (!endpoint) {
      console.warn('[OTel] OTEL_EXPORTER_OTLP_ENDPOINT not set — skipping SDK init');
      return;
    }

    // Parse headers from "key1=val1,key2=val2" format.
    const headers: Record<string, string> = {};
    const rawHeaders = process.env.OTEL_EXPORTER_OTLP_HEADERS;
    if (rawHeaders) {
      for (const pair of rawHeaders.split(',')) {
        const [k, v] = pair.split('=').map((s) => s.trim());
        if (k && v) headers[k] = v;
      }
    }

    await startOTEL({
      endpoint,
      headers,
      serviceName: process.env.OTEL_SERVICE_NAME ?? 'aevum-web',
      traceSampleRate: Number(process.env.OTEL_TRACES_SAMPLE_RATE ?? 0.1),
    });
  }
}
