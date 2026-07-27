/**
 * Unit tests for @substrate/config — feature manifest, presets, runtime accessor.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  aiArchiveFeatures,
  featureManifestSchema,
  features,
  fullPlatformFeatures,
  graphicsLabFeatures,
  initFeatures,
  isEnabled,
  minimalSiteFeatures,
  realtimeRoomFeatures,
  validateEnv,
} from '../features';

// ── Schema ──────────────────────────────────────────────────────────

describe('featureManifestSchema', () => {
  it('parses a valid manifest with defaults', () => {
    const result = featureManifestSchema.parse({ auth: true });
    expect(result.auth).toBe(true);
    expect(result.analytics).toBe(true);
    expect(result.ai).toBe(false);
  });

  it('rejects an invalid webgpu value', () => {
    expect(() => featureManifestSchema.parse({ webgpu: 'invalid' })).toThrow();
  });

  it('rejects an invalid search value', () => {
    expect(() => featureManifestSchema.parse({ search: 'nonexistent' })).toThrow();
  });
});

// ── Presets ─────────────────────────────────────────────────────────

describe('preset profiles', () => {
  it('minimalSiteFeatures disables all backend features', () => {
    expect(minimalSiteFeatures.auth).toBe(false);
    expect(minimalSiteFeatures.ai).toBe(false);
    expect(minimalSiteFeatures.graphics).toBe(false);
    expect(minimalSiteFeatures.webgpu).toBe('off');
    expect(minimalSiteFeatures.search).toBe('orama');
  });

  it('graphicsLabFeatures enables graphics + wasm', () => {
    expect(graphicsLabFeatures.graphics).toBe(true);
    expect(graphicsLabFeatures.wasm).toBe(true);
    expect(graphicsLabFeatures.webgpu).toBe('progressive');
    expect(graphicsLabFeatures.ai).toBe(false);
  });

  it('aiArchiveFeatures enables the full AI stack', () => {
    expect(aiArchiveFeatures.ai).toBe(true);
    expect(aiArchiveFeatures.search).toBe('hybrid');
    expect(aiArchiveFeatures.auth).toBe(true);
    expect(aiArchiveFeatures.edge).toBe(true);
    expect(aiArchiveFeatures.queue).toBe(true);
  });

  it('realtimeRoomFeatures enables realtime + edge', () => {
    expect(realtimeRoomFeatures.realtime).toBe(true);
    expect(realtimeRoomFeatures.edge).toBe(true);
    expect(realtimeRoomFeatures.ai).toBe(false);
  });

  it('fullPlatformFeatures enables everything', () => {
    expect(fullPlatformFeatures.auth).toBe(true);
    expect(fullPlatformFeatures.comments).toBe(true);
    expect(fullPlatformFeatures.ai).toBe(true);
    expect(fullPlatformFeatures.realtime).toBe(true);
    expect(fullPlatformFeatures.observability).toBe(true);
  });
});

// ── Runtime accessor ────────────────────────────────────────────────

describe('runtime accessor', () => {
  beforeEach(() => {
    initFeatures(minimalSiteFeatures);
  });

  it('returns the initialised manifest', () => {
    expect(features().auth).toBe(false);
    expect(features().search).toBe('orama');
  });

  it('isEnabled returns correct boolean for boolean features', () => {
    expect(isEnabled('auth')).toBe(false);
    expect(isEnabled('analytics')).toBe(true);
    expect(isEnabled('graphics')).toBe(false);
  });

  it('isEnabled handles string features', () => {
    expect(isEnabled('webgpu')).toBe(false); // 'off'
    initFeatures(graphicsLabFeatures);
    expect(isEnabled('webgpu')).toBe(true); // 'progressive'
  });
});

// ── validateEnv ─────────────────────────────────────────────────────

describe('validateEnv', () => {
  beforeEach(() => {
    delete process.env.AUTH_SECRET;
    delete process.env.DATABASE_URL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    delete process.env.SENTRY_DSN;
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.TURSO_AUTH_TOKEN;
    delete process.env.CF_API_TOKEN;
    delete process.env.CF_ACCOUNT_ID;
    delete process.env.UPSTASH_REDIS_URL;
    delete process.env.UPSTASH_REDIS_TOKEN;
    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.TURNSTILE_SITE_KEY;
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    delete process.env.R2_BUCKET_ID;
    delete process.env.CF_R2_BUCKET_ID;
    delete process.env.CF_QUEUE_NAME;
    delete process.env.QUEUE_NAME;
    delete process.env.CF_DO_NAMESPACE;
    delete process.env.DURABLE_OBJECT_NAMESPACE;
  });

  it('returns empty for minimalSiteFeatures', () => {
    initFeatures(minimalSiteFeatures);
    expect(validateEnv()).toEqual([]);
  });

  it('returns missing vars for aiArchiveFeatures', () => {
    initFeatures(aiArchiveFeatures);
    const missing = validateEnv();
    expect(missing).toContain('AUTH_SECRET');
    expect(missing).toContain('DATABASE_URL');
    expect(missing).toContain('OPENAI_API_KEY or ANTHROPIC_API_KEY');
    expect(missing).toContain('OTEL_EXPORTER_OTLP_ENDPOINT');
    expect(missing).toContain('SENTRY_DSN');
    expect(missing).toContain('TURSO_DATABASE_URL');
    expect(missing).toContain('TURSO_AUTH_TOKEN');
    expect(missing).toContain('CF_API_TOKEN');
    expect(missing).toContain('CF_ACCOUNT_ID');
    expect(missing).toContain('UPSTASH_REDIS_URL');
    expect(missing).toContain('UPSTASH_REDIS_TOKEN');
    expect(missing).toContain('TURNSTILE_SECRET_KEY');
    expect(missing).toContain('TURNSTILE_SITE_KEY or NEXT_PUBLIC_TURNSTILE_SITE_KEY');
    expect(missing).toContain('R2_BUCKET_ID or CF_R2_BUCKET_ID');
    expect(missing).toContain('CF_QUEUE_NAME or QUEUE_NAME');
  });

  it('returns empty when all vars are set', () => {
    process.env.AUTH_SECRET = 'secret';
    process.env.DATABASE_URL = 'postgres://localhost';
    process.env.OPENAI_API_KEY = 'sk-...';
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'https://grafana.net/otlp';
    process.env.SENTRY_DSN = 'https://sentry.io/...';
    process.env.TURSO_DATABASE_URL = 'libsql://...';
    process.env.TURSO_AUTH_TOKEN = 'token';
    process.env.CF_API_TOKEN = 'cf-token';
    process.env.CF_ACCOUNT_ID = 'account-id';
    process.env.UPSTASH_REDIS_URL = 'https://redis.upstash.io';
    process.env.UPSTASH_REDIS_TOKEN = 'redis-token';
    process.env.TURNSTILE_SECRET_KEY = 'ts-secret';
    process.env.TURNSTILE_SITE_KEY = 'ts-site';
    process.env.R2_BUCKET_ID = 'bucket-id';
    process.env.CF_QUEUE_NAME = 'queue-name';
    initFeatures(aiArchiveFeatures);
    expect(validateEnv()).toEqual([]);
  });
});
