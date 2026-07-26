/**
 * Turso / libSQL — edge database adapter.
 *
 * Turso provides globally distributed SQLite via libSQL, perfect for
 * Cloudflare Workers edge deployment. Use as a read replica or
 * standalone edge database when Postgres (Hyperdrive) latency is too high.
 *
 * Drizzle ORM supports libSQL natively — the same schema definitions
 * work across PostgreSQL (primary) and Turso (edge replica).
 */
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';

export type TursoConfig = {
  url: string;
  authToken: string;
};

export function createTursoDb(config: TursoConfig) {
  const client = createClient({
    url: config.url,
    authToken: config.authToken,
  });
  return drizzle(client);
}

/**
 * Create a Turso client for raw SQL queries (when Drizzle ORM is not needed).
 * Useful for edge-side full-text search (SQLite FTS5) and simple lookups.
 */
export function createTursoClient(config: TursoConfig) {
  return createClient({
    url: config.url,
    authToken: config.authToken,
  });
}
