/**
 * @substrate/edge — Cloudflare Workers edge functions & Hono API.
 *
 * R2 for object storage, Queues for async processing,
 * Durable Objects for real-time collaboration/presence,
 * Hyperdrive for high-frequency Postgres access,
 * Turnstile for bot protection, Upstash Redis for rate limiting.
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createRedis, rateLimit, cacheGet, cacheSet } from './redis';
import { verifyTurnstile, type TurnstileConfig } from './turnstile';

// ── Bindings ─────────────────────────────────────────────────────────

export type Env = {
  DB: D1Database;
  R2: R2Bucket;
  QUEUE: Queue<QueueMessage>;
  DO: DurableObjectNamespace;
  HYPERDRIVE: Hyperdrive;
  REDIS: { get(key: string): Promise<string | null>; set(key: string, val: string, ttl?: number): Promise<void> };
  TURNSTILE_SECRET: string;
  UPSTASH_REDIS_URL: string;
  UPSTASH_REDIS_TOKEN: string;
};

export type QueueMessage = {
  type: 'experiment_result' | 'graph_snapshot' | 'content_reindex';
  payload: Record<string, unknown>;
};

// ── Router ───────────────────────────────────────────────────────────

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors());

app.get('/health', (c) => c.json({ status: 'ok', brand: 'Aevum' }));

// Lattice: graph data endpoint (cached in Redis)
app.get('/api/lattice/graph', async (c) => {
  const redis = createRedis({ url: c.env.UPSTASH_REDIS_URL, token: c.env.UPSTASH_REDIS_TOKEN });
  const key = 'graph:latest';
  const cached = await cacheGet(redis, key);
  if (cached) return c.json(cached);
  // TODO: fetch from Hyperdrive → Postgres
  const graph = { nodes: [], edges: [] };
  await cacheSet(redis, key, graph, 300); // 5 min TTL
  return c.json(graph);
});

// Crucible: submit experiment (rate-limited + Turnstile-protected)
app.post('/api/crucible/run', async (c) => {
  const redis = createRedis({ url: c.env.UPSTASH_REDIS_URL, token: c.env.UPSTASH_REDIS_TOKEN });

  // Rate limit: 10 requests per minute per IP.
  const ip = c.req.header('cf-connecting-ip') ?? 'unknown';
  const limit = await rateLimit(redis, `crucible:${ip}`, { limit: 10, window: 60 });
  if (!limit.success) {
    return c.json({ error: 'Rate limit exceeded' }, 429);
  }

  // Turnstile verification.
  const turnstileToken = c.req.header('cf-turnstile-response');
  if (turnstileToken) {
    const turnstileConfig: TurnstileConfig = { secretKey: c.env.TURNSTILE_SECRET };
    const result = await verifyTurnstile(turnstileToken, ip, turnstileConfig);
    if (!result.success) {
      return c.json({ error: 'Bot verification failed' }, 403);
    }
  }

  const body = await c.req.json();
  await c.env.QUEUE.send({ type: 'experiment_result', payload: body });
  return c.json({ status: 'queued' });
});

// Archive: content reindex trigger
app.post('/api/archive/reindex', async (c) => {
  await c.env.QUEUE.send({ type: 'content_reindex', payload: {} });
  return c.json({ status: 'queued' });
});

// Archive: full-text search (proxied to Hyperdrive Postgres)
app.post('/api/archive/search', async (c) => {
  const { query, limit = 10 } = await c.req.json();
  // In production: use ftsWeightedSearchSQL from @substrate/db
  // executed via Hyperdrive connection.
  return c.json({ results: [], query, limit });
});

export default app;
export { ExperimentDO } from './durable-objects';
export { createRedis, rateLimit, cacheGet, cacheSet, cacheInvalidate } from './redis';
export { verifyTurnstile, turnstileMiddleware } from './turnstile';
export type { RedisConfig, RateLimitConfig, RateLimitResult } from './redis';
export type { TurnstileConfig, TurnstileResult } from './turnstile';
