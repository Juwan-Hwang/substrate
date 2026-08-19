/**
 * Unit tests for @substrate/edge — Zod input schemas, Turnstile verification,
 * and the Redis rate-limiter. No real Redis or Cloudflare connections are
 * made; fetch and the Redis client are mocked.
 */
import type { Redis } from '@upstash/redis';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Durable Object module so that importing `../index` does not pull in
// the Cloudflare-only `cloudflare:workers` package at test time.
vi.mock('../durable-objects', () => ({
  ExperimentDO: class MockExperimentDO {},
}));

import {
  embedInputSchema,
  experimentInputSchema,
  searchInputSchema,
  summarizeInputSchema,
} from '../index';
import { type RateLimitResult, rateLimit } from '../redis';
import { verifyTurnstile } from '../turnstile';

// ── experimentInputSchema ────────────────────────────────────────────

describe('experimentInputSchema', () => {
  it('validates a correct experiment input', () => {
    const result = experimentInputSchema.safeParse({
      name: 'Particle Sim',
      subsystem: 'lattice',
      parameters: { iterations: '500', dt: '0.1' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Particle Sim');
      expect(result.data.subsystem).toBe('lattice');
    }
  });

  it('defaults parameters to an empty object when omitted', () => {
    const result = experimentInputSchema.safeParse({ name: 'Test', subsystem: 'crucible' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parameters).toEqual({});
    }
  });

  it('accepts any non-empty string as subsystem', () => {
    const result = experimentInputSchema.safeParse({
      name: 'Test',
      subsystem: 'custom',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty name', () => {
    const result = experimentInputSchema.safeParse({ name: '', subsystem: 'lattice' });
    expect(result.success).toBe(false);
  });

  it('rejects a name longer than 120 characters', () => {
    const result = experimentInputSchema.safeParse({
      name: 'x'.repeat(121),
      subsystem: 'lattice',
    });
    expect(result.success).toBe(false);
  });
});

// ── searchInputSchema ────────────────────────────────────────────────

describe('searchInputSchema', () => {
  it('validates a correct search input', () => {
    const result = searchInputSchema.safeParse({ query: 'webgpu graph layout' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(10); // default
    }
  });

  it('accepts a custom limit within bounds', () => {
    const result = searchInputSchema.safeParse({ query: 'test', limit: 50 });
    expect(result.success).toBe(true);
  });

  it('rejects an empty query', () => {
    const result = searchInputSchema.safeParse({ query: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a query exceeding 200 characters', () => {
    const result = searchInputSchema.safeParse({ query: 'x'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('rejects a limit above 50', () => {
    const result = searchInputSchema.safeParse({ query: 'test', limit: 51 });
    expect(result.success).toBe(false);
  });

  it('rejects a limit below 1', () => {
    const result = searchInputSchema.safeParse({ query: 'test', limit: 0 });
    expect(result.success).toBe(false);
  });
});

// ── embedInputSchema ─────────────────────────────────────────────────

describe('embedInputSchema', () => {
  it('validates correct input and applies the default model', () => {
    const result = embedInputSchema.safeParse({ text: 'hello world' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.model).toBe('@cf/baai/bge-base-en-v1.5');
    }
  });

  it('accepts a custom model', () => {
    const result = embedInputSchema.safeParse({ text: 'hello', model: '@cf/custom-model' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.model).toBe('@cf/custom-model');
    }
  });

  it('rejects empty text', () => {
    const result = embedInputSchema.safeParse({ text: '' });
    expect(result.success).toBe(false);
  });

  it('rejects text exceeding 10000 characters', () => {
    const result = embedInputSchema.safeParse({ text: 'x'.repeat(10001) });
    expect(result.success).toBe(false);
  });
});

// ── summarizeInputSchema ─────────────────────────────────────────────

describe('summarizeInputSchema', () => {
  it('validates correct input and applies the default model', () => {
    const result = summarizeInputSchema.safeParse({ text: 'A long article body.' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.model).toBe('@cf/meta/llama-3.1-8b-instruct');
    }
  });

  it('accepts a custom model', () => {
    const result = summarizeInputSchema.safeParse({ text: 'hello', model: '@cf/other-model' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.model).toBe('@cf/other-model');
    }
  });

  it('rejects empty text', () => {
    const result = summarizeInputSchema.safeParse({ text: '' });
    expect(result.success).toBe(false);
  });

  it('rejects text exceeding 50000 characters', () => {
    const result = summarizeInputSchema.safeParse({ text: 'x'.repeat(50001) });
    expect(result.success).toBe(false);
  });
});

// ── verifyTurnstile ──────────────────────────────────────────────────

describe('verifyTurnstile', () => {
  beforeEach(() => {
    // Silence the expected console output from the fail-closed/open branches.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns success:false when no config is provided in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const result = await verifyTurnstile('some-token');
    expect(result.success).toBe(false);
    expect(result.errorCodes).toContain('missing-secret');
  });

  it('returns success:true when no config is provided in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const result = await verifyTurnstile('some-token');
    expect(result.success).toBe(true);
  });

  it('returns success:true when no config is provided and NODE_ENV is unset', async () => {
    vi.stubEnv('NODE_ENV', '');
    const result = await verifyTurnstile('some-token');
    expect(result.success).toBe(true);
  });

  it('verifies a token against the Cloudflare siteverify endpoint', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const mockFetch = vi.fn().mockResolvedValue({
      json: async () => ({
        success: true,
        'error-codes': [],
        challenge_ts: '2024-01-01T00:00:00.000Z',
        hostname: 'example.com',
        action: 'submit',
        cdata: 'abc',
      }),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    const result = await verifyTurnstile('tok', '1.2.3.4', { secretKey: 'secret' });

    expect(result.success).toBe(true);
    expect(result.hostname).toBe('example.com');
    expect(result.challengeTs).toBe('2024-01-01T00:00:00.000Z');
    expect(result.action).toBe('submit');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({ method: 'POST' }),
    );
    // The POST body must carry the secret + token (+ remoteip).
    const call = mockFetch.mock.calls[0]?.[1] as { body: URLSearchParams };
    expect(call.body.get('secret')).toBe('secret');
    expect(call.body.get('response')).toBe('tok');
    expect(call.body.get('remoteip')).toBe('1.2.3.4');
  });

  it('returns success:false when the siteverify API rejects the token', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const mockFetch = vi.fn().mockResolvedValue({
      json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    const result = await verifyTurnstile('bad-tok', undefined, { secretKey: 'secret' });
    expect(result.success).toBe(false);
    expect(result.errorCodes).toEqual(['invalid-input-response']);
  });

  it('omits remoteip from the body when not provided', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const mockFetch = vi.fn().mockResolvedValue({
      json: async () => ({ success: true }),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    await verifyTurnstile('tok', undefined, { secretKey: 'secret' });
    const call = mockFetch.mock.calls[0]?.[1] as { body: URLSearchParams };
    expect(call.body.has('remoteip')).toBe(false);
  });
});

// ── rateLimit ────────────────────────────────────────────────────────

/**
 * Build a minimal Redis mock whose pipeline reports a given member count.
 * `rateLimit` reads `results[2]` (the zcard result) as the current count.
 */
function createMockRedis(count: number): Redis {
  const mockPipeline = {
    zremrangebyscore: vi.fn().mockReturnThis(),
    zadd: vi.fn().mockReturnThis(),
    zcard: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([0, 1, count, true]),
  };
  return { pipeline: vi.fn().mockReturnValue(mockPipeline) } as unknown as Redis;
}

describe('rateLimit', () => {
  it('returns the expected result shape (success, limit, remaining, reset)', async () => {
    const result: RateLimitResult = await rateLimit(createMockRedis(3), 'user:1', {
      limit: 10,
      window: 60,
    });

    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('limit');
    expect(result).toHaveProperty('remaining');
    expect(result).toHaveProperty('reset');
    expect(typeof result.success).toBe('boolean');
    expect(typeof result.limit).toBe('number');
    expect(typeof result.remaining).toBe('number');
    expect(typeof result.reset).toBe('number');
  });

  it('reports success when the count is within the limit', async () => {
    const result = await rateLimit(createMockRedis(5), 'user:1', { limit: 10, window: 60 });
    expect(result.success).toBe(true);
    expect(result.limit).toBe(10);
    expect(result.remaining).toBe(5);
  });

  it('reports failure when the count exceeds the limit', async () => {
    const result = await rateLimit(createMockRedis(15), 'user:1', { limit: 10, window: 60 });
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('computes reset as now + window (ms)', async () => {
    const windowSeconds = 120;
    const before = Date.now();
    const result = await rateLimit(createMockRedis(1), 'user:1', {
      limit: 10,
      window: windowSeconds,
    });
    const after = Date.now();
    expect(result.reset).toBeGreaterThanOrEqual(before + windowSeconds * 1000);
    expect(result.reset).toBeLessThanOrEqual(after + windowSeconds * 1000);
  });

  it('does not return a negative remaining count', async () => {
    const result = await rateLimit(createMockRedis(100), 'user:1', { limit: 10, window: 60 });
    expect(result.remaining).toBe(0);
  });

  it('issues the expected sorted-set pipeline commands', async () => {
    const mockPipeline = {
      zremrangebyscore: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([0, 1, 2, true]),
    };
    const redis = { pipeline: vi.fn().mockReturnValue(mockPipeline) } as unknown as Redis;

    await rateLimit(redis, 'user:abc', { limit: 10, window: 60 });

    expect(redis.pipeline).toHaveBeenCalledTimes(1);
    expect(mockPipeline.zremrangebyscore).toHaveBeenCalledTimes(1);
    expect(mockPipeline.zadd).toHaveBeenCalledTimes(1);
    expect(mockPipeline.zcard).toHaveBeenCalledTimes(1);
    expect(mockPipeline.expire).toHaveBeenCalledTimes(1);
    expect(mockPipeline.exec).toHaveBeenCalledTimes(1);
  });
});
