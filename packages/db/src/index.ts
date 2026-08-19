/**
 * @substrate/db — Database access layer (PostgreSQL 17 + Drizzle ORM + pgvector).
 *
 * Provides database primitives and generic table definitions.
 * Application-specific tables (graph snapshots, newsletter subscribers,
 * etc.) are defined by the application, not by the platform.
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

// ── Tables & types (defined in tables.ts to avoid circular deps) ─────

export type {
  Article,
  Experiment,
  NewArticle,
  NewNote,
  NewProject,
  Note,
  Project,
} from './tables';
export {
  articles,
  contentStatusEnum,
  experiments,
  notes,
  projects,
} from './tables';

// ── Turso / libSQL (edge READ-ONLY replica) ────────────────────────
// Turso is a read-only projection of PostgreSQL. Writes go through
// PostgreSQL only, then propagate to Turso via CDC / Queue.
// See CONTRIBUTING.md for the full data-flow contract.

export type { ReadOnlyDrizzleDb, TursoConfig } from './turso';
export { createTursoReadClient, createTursoReadReplica } from './turso';

// ── PostgreSQL Full-Text Search ─────────────────────────────────────

export type { FTSQuery, FTSResult } from './fts';
export { FTS_INDEX_SQL, ftsSearchSQL, ftsWeightedSearchSQL } from './fts';

// ── Drizzle-Zod schemas (auto-generated from table definitions) ─────

export {
  insertArticleSchema,
  insertExperimentSchema,
  insertNoteSchema,
  insertProjectSchema,
  listArticlesQuerySchema,
  listExperimentsQuerySchema,
  selectArticleSchema,
  selectExperimentSchema,
  selectNoteSchema,
  selectProjectSchema,
  updateArticleSchema,
  updateNoteSchema,
  updateProjectSchema,
} from './schemas';
