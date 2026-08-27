/**
 * @substrate-platform/db — Database access layer (PostgreSQL 17 + Drizzle ORM).
 *
 * Provides database primitives and platform-level table definitions:
 *   - entities (generic entity registry)
 *   - associations (undirected entity relations)
 *   - entity_indexes (query optimization)
 *   - snapshots (immutable state snapshots)
 *   - cas_objects (content-addressed storage)
 *
 * Application-specific tables are defined by the application,
 * not by the platform.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// ── Connection ───────────────────────────────────────────────────────

export type DatabaseConfig = {
  url: string;
  maxConnections?: number;
};

export function createDb(config: DatabaseConfig) {
  const client = postgres(config.url, { max: config.maxConnections ?? 10 });
  return drizzle(client);
}

// ── Platform Tables & types ──────────────────────────────────────────

export type {
  AssociationRow,
  CasObject,
  Entity,
  EntityIndex,
  NewAssociationRow,
  NewCasObject,
  NewEntity,
  NewEntityIndex,
  NewPublicationAttemptRow,
  NewPublishingConfirmationRow,
  NewSnapshot,
  PublicationAttemptRow,
  PublishingConfirmationRow,
  Snapshot,
} from './tables';
export {
  associations,
  casObjects,
  entities,
  entityIndexes,
  publicationAttempts,
  publishingConfirmations,
  snapshots,
} from './tables';

// ── Transaction Management ───────────────────────────────────────────

export type {
  ClientLike,
  GenericTransactionManager,
  PoolLike,
} from './transaction';
export {
  createNoopTransactionManager,
  createPgTransactionManager,
  getTransactionClient,
  transactionContext,
} from './transaction';

// ── Turso / libSQL (edge READ-ONLY replica) ────────────────────────
// Turso is a read-only projection of PostgreSQL. Writes go through
// PostgreSQL only, then propagate to Turso via CDC / Queue.
// See CONTRIBUTING.md for the full data-flow contract.

export type { ReadOnlyDrizzleDb, TursoConfig } from './turso';
export { createTursoReadClient, createTursoReadReplica } from './turso';

// ── Drizzle-Zod schemas (auto-generated from platform table definitions) ──

export {
  insertCasObjectSchema,
  insertEntityIndexSchema,
  insertEntitySchema,
  insertSnapshotSchema,
  listEntitiesQuerySchema,
  selectCasObjectSchema,
  selectEntityIndexSchema,
  selectEntitySchema,
  selectSnapshotSchema,
  updateEntitySchema,
} from './schemas';
