/**
 * @substrate/db — Database access layer (PostgreSQL 17 + Drizzle ORM + pgvector).
 *
 * The single source of truth for all persistent data:
 *  - Archive content metadata & engagement
 *  - Crucible experiment results
 *  - Lattice graph snapshots
 *  - Auth & user data (via Better Auth)
 */

import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';
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

// ── Enums ────────────────────────────────────────────────────────────

export const subsystemEnum = pgEnum('subsystem', ['lattice', 'crucible', 'archive']);
export const contentStatusEnum = pgEnum('content_status', ['draft', 'published', 'archived']);

// ── Tables ───────────────────────────────────────────────────────────

export const articles = pgTable('articles', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  excerpt: text('excerpt'),
  body: text('body').notNull(),
  tags: text('tags').array().default([]),
  status: contentStatusEnum('status').default('draft'),
  embedding: vector('embedding', { dimensions: 1536 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  url: text('url'),
  repo: text('repo'),
  status: text('status').default('active'),
  tags: text('tags').array().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const notes = pgTable('notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  tags: text('tags').array().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const experiments = pgTable(
  'experiments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    subsystem: subsystemEnum('subsystem').notNull(),
    userId: text('user_id'),
    parameters: jsonb('parameters').notNull(),
    result: jsonb('result'),
    durationMs: integer('duration_ms'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('experiments_user_id_idx').on(table.userId)],
);

export const graphSnapshots = pgTable('graph_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  subsystem: subsystemEnum('subsystem').default('lattice'),
  snapshot: jsonb('snapshot').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const newsletterSubscribers = pgTable('newsletter_subscribers', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  confirmed: boolean('confirmed').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type Experiment = typeof experiments.$inferSelect;
export type GraphSnapshot = typeof graphSnapshots.$inferSelect;
export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;

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
  insertGraphSnapshotSchema,
  insertNewsletterSubscriberSchema,
  insertNoteSchema,
  insertProjectSchema,
  listArticlesQuerySchema,
  listExperimentsQuerySchema,
  selectArticleSchema,
  selectExperimentSchema,
  selectGraphSnapshotSchema,
  selectNewsletterSubscriberSchema,
  selectNoteSchema,
  selectProjectSchema,
  updateArticleSchema,
  updateNoteSchema,
  updateProjectSchema,
} from './schemas';
