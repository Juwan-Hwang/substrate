/**
 * Application-level table definitions for the AI Archive example.
 *
 * This file defines the `articles` table and related helpers that are
 * specific to this example site. The platform (@substrate-platform/db) does NOT
 * define content tables — each application defines its own.
 *
 * The platform provides the generic `entities` registry for lifecycle,
 * visibility, and ownership; application tables store only business fields.
 */

import { pgEnum, pgTable, text, timestamp, uuid, vector } from 'drizzle-orm/pg-core';

// ── Enums ────────────────────────────────────────────────────────────

export const contentStatusEnum = pgEnum('content_status', ['draft', 'published', 'archived']);

// ── Application Tables ───────────────────────────────────────────────

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

// ── Inferred types ───────────────────────────────────────────────────

export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
