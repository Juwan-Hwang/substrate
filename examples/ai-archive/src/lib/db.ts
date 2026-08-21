/**
 * Server-only PostgreSQL access for the AI Archive example.
 *
 * Two layers are exposed:
 *  - {@link postgresFtsSearch} — runs the raw `$N`-parameterised SQL
 *    produced by `ftsWeightedSearchSQL` through a postgres-js client.
 *  - {@link drizzleDb} — the typed Drizzle instance (from `createDb`)
 *    used for article inserts on the ingest path.
 *
 * The raw client is required because `ftsWeightedSearchSQL` returns a
 * SQL string with `$1, $2, …` placeholders, which Drizzle's `execute`
 * cannot bind. `postgres`'s `unsafe()` is the correct escape hatch.
 *
 * Clients are memoised per-process; in serverless they live for one warm
 * invocation, which is the intended behaviour.
 */

import { createDb } from '@substrate-platform/db';
import postgres from 'postgres';
import { databaseUrl } from './env';
import { ftsWeightedSearchSQL } from './fts';
import type { SearchResult } from './types';

type PgClient = ReturnType<typeof postgres>;
type DrizzleDb = ReturnType<typeof createDb>;

let _client: PgClient | null = null;
let _drizzle: DrizzleDb | null = null;

function requireUrl(): string {
  const url = databaseUrl();
  if (!url) throw new Error('DATABASE_URL is not configured');
  return url;
}

/** The memoised raw postgres-js client. */
function client(): PgClient {
  if (!_client) _client = postgres(requireUrl(), { max: 10 });
  return _client;
}

/** The memoised Drizzle instance (typed article operations). */
export function drizzleDb(): DrizzleDb {
  if (!_drizzle) _drizzle = createDb({ url: requireUrl(), maxConnections: 10 });
  return _drizzle;
}

/** Run a raw parameterised SQL string (`$1, $2, …` placeholders). */
export async function rawQuery<T = unknown>(sql: string, params: unknown[]): Promise<T[]> {
  const rows = await client().unsafe(sql, params as never[]);
  return rows as unknown as T[];
}

/** Shape returned by the weighted FTS query. */
type FtsRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  rank: number;
};

/**
 * Weighted PostgreSQL full-text search over published articles
 * (title `A` > excerpt `B` > body `C`). Falls back to the caller on error.
 */
export async function postgresFtsSearch(term: string, limit = 10): Promise<SearchResult[]> {
  const { sql, params } = ftsWeightedSearchSQL({ query: term, limit });
  const rows = await rawQuery<FtsRow>(sql, params);

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt ?? '',
    score: row.rank,
    source: 'postgres' as const,
    citation: { type: 'article' as const, ref: row.id },
  }));
}
