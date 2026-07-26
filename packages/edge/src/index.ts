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

// ── Bindings ─────────────────────────────────────────────────────────

export type Env = {
  DB: D1Database;
  R2: R2Bucket;
  QUEUE: Queue<QueueMessage>;
  DO: DurableObjectNamespace;
  HYPERDRIVE: Hyperdrive;
  REDIS: { get(key: string): Promise<string | null>; set(key: string, val: string, ttl?: number): Promise<void> };
  TURNSTILE_SECRET: string;
};

export type QueueMessage = {
  type: 'experiment_result' | 'graph_snapshot' | 'content_reindex';
  payload: Record<string, unknown>;
};

// ── Router ───────────────────────────────────────────────────────────

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors());

app.get('/health', (c) => c.json({ status: 'ok', brand: 'Aevum' }));

// Lattice: graph data endpoint
app.get('/api/lattice/graph', async (c) => {
  const key = 'graph:latest';
  const cached = await c.env.REDIS.get(key);
  if (cached) return c.json(JSON.parse(cached));
  // TODO: fetch from Hyperdrive → Postgres
  return c.json({ nodes: [], edges: [] });
});

// Crucible: submit experiment
app.post('/api/crucible/run', async (c) => {
  const body = await c.req.json();
  await c.env.QUEUE.send({ type: 'experiment_result', payload: body });
  return c.json({ status: 'queued' });
});

// Archive: content reindex trigger
app.post('/api/archive/reindex', async (c) => {
  await c.env.QUEUE.send({ type: 'content_reindex', payload: {} });
  return c.json({ status: 'queued' });
});

export default app;
export { ExperimentDO } from './durable-objects';
