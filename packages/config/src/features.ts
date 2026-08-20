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
  /** User comments on content. */
  comments: z.boolean().default(false),
  /** Privacy-friendly analytics (Plausible/PostHog). */
  analytics: z.boolean().default(true),
  /** Three.js / R3F 3D graphics. */
  graphics: z.boolean().default(true),
  /** WebGPU render tier: 'progressive' = detect + fallback, 'off' = never. */
  webgpu: z.enum(['progressive', 'off']).default('progressive'),
  /** Rust/WASM compute modules. */
  wasm: z.boolean().default(true),
  /** Immutable snapshot layer — independent capability. */
  snapshot: z.boolean().default(false),
  /** Content-addressed storage — depends on snapshot. FORBIDDEN if snapshot=false. */
  contentAddressedStorage: z.boolean().default(false),
  /** Binary asset storage (media, attachments). */
  assets: z.boolean().default(false),
  /**
   * Search architecture (backend-neutral):
   *  - 'static'  = client-side, public-only pre-built index
   *  - 'server'  = server-side authorized retrieval
   *  - 'hybrid'  = static for anonymous + server for authenticated
   *  - 'off'     = disabled
   */
  search: z.enum(['off', 'static', 'server', 'hybrid']).default('static'),
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
  snapshot: false,
  contentAddressedStorage: false,
  assets: false,
  search: 'static',
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
  snapshot: false,
  contentAddressedStorage: false,
  assets: false,
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
  snapshot: true,
  contentAddressedStorage: true,
  assets: true,
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
  snapshot: false,
  contentAddressedStorage: false,
  assets: false,
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
 * Reference — all features enabled. Demonstrates the full platform surface.
 * Not a target state: Substrate has no single "complete" form.
 */
export const referenceFeatures: FeatureManifest = featureManifestSchema.parse({
  auth: true,
  comments: true,
  analytics: true,
  graphics: true,
  webgpu: 'progressive',
  wasm: true,
  snapshot: true,
  contentAddressedStorage: true,
  assets: true,
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
  const parsed = featureManifestSchema.parse(manifest);
  // I23: CAS depends on Snapshot. snapshot=false, cas=true is forbidden.
  if (parsed.contentAddressedStorage && !parsed.snapshot) {
    throw new Error(
      'Feature manifest violation: contentAddressedStorage=true requires snapshot=true (§2.5, I23). ' +
        'CAS is an optional enhancement that DEPENDS ON Snapshot — it cannot be enabled independently.',
    );
  }
  activeManifest = parsed;
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
export function validateEnv(manifest: FeatureManifest = activeManifest): string[] {
  const missing: string[] = [];

  if (manifest.auth) {
    if (!process.env.AUTH_SECRET) missing.push('AUTH_SECRET');
    if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  }
  if (manifest.ai) {
    if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      missing.push('OPENAI_API_KEY or ANTHROPIC_API_KEY');
    }
  }
  if (manifest.observability) {
    if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) missing.push('OTEL_EXPORTER_OTLP_ENDPOINT');
    if (!process.env.SENTRY_DSN) missing.push('SENTRY_DSN');
  }
  if (manifest.edgeReadModel) {
    if (!process.env.TURSO_DATABASE_URL) missing.push('TURSO_DATABASE_URL');
    if (!process.env.TURSO_AUTH_TOKEN) missing.push('TURSO_AUTH_TOKEN');
  }
  if (manifest.edge) {
    // Accept either the long form (CLOUDFLARE_API_TOKEN, used in CI/GitHub
    // Actions) or the short form (CF_API_TOKEN, used in some local configs).
    if (!process.env.CLOUDFLARE_API_TOKEN && !process.env.CF_API_TOKEN) {
      missing.push('CLOUDFLARE_API_TOKEN (or CF_API_TOKEN)');
    }
    if (!process.env.CLOUDFLARE_ACCOUNT_ID && !process.env.CF_ACCOUNT_ID) {
      missing.push('CLOUDFLARE_ACCOUNT_ID (or CF_ACCOUNT_ID)');
    }
  }
  if (manifest.rateLimit) {
    if (!process.env.UPSTASH_REDIS_URL) missing.push('UPSTASH_REDIS_URL');
    if (!process.env.UPSTASH_REDIS_TOKEN) missing.push('UPSTASH_REDIS_TOKEN');
  }
  if (manifest.turnstile) {
    // Cloudflare Workers binding uses TURNSTILE_SECRET; some configs use
    // TURNSTILE_SECRET_KEY. Accept either.
    if (!process.env.TURNSTILE_SECRET && !process.env.TURNSTILE_SECRET_KEY) {
      missing.push('TURNSTILE_SECRET (or TURNSTILE_SECRET_KEY)');
    }
    if (!process.env.TURNSTILE_SITE_KEY && !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
      missing.push('TURNSTILE_SITE_KEY or NEXT_PUBLIC_TURNSTILE_SITE_KEY');
    }
  }
  if (manifest.storage) {
    if (!process.env.R2_BUCKET_ID && !process.env.CF_R2_BUCKET_ID) {
      missing.push('R2_BUCKET_ID or CF_R2_BUCKET_ID');
    }
  }
  if (manifest.queue) {
    if (!process.env.CF_QUEUE_NAME && !process.env.QUEUE_NAME) {
      missing.push('CF_QUEUE_NAME or QUEUE_NAME');
    }
  }
  if (manifest.realtime) {
    if (!process.env.CF_DO_NAMESPACE && !process.env.DURABLE_OBJECT_NAMESPACE) {
      missing.push('CF_DO_NAMESPACE or DURABLE_OBJECT_NAMESPACE');
    }
  }

  return missing;
}

/**
 * Strict variant of {@link validateEnv} that throws if any required
 * environment variables are missing. Use this in production startup
 * paths where missing configuration should be a hard failure rather
 * than a warning.
 */
export function strictValidateEnv(manifest: FeatureManifest = activeManifest): void {
  const missing = validateEnv(manifest);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables for enabled features: ${missing.join(', ')}. ` +
        'See .env.example for all required variables.',
    );
  }
}
