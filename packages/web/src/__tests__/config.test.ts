/**
 * Unit tests for the @substrate/config feature manifest.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  featureManifestSchema,
  minimalSiteFeatures,
  graphicsLabFeatures,
  aiArchiveFeatures,
  realtimeRoomFeatures,
  fullPlatformFeatures,
  initFeatures,
  features,
  isEnabled,
  validateEnv,
} from '@substrate/config/features';

describe('featureManifestSchema', () => {
  it('parses a valid manifest with defaults', () => {
    const result = featureManifestSchema.parse({ auth: true });
    expect(result.auth).toBe(true);
    expect(result.analytics).toBe(true); // default
    expect(result.ai).toBe(false); // default
  });

  it('rejects invalid values', () => {
    expect(() => featureManifestSchema.parse({ webgpu: 'invalid' })).toThrow();
    expect(() => featureManifestSchema.parse({ search: 'nonexistent' })).toThrow();
  });
});

describe('preset profiles', () => {
  it('minimalSiteFeatures has no backend', () => {
    expect(minimalSiteFeatures.auth).toBe(false);
    expect(minimalSiteFeatures.ai).toBe(false);
    expect(minimalSiteFeatures.graphics).toBe(false);
    expect(minimalSiteFeatures.webgpu).toBe('off');
    expect(minimalSiteFeatures.search).toBe('orama');
  });

  it('graphicsLabFeatures has graphics + wasm', () => {
    expect(graphicsLabFeatures.graphics).toBe(true);
    expect(graphicsLabFeatures.wasm).toBe(true);
    expect(graphicsLabFeatures.webgpu).toBe('progressive');
    expect(graphicsLabFeatures.ai).toBe(false);
  });

  it('aiArchiveFeatures has full backend stack', () => {
    expect(aiArchiveFeatures.ai).toBe(true);
    expect(aiArchiveFeatures.search).toBe('hybrid');
    expect(aiArchiveFeatures.auth).toBe(true);
    expect(aiArchiveFeatures.edge).toBe(true);
    expect(aiArchiveFeatures.queue).toBe(true);
  });

  it('realtimeRoomFeatures has realtime + edge', () => {
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

describe('runtime accessor', () => {
  beforeEach(() => {
    initFeatures(minimalSiteFeatures);
  });

  it('returns the initialised manifest', () => {
    expect(features().auth).toBe(false);
    expect(features().search).toBe('orama');
  });

  it('isEnabled returns correct boolean', () => {
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

describe('validateEnv', () => {
  beforeEach(() => {
    // Clear env vars.
    delete process.env.BETTER_AUTH_SECRET;
    delete process.env.DATABASE_URL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.TURSO_AUTH_TOKEN;
  });

  it('returns empty for minimalSiteFeatures (no backend)', () => {
    initFeatures(minimalSiteFeatures);
    expect(validateEnv()).toEqual([]);
  });

  it('returns missing vars for aiArchiveFeatures', () => {
    initFeatures(aiArchiveFeatures);
    const missing = validateEnv();
    expect(missing).toContain('BETTER_AUTH_SECRET');
    expect(missing).toContain('DATABASE_URL');
    expect(missing).toContain('OPENAI_API_KEY or ANTHROPIC_API_KEY');
    expect(missing).toContain('OTEL_EXPORTER_OTLP_ENDPOINT');
    expect(missing).toContain('TURSO_DATABASE_URL');
    expect(missing).toContain('TURSO_AUTH_TOKEN');
  });

  it('returns empty when all vars are set', () => {
    process.env.BETTER_AUTH_SECRET = 'secret';
    process.env.DATABASE_URL = 'postgres://localhost';
    process.env.OPENAI_API_KEY = 'sk-...';
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'https://grafana.net/otlp';
    process.env.TURSO_DATABASE_URL = 'libsql://...';
    process.env.TURSO_AUTH_TOKEN = 'token';
    initFeatures(aiArchiveFeatures);
    expect(validateEnv()).toEqual([]);
  });
});
