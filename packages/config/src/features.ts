/**
 * @substrate/config — Feature manifest and shared configuration.
 *
 * The feature manifest is the single source of truth for which capabilities
 * are enabled in a given deployment. Every module, route, worker binding,
 * and environment variable check should reference this manifest rather than
 * scattering booleans across the codebase.
 *
 * To create a new site from substrate:
 *   1. Copy an example (e.g., examples/minimal-site)
 *   2. Override the feature manifest
 *   3. Replace content and branding
 */
import { z } from 'zod';

// ── Feature manifest schema ─────────────────────────────────────────

export const featureManifestSchema = z.object({
  /** Better Auth + Passkeys — admin/draft preview login. */
  auth: z.boolean().default(false),
  /** User comments on articles. */
  comments: z.boolean().default(false),
  /** Privacy-friendly analytics (Plausible/PostHog). */
  analytics: z.boolean().default(true),
  /** Three.js / R3F 3D graphics. */
  graphics: z.boolean().default(true),
  /** WebGPU render tier: 'progressive' = detect + fallback, 'off' = never. */
  webgpu: z.enum(['progressive', 'off']).default('progressive'),
  /** Rust/WASM compute modules. */
  wasm: z.boolean().default(true),
  /** Search provider: 'orama' = client-side static, 'postgres' = PG FTS, 'hybrid' = FTS + pgvector, 'off' = disabled. */
  search: z.enum(['orama', 'postgres', 'hybrid', 'off']).default('orama'),
  /** AI features: RAG, chat, embeddings. */
  ai: z.boolean().default(false),
  /** Realtime collaboration via Durable Objects. */
  realtime: z.boolean().default(false),
  /** Edge read model: Postgres → Queue → Turso projection. */
  edgeReadModel: z.boolean().default(false),
  /** Edge BFF (Cloudflare Worker with Hono). */
  edge: z.boolean().default(false),
  /** Queue-based async processing (embeddings, indexing, OG pre-generation). */
  queue: z.boolean().default(false),
  /** Object storage (R2) for media and attachments. */
  storage: z.boolean().default(false),
  /** Rate limiting via Upstash Redis. */
  rateLimit: z.boolean().default(false),
  /** Bot protection via Cloudflare Turnstile. */
  turnstile: z.boolean().default(false),
  /** OpenTelemetry tracing/metrics/logs export. */
  observability: z.boolean().default(false),
});

export type FeatureManifest = z.infer<typeof featureManifestSchema>;

// ── Preset profiles ─────────────────────────────────────────────────

/**
 * Minimal site — no backend, no database, no AI.
 * Pure content site with static search and OG images.
 */
export const minimalSiteFeatures: FeatureManifest = featureManifestSchema.parse({
  auth: false,
  comments: false,
  analytics: true,
  graphics: false,
  webgpu: 'off',
  wasm: false,
  search: 'orama',
  ai: false,
  realtime: false,
  edgeReadModel: false,
  edge: false,
  queue: false,
  storage: false,
  rateLimit: false,
  turnstile: false,
  observability: false,
});

/**
 * Graphics lab — WebGPU/WGSL, R3F, Rust/WASM, full fallback chain.
 * No database, no AI — pure interactive graphics demo.
 */
export const graphicsLabFeatures: FeatureManifest = featureManifestSchema.parse({
  auth: false,
  comments: false,
  analytics: true,
  graphics: true,
  webgpu: 'progressive',
  wasm: true,
  search: 'off',
  ai: false,
  realtime: false,
  edgeReadModel: false,
  edge: false,
  queue: false,
  storage: false,
  rateLimit: false,
  turnstile: false,
  observability: false,
});

/**
 * AI archive — content ingestion, hybrid search, RAG, citations.
 * Requires PostgreSQL + pgvector + AI provider.
 */
export const aiArchiveFeatures: FeatureManifest = featureManifestSchema.parse({
  auth: true,
  comments: false,
  analytics: true,
  graphics: false,
  webgpu: 'off',
  wasm: false,
  search: 'hybrid',
  ai: true,
  realtime: false,
  edgeReadModel: true,
  edge: true,
  queue: true,
  storage: true,
  rateLimit: true,
  turnstile: true,
  observability: true,
});

/**
 * Realtime room — Workers, Durable Objects, presence, collaboration.
 * Requires Cloudflare Workers deployment.
 */
export const realtimeRoomFeatures: FeatureManifest = featureManifestSchema.parse({
  auth: false,
  comments: false,
  analytics: false,
  graphics: false,
  webgpu: 'off',
  wasm: false,
  search: 'off',
  ai: false,
  realtime: true,
  edgeReadModel: false,
  edge: true,
  queue: false,
  storage: false,
  rateLimit: true,
  turnstile: false,
  observability: true,
});

/**
 * Full platform — all features enabled (the reference implementation).
 */
export const fullPlatformFeatures: FeatureManifest = featureManifestSchema.parse({
  auth: true,
  comments: true,
  analytics: true,
  graphics: true,
  webgpu: 'progressive',
  wasm: true,
  search: 'hybrid',
  ai: true,
  realtime: true,
  edgeReadModel: true,
  edge: true,
  queue: true,
  storage: true,
  rateLimit: true,
  turnstile: true,
  observability: true,
});

// ── Runtime accessor ────────────────────────────────────────────────

let activeManifest: FeatureManifest = minimalSiteFeatures;

/**
 * Initialise the feature manifest at application startup.
 * Call this in instrumentation.ts or the app's entry point.
 */
export function initFeatures(manifest: FeatureManifest): void {
  activeManifest = featureManifestSchema.parse(manifest);
}

/**
 * Get the active feature manifest.
 * Returns the default (minimal) manifest if not initialised.
 */
export function features(): FeatureManifest {
  return activeManifest;
}

/**
 * Check if a specific feature is enabled.
 */
export function isEnabled(feature: keyof FeatureManifest): boolean {
  const value = activeManifest[feature];
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value !== 'off';
  return false;
}

/**
 * Validate that all required environment variables are present
 * for the enabled features. Returns a list of missing variables.
 */
export function validateEnv(
  manifest: FeatureManifest = activeManifest,
): string[] {
  const missing: string[] = [];

  if (manifest.auth) {
    if (!process.env.BETTER_AUTH_SECRET) missing.push('BETTER_AUTH_SECRET');
    if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  }
  if (manifest.ai) {
    if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      missing.push('OPENAI_API_KEY or ANTHROPIC_API_KEY');
    }
  }
  if (manifest.observability) {
    if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) missing.push('OTEL_EXPORTER_OTLP_ENDPOINT');
  }
  if (manifest.edgeReadModel) {
    if (!process.env.TURSO_DATABASE_URL) missing.push('TURSO_DATABASE_URL');
    if (!process.env.TURSO_AUTH_TOKEN) missing.push('TURSO_AUTH_TOKEN');
  }

  return missing;
}
