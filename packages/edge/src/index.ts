/**
 * @substrate/edge — Cloudflare Workers edge functions & Hono API.
 *
 * R2 for object storage, Queues for async processing,
 * Durable Objects for real-time collaboration/presence,
 * Hyperdrive for high-frequency Postgres access,
 * Turnstile for bot protection, Upstash Redis for rate limiting,
 * Workers AI for edge inference.
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
  AI: Ai;
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

// Lattice: graph data endpoint (cached in Redis, fetched via Hyperdrive → Postgres)
app.get('/api/lattice/graph', async (c) => {
  const redis = createRedis({ url: c.env.UPSTASH_REDIS_URL, token: c.env.UPSTASH_REDIS_TOKEN });
  const key = 'graph:latest';
  const cached = await cacheGet(redis, key);
  if (cached) return c.json(cached);

  // Fetch from PostgreSQL via Hyperdrive connection pooling.
  const hyperdriveUrl = `postgresql://${c.env.HYPERDRIVE.user}:${c.env.HYPERDRIVE.password}@${c.env.HYPERDRIVE.host}:${c.env.HYPERDRIVE.port}/${c.env.HYPERDRIVE.database}`;
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const postgres = (await import('postgres')).default;
  const client = postgres(hyperdriveUrl, { max: 1 });
  const db = drizzle(client);

  const graphSnapshots = await db.execute(
    'SELECT snapshot FROM graph_snapshots WHERE subsystem = $1 ORDER BY created_at DESC LIMIT 1',
    ['lattice'],
  );
  await client.end();

  const graph = graphSnapshots.rows.length > 0
    ? (graphSnapshots.rows[0] as { snapshot: unknown }).snapshot
    : { nodes: [], edges: [] };

  await cacheSet(redis, key, graph, 300);
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

// Archive: full-text search (via Hyperdrive → PostgreSQL FTS)
app.post('/api/archive/search', async (c) => {
  const { query, limit = 10 } = await c.req.json();

  const hyperdriveUrl = `postgresql://${c.env.HYPERDRIVE.user}:${c.env.HYPERDRIVE.password}@${c.env.HYPERDRIVE.host}:${c.env.HYPERDRIVE.port}/${c.env.HYPERDRIVE.database}`;
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const postgres = (await import('postgres')).default;
  const client = postgres(hyperdriveUrl, { max: 1 });
  const db = drizzle(client);

  const results = await db.execute(
    `SELECT id, slug, title, excerpt,
            ts_rank_cd(
              setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
              setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
              setweight(to_tsvector('english', coalesce(body, '')), 'C'),
              plainto_tsquery('english', $1)
            ) AS rank
     FROM articles
     WHERE status = 'published'
       AND (
         setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
         setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
         setweight(to_tsvector('english', coalesce(body, '')), 'C')
       ) @@ plainto_tsquery('english', $1)
     ORDER BY rank DESC
     LIMIT $2`,
    [query, limit],
  );
  await client.end();

  return c.json({ results: results.rows, query, limit });
});

// Workers AI: edge inference — text embeddings for semantic search.
// Generates 1536-dim embeddings via Cloudflare Workers AI, compatible
// with pgvector columns in the articles table.
app.post('/api/ai/embed', async (c) => {
  const { text, model = '@cf/baai/bge-base-en-v1.5' } = await c.req.json();

  if (!text || typeof text !== 'string') {
    return c.json({ error: 'Missing "text" field' }, 400);
  }

  const result = await c.env.AI.run(model, { text: [text] });
  return c.json({ embedding: result.data?.[0] ?? [], model });
});

// Workers AI: edge inference — text summarisation for Archive excerpts.
app.post('/api/ai/summarize', async (c) => {
  const { text, model = '@cf/meta/llama-3.1-8b-instruct' } = await c.req.json();

  if (!text || typeof text !== 'string') {
    return c.json({ error: 'Missing "text" field' }, 400);
  }

  const result = await c.env.AI.run(model, {
    messages: [
      { role: 'system', content: 'Summarise the following text in 1-2 sentences.' },
      { role: 'user', content: text },
    ],
  });
  return c.json({ summary: result.response ?? '', model });
});

export default app;
export { ExperimentDO } from './durable-objects';
export { createRedis, rateLimit, cacheGet, cacheSet, cacheInvalidate } from './redis';
export { verifyTurnstile, turnstileMiddleware } from './turnstile';
export type { RedisConfig, RateLimitConfig, RateLimitResult } from './redis';
export type { TurnstileConfig, TurnstileResult } from './turnstile';
