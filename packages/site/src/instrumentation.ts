/**
 * registerInstrumentation — Next.js instrumentation hook factory.
 *
 * The application calls this from its `instrumentation.ts`:
 *
 * ```ts
 * // instrumentation.ts
 * import { registerInstrumentation } from '@substrate/site/instrumentation';
 *
 * export const register = registerInstrumentation({
 *   featurePreset: 'reference',
 *   serviceName: 'my-site',
 * });
 * ```
 *
 * The factory handles:
 *   1. Feature manifest initialization from a preset name.
 *   2. OpenTelemetry SDK startup (if endpoint is configured).
 *   3. Env validation warnings for enabled features.
 *
 * The platform does NOT hardcode any application name, service name,
 * or feature preset.
 */
import type { FeatureManifest } from '@substrate/config/features';

export type InstrumentationConfig = {
  /**
   * Feature preset name. Maps to presets in @substrate/config.
   * If omitted, defaults to 'minimal' in production, 'full' otherwise.
   */
  featurePreset?: 'minimal' | 'graphics' | 'ai-archive' | 'realtime' | 'reference';
  /**
   * OTEL service name. Defaults to 'substrate'.
   * Applications should override with their own name.
   */
  serviceName?: string;
  /**
   * OTEL trace sample rate. Defaults to 0.1.
   */
  traceSampleRate?: number;
  /**
   * Custom feature manifest. If provided, overrides `featurePreset`.
   */
  featureManifest?: FeatureManifest;
};

export function registerInstrumentation(config?: InstrumentationConfig) {
  return async function register(): Promise<void> {
    const {
      initFeatures,
      minimalSiteFeatures,
      graphicsLabFeatures,
      aiArchiveFeatures,
      realtimeRoomFeatures,
      referenceFeatures,
      validateEnv,
    } = await import('@substrate/config/features');

    // Determine the feature manifest.
    const isProduction = process.env.NODE_ENV === 'production';
    const profile = config?.featurePreset ?? (isProduction ? 'minimal' : 'reference');

    const presets = {
      minimal: minimalSiteFeatures,
      graphics: graphicsLabFeatures,
      'ai-archive': aiArchiveFeatures,
      realtime: realtimeRoomFeatures,
      reference: referenceFeatures,
    };

    const manifest = config?.featureManifest ?? presets[profile] ?? minimalSiteFeatures;
    initFeatures(manifest);

    // Warn about missing env vars for enabled features.
    const missing = validateEnv(manifest);
    if (missing.length > 0) {
      console.warn(`[features] Missing env vars: ${missing.join(', ')}`);
    }

    // Start OpenTelemetry if on Node.js runtime and endpoint is configured.
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
      if (!endpoint) {
        console.warn('[OTel] OTEL_EXPORTER_OTLP_ENDPOINT not set — skipping SDK init');
        return;
      }

      const { startOTEL } = await import('@substrate/observability');

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
        serviceName: config?.serviceName ?? process.env.OTEL_SERVICE_NAME ?? 'substrate',
        traceSampleRate:
          config?.traceSampleRate ?? Number(process.env.OTEL_TRACES_SAMPLE_RATE ?? 0.1),
      });
    }
  };
}
