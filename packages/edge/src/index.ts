/**
 * @substrate/edge — Cloudflare Workers edge functions & Hono API.
 *
 * R2 for object storage, Queues for async processing,
 * Durable Objects for real-time collaboration/presence,
 * Hyperdrive for high-frequency Postgres access,
 * Turnstile for bot protection, Upstash Redis for rate limiting,
 * Workers AI for edge inference.
 *
 * Security:
 *  - CORS restricted to configured origins (not wildcard).
 *  - All POST routes rate-limited per IP.
 *  - All inputs validated with Zod before processing.
 *  - Turnstile required (fail-closed in production).
 */

import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { createEdgeLogger } from './logger';
import { cacheGet, cacheSet, createRedis, rateLimit } from './redis';
import { type TurnstileConfig, verifyTurnstile } from './turnstile';

const logger = createEdgeLogger('queue');

// ── Bindings ─────────────────────────────────────────────────────────

export type Env = {
  DB: D1Database;
  R2: R2Bucket;
  QUEUE: Queue<QueueMessage>;
  DO: DurableObjectNamespace;
  HYPERDRIVE: Hyperdrive;
  AI: Ai;
  REDIS: {
    get(key: string): Promise<string | null>;
    set(key: string, val: string, ttl?: number): Promise<void>;
  };
  TURNSTILE_SECRET: string;
  UPSTASH_REDIS_URL: string;
  UPSTASH_REDIS_TOKEN: string;
  ALLOWED_ORIGINS: string;
};

export type QueueMessage = {
  type: 'experiment_result' | 'graph_snapshot' | 'content_reindex';
  payload: Record<string, unknown>;
};

// ── Input schemas ────────────────────────────────────────────────────

export const experimentInputSchema = z.object({
  name: z.string().min(1).max(120),
  subsystem: z.string().min(1).max(60),
  parameters: z.record(z.string(), z.string()).default({}),
});

export const searchInputSchema = z.object({
  query: z.string().min(1).max(200),
  limit: z.number().int().min(1).max(50).default(10),
});

export const embedInputSchema = z.object({
  text: z.string().min(1).max(10000),
  model: z.string().max(100).default('@cf/baai/bge-base-en-v1.5'),
});

export const summarizeInputSchema = z.object({
  text: z.string().min(1).max(50000),
  model: z.string().max(100).default('@cf/meta/llama-3.1-8b-instruct'),
});

const queuePayloadSchema = z.object({
  name: z.string().min(1).max(120),
  subsystem: z.string().min(1).max(60),
  parameters: z.record(z.unknown()).default({}),
  result: z.unknown().optional(),
  durationMs: z.number().int().positive().optional(),
});

// ── Helpers ──────────────────────────────────────────────────────────

/** Create a drizzle client via Hyperdrive connection pooling. */
async function createDb(hyperdrive: Hyperdrive) {
  const url = `postgresql://${hyperdrive.user}:${hyperdrive.password}@${hyperdrive.host}:${hyperdrive.port}/${hyperdrive.database}`;
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const postgres = (await import('postgres')).default;
  const client = postgres(url, { max: 1 });
  return { db: drizzle(client), client };
}

/** Parse the allowed CORS origins from the environment variable. */
function getAllowedOrigins(env: Env): string[] {
  const raw = env.ALLOWED_ORIGINS ?? '';
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}

// ── Router ───────────────────────────────────────────────────────────

const app = new Hono<{ Bindings: Env }>();

// CORS — restricted to configured origins, not wildcard.
app.use(
  '*',
  cors({
    origin: (origin, c) => {
      const allowed = getAllowedOrigins(c.env as Env);
      const origins = allowed.length > 0 ? allowed : ['http://localhost:3000'];
      return origins.includes(origin) ? origin : null;
    },
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'cf-turnstile-response'],
    credentials: true,
    maxAge: 86400,
  }),
);

app.get('/health', (c) => c.json({ status: 'ok' }));

// Graph data endpoint (cached in Redis, fetched via Hyperdrive → Postgres)
app.get('/api/lattice/graph', async (c) => {
  const redis = createRedis({ url: c.env.UPSTASH_REDIS_URL, token: c.env.UPSTASH_REDIS_TOKEN });
  const key = 'graph:latest';
  const cached = await cacheGet(redis, key);
  if (cached) return c.json(cached);

  // Fetch from PostgreSQL via Hyperdrive connection pooling.
  const { db, client } = await createDb(c.env.HYPERDRIVE);

  const rows = await db.execute(
    sql`SELECT snapshot FROM graph_snapshots ORDER BY created_at DESC LIMIT 1`,
  );
  await client.end();

  const graph =
    rows.length > 0 ? (rows[0] as { snapshot: unknown }).snapshot : { nodes: [], edges: [] };

  await cacheSet(redis, key, graph, 300);
  return c.json(graph);
});

// Experiment submission (rate-limited + Turnstile-protected)
app.post('/api/crucible/run', async (c) => {
  const redis = createRedis({ url: c.env.UPSTASH_REDIS_URL, token: c.env.UPSTASH_REDIS_TOKEN });

  // Rate limit: 10 requests per minute per IP.
  const ip = c.req.header('cf-connecting-ip') ?? 'unknown';
  const limit = await rateLimit(redis, `crucible:${ip}`, { limit: 10, window: 60 });
  if (!limit.success) {
    return c.json({ error: 'Rate limit exceeded' }, 429);
  }

  // Turnstile verification (required, fail-closed in production).
  const turnstileToken = c.req.header('cf-turnstile-response');
  if (!turnstileToken) {
    return c.json({ error: 'Missing Turnstile token' }, 403);
  }
  const turnstileConfig: TurnstileConfig = { secretKey: c.env.TURNSTILE_SECRET };
  const result = await verifyTurnstile(turnstileToken, ip, turnstileConfig);
  if (!result.success) {
    return c.json({ error: 'Bot verification failed' }, 403);
  }

  // Validate input with Zod.
  const raw = await c.req.json();
  const parsed = experimentInputSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.issues }, 400);
  }

  await c.env.QUEUE.send({ type: 'experiment_result', payload: parsed.data });
  return c.json({ status: 'queued' });
});

// Content reindex trigger
app.post('/api/archive/reindex', async (c) => {
  const redis = createRedis({ url: c.env.UPSTASH_REDIS_URL, token: c.env.UPSTASH_REDIS_TOKEN });

  // Rate limit: 3 requests per minute per IP (reindex is expensive).
  const ip = c.req.header('cf-connecting-ip') ?? 'unknown';
  const limit = await rateLimit(redis, `reindex:${ip}`, { limit: 3, window: 60 });
  if (!limit.success) {
    return c.json({ error: 'Rate limit exceeded' }, 429);
  }

  await c.env.QUEUE.send({ type: 'content_reindex', payload: {} });
  return c.json({ status: 'queued' });
});

// Full-text search (via Hyperdrive → PostgreSQL FTS)
app.post('/api/archive/search', async (c) => {
  const redis = createRedis({ url: c.env.UPSTASH_REDIS_URL, token: c.env.UPSTASH_REDIS_TOKEN });

  // Rate limit: 30 requests per minute per IP.
  const ip = c.req.header('cf-connecting-ip') ?? 'unknown';
  const limit = await rateLimit(redis, `search:${ip}`, { limit: 30, window: 60 });
  if (!limit.success) {
    return c.json({ error: 'Rate limit exceeded' }, 429);
  }

  const raw = await c.req.json();
  const parsed = searchInputSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.issues }, 400);
  }

  const { query: searchQuery, limit: searchLimit } = parsed.data;

  const { db, client } = await createDb(c.env.HYPERDRIVE);

  const rows = await db.execute(
    sql`SELECT id, slug, title, excerpt,
               ts_rank_cd(
                 setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                 setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
                 setweight(to_tsvector('english', coalesce(body, '')), 'C'),
                 plainto_tsquery('english', ${searchQuery})
               ) AS rank
        FROM articles
        WHERE status = 'published'
          AND (
            setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
            setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
            setweight(to_tsvector('english', coalesce(body, '')), 'C')
          ) @@ plainto_tsquery('english', ${searchQuery})
        ORDER BY rank DESC
        LIMIT ${searchLimit}`,
  );
  await client.end();

  return c.json({ results: rows, query: searchQuery, limit: searchLimit });
});

// Workers AI: edge inference — text embeddings for semantic search.
// Generates 1536-dim embeddings via Cloudflare Workers AI, compatible
// with pgvector columns in the articles table.
app.post('/api/ai/embed', async (c) => {
  const redis = createRedis({ url: c.env.UPSTASH_REDIS_URL, token: c.env.UPSTASH_REDIS_TOKEN });

  // Rate limit: 5 requests per minute per IP (AI endpoints are costly).
  const ip = c.req.header('cf-connecting-ip') ?? 'unknown';
  const limit = await rateLimit(redis, `ai-embed:${ip}`, { limit: 5, window: 60 });
  if (!limit.success) {
    return c.json({ error: 'Rate limit exceeded' }, 429);
  }

  const raw = await c.req.json();
  const parsed = embedInputSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.issues }, 400);
  }

  const { text, model } = parsed.data;

  const result = (await c.env.AI.run(model as '@cf/baai/bge-base-en-v1.5', { text: [text] })) as {
    data?: number[][];
  };
  return c.json({ embedding: result.data?.[0] ?? [], model });
});

// Workers AI: edge inference — text summarisation for article excerpts.
app.post('/api/ai/summarize', async (c) => {
  const redis = createRedis({ url: c.env.UPSTASH_REDIS_URL, token: c.env.UPSTASH_REDIS_TOKEN });

  // Rate limit: 5 requests per minute per IP (AI endpoints are costly).
  const ip = c.req.header('cf-connecting-ip') ?? 'unknown';
  const limit = await rateLimit(redis, `ai-summarize:${ip}`, { limit: 5, window: 60 });
  if (!limit.success) {
    return c.json({ error: 'Rate limit exceeded' }, 429);
  }

  const raw = await c.req.json();
  const parsed = summarizeInputSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.issues }, 400);
  }

  const { text, model } = parsed.data;

  const result = (await c.env.AI.run(model as '@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      { role: 'system', content: 'Summarise the following text in 1-2 sentences.' },
      { role: 'user', content: text },
    ],
  })) as { response?: string };
  return c.json({ summary: result.response ?? '', model });
});

// ── Queue consumer ──────────────────────────────────────────────────
//
// Processes async tasks dispatched via `c.env.QUEUE.send()`:
//  - experiment_result: persist experiment results to PostgreSQL
//  - graph_snapshot: cache latest graph snapshot in Redis
//  - content_reindex: regenerate embeddings + FTS index for articles

async function handleQueue(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
  for (const message of batch.messages) {
    const { type, payload } = message.body;

    try {
      switch (type) {
        case 'experiment_result': {
          // Validate payload before persisting.
          const parsed = queuePayloadSchema.safeParse(payload);
          if (!parsed.success) {
            logger.error('experiment_result: invalid payload', { issues: parsed.error.issues });
            message.ack();
            break;
          }

          const { db, client } = await createDb(env.HYPERDRIVE);

          await db.execute(
            sql`INSERT INTO experiments (name, subsystem, parameters, result, duration_ms)
                VALUES (${parsed.data.name},
                        ${parsed.data.subsystem},
                        ${JSON.stringify(parsed.data.parameters)},
                        ${JSON.stringify(parsed.data.result ?? null)},
                        ${parsed.data.durationMs ?? null})`,
          );
          await client.end();
          break;
        }

        case 'graph_snapshot': {
          // Cache the latest graph snapshot in Redis for fast edge reads.
          const redis = createRedis({ url: env.UPSTASH_REDIS_URL, token: env.UPSTASH_REDIS_TOKEN });
          await cacheSet(redis, 'graph:latest', payload, 300);
          break;
        }

        case 'content_reindex': {
          // Regenerate embeddings via Workers AI and update pgvector.
          const articleId = (payload as { articleId?: string }).articleId;
          if (!articleId || typeof articleId !== 'string') {
            logger.error('content_reindex: missing or invalid articleId');
            message.ack();
            break;
          }

          // Fetch article text from PostgreSQL.
          const { db, client } = await createDb(env.HYPERDRIVE);

          const rows = await db.execute(sql`SELECT body FROM articles WHERE id = ${articleId}`);
          const body = rows.length > 0 ? (rows[0] as { body: string }).body : '';

          if (body) {
            // Generate embedding via Workers AI.
            const aiResult = (await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [body] })) as {
              data?: number[][];
            };
            const embedding = aiResult.data?.[0];
            if (embedding && embedding.length > 0) {
              const vecStr = `[${embedding.join(',')}]`;
              await db.execute(
                sql`UPDATE articles SET embedding = ${vecStr}::vector WHERE id = ${articleId}`,
              );
            }
          }

          await client.end();
          break;
        }
      }

      message.ack();
    } catch (err) {
      logger.error(`${type} failed`, { error: err });
      message.retry({ delaySeconds: 30 });
    }
  }
}

export default {
  fetch: app.fetch,
  queue: handleQueue,
};
export { ExperimentDO } from './durable-objects';
export type { RateLimitConfig, RateLimitResult, RedisConfig } from './redis';
export { cacheGet, cacheInvalidate, cacheSet, createRedis, rateLimit } from './redis';
export type { TurnstileConfig, TurnstileResult } from './turnstile';
export { turnstileMiddleware, verifyTurnstile } from './turnstile';
