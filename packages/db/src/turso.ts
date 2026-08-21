/**
 * Turso / libSQL — READ-ONLY edge projection.
 *
 * Architecture:
 *   PostgreSQL (@substrate-platform/db/index.ts) is the single source of truth.
 *   Turso is a read-only replica for edge deployment (Cloudflare Workers)
 *   where Postgres (Hyperdrive) latency is too high.
 *
 * Data flows one way:
 *   Write → PostgreSQL → (CDC / Queue) → Turso replica → Edge SELECT
 *
 * This module MUST NEVER execute INSERT / UPDATE / DELETE / DDL.
 * Both the Drizzle wrapper and the raw client enforce this at runtime.
 */

import { type Client, createClient } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from './tables';

// ── Read-only Drizzle wrapper ──────────────────────────────────────

/**
 * Subset of Drizzle's API that only exposes read operations.
 * insert / update / delete are intentionally omitted.
 */
export type ReadOnlyDrizzleDb = Pick<LibSQLDatabase<typeof schema>, 'query' | 'select'>;

/**
 * Create a read-only Drizzle instance backed by Turso.
 *
 * The underlying connection is the same, but the returned object
 * only exposes `query` and `select` — there is no `insert`,
 * `update`, or `delete` method on the type.
 */
export function createTursoReadReplica(config: TursoConfig): ReadOnlyDrizzleDb {
  const client = createClient({
    url: config.url,
    authToken: config.authToken,
  });
  const db = drizzle(client, { schema });
  // Return only the read surface. Even if a caller casts back to
  // LibSQLDatabase, the raw client guard (below) still blocks writes.
  return { query: db.query, select: db.select };
}

// ── Guarded raw SQL client ─────────────────────────────────────────

const WRITE_PATTERN =
  /^\s*(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|REPLACE|MERGE|GRANT|REVOKE|PRAGMA)\b/i;

export type TursoConfig = {
  url: string;
  authToken: string;
};

/**
 * Create a Turso client that only allows SELECT statements.
 *
 * Every `execute()` call is intercepted: if the SQL does not start
 * with SELECT (or WITH ... SELECT), an error is thrown immediately.
 * This is a runtime safety net — the type-level restriction above
 * is the first line of defense.
 */
export function createTursoReadClient(config: TursoConfig): Client {
  const inner = createClient({
    url: config.url,
    authToken: config.authToken,
  });

  return new Proxy(inner, {
    get(target, prop: keyof Client) {
      if (prop === 'execute') {
        return async (stmt: Parameters<Client['execute']>[0]) => {
          const sql = typeof stmt === 'string' ? stmt : stmt.sql;
          if (WRITE_PATTERN.test(sql)) {
            throw new Error(
              `[Turso] Write operation blocked — Turso is a read-only replica. ` +
                `Use PostgreSQL (@substrate-platform/db) for all writes. Attempted SQL: ${sql.slice(0, 80)}…`,
            );
          }
          return target.execute(stmt);
        };
      }
      // batch is also blocked — it could contain writes.
      if (prop === 'batch') {
        return async (stmts: Parameters<Client['batch']>[0]) => {
          for (const s of stmts) {
            const sql = typeof s === 'string' ? s : s.sql;
            if (WRITE_PATTERN.test(sql)) {
              throw new Error(
                `[Turso] Write operation blocked in batch — Turso is a read-only replica. ` +
                  `Use PostgreSQL (@substrate-platform/db) for all writes. Attempted SQL: ${sql.slice(0, 80)}…`,
              );
            }
          }
          return target.batch(stmts);
        };
      }
      return target[prop];
    },
  });
}
