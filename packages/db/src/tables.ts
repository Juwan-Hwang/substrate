/**
 * Drizzle table definitions — the single source of truth for all schemas.
 *
 * This module exists separately from `index.ts` to break circular
 * dependencies. `index.ts` re-exports these tables as a barrel, and
 * `schemas.ts` / `turso.ts` import directly from here to avoid the
 * TDZ (Temporal Dead Zone) error that occurs when Turbopack evaluates
 * `index.ts` → `schemas.ts` → `index.ts` before table constants are
 * initialised.
 */

import {
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

// ── Enums ────────────────────────────────────────────────────────────

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
    subsystem: text('subsystem').notNull(),
    userId: text('user_id'),
    parameters: jsonb('parameters').notNull(),
    result: jsonb('result'),
    durationMs: integer('duration_ms'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('experiments_user_id_idx').on(table.userId)],
);

// graph_snapshots and newsletter_subscribers tables are intentionally
// absent from the platform schema. They are application-specific and
// should be defined by the application (or a capability package) that
// needs them.

// ── Inferred types ───────────────────────────────────────────────────

export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type Experiment = typeof experiments.$inferSelect;
