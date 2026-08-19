/**
 * Upstash Redis — rate limiting, caching, and session storage.
 *
 * Uses Upstash REST API (works in Cloudflare Workers without TCP sockets).
 * Provides sliding-window rate limiting and TTL-based caching.
 */
import { Redis } from '@upstash/redis';

export type RedisConfig = {
  url: string;
  token: string;
};

export type RateLimitConfig = {
  /** Max requests in the window. */
  limit: number;
  /** Window size in seconds. */
  window: number;
};

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

export function createRedis(config: RedisConfig): Redis {
  return new Redis({ url: config.url, token: config.token });
}

/**
 * Sliding-window rate limiter using Redis sorted sets.
 *
 * Each request adds a member to a sorted set with the current timestamp as score.
 * Old entries outside the window are removed, then the set is counted.
 */
export async function rateLimit(
  redis: Redis,
  identifier: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const key = `ratelimit:${identifier}`;
  const now = Date.now();
  const windowStart = now - config.window * 1000;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(key, 0, windowStart);
  pipeline.zadd(key, { score: now, member: now.toString() });
  pipeline.zcard(key);
  pipeline.expire(key, config.window);
  const results = await pipeline.exec();

  const count = results[2] as number;
  const success = count <= config.limit;

  return {
    success,
    limit: config.limit,
    remaining: Math.max(0, config.limit - count),
    reset: now + config.window * 1000,
  };
}

/** Cache wrapper with TTL. */
export async function cacheGet<T>(redis: Redis, key: string): Promise<T | null> {
  const val = await redis.get<T>(key);
  return val;
}

export async function cacheSet<T>(redis: Redis, key: string, value: T, ttl: number): Promise<void> {
  await redis.set(key, value, { ex: ttl });
}

export async function cacheInvalidate(redis: Redis, key: string): Promise<void> {
  await redis.del(key);
}
