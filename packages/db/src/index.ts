/**
 * @substrate/db — Database access layer (PostgreSQL 17 + Drizzle ORM + pgvector).
 *
 * The single source of truth for all persistent data:
 *  - Archive content metadata & engagement
 *  - Crucible experiment results
 *  - Lattice graph snapshots
 *  - Auth & user data (via Better Auth)
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { pgTable, uuid, text, timestamp, integer, jsonb, vector, pgEnum } from 'drizzle-orm/pg-core';

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

export const experiments = pgTable('experiments', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  subsystem: subsystemEnum('subsystem').notNull(),
  parameters: jsonb('parameters').notNull(),
  result: jsonb('result'),
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const graphSnapshots = pgTable('graph_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  subsystem: subsystemEnum('subsystem').default('lattice'),
  snapshot: jsonb('snapshot').notNull(),
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
