/**
 * @substrate-platform/edge — Cloudflare Workers edge infrastructure.
 *
 * Provides platform-level building blocks for edge deployment:
 *  - Hono app factory with CORS + rate limiting
 *  - R2 / Queues / Durable Objects / Hyperdrive / Workers AI bindings
 *  - Turnstile bot protection
 *  - Upstash Redis rate limiter + cache
 *  - Edge logger
 *
 * Application-specific routes (search, AI, queue consumers) are defined
 * by the application, not by the platform. See examples/ for reference.
 */

export type Env = {
  DB: D1Database;
  R2: R2Bucket;
  QUEUE: Queue<Record<string, unknown>>;
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

// ── Helpers ──────────────────────────────────────────────────────────

/** Create a drizzle client via Hyperdrive connection pooling. */
export async function createDb(hyperdrive: Hyperdrive) {
  const url = `postgresql://${hyperdrive.user}:${hyperdrive.password}@${hyperdrive.host}:${hyperdrive.port}/${hyperdrive.database}`;
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const postgres = (await import('postgres')).default;
  const client = postgres(url, { max: 1 });
  return { db: drizzle(client), client };
}

/** Parse the allowed CORS origins from the environment variable. */
export function getAllowedOrigins(env: Env): string[] {
  const raw = env.ALLOWED_ORIGINS ?? '';
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}

// ── Hono app factory ─────────────────────────────────────────────────

import { Hono } from 'hono';
import { cors } from 'hono/cors';

/**
 * Create a Hono app pre-configured with CORS (restricted to ALLOWED_ORIGINS)
 * and a `/health` endpoint. Applications add their own routes on top.
 */
export function createEdgeApp(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();

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

  return app;
}

// ── Re-exports ───────────────────────────────────────────────────────

export { ExperimentDO } from './durable-objects';
export { createEdgeLogger } from './logger';
export { cacheGet, cacheSet, createRedis, rateLimit } from './redis';
export { type TurnstileConfig, verifyTurnstile } from './turnstile';
