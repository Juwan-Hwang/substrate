/**
 * drizzle-zod — auto-generated Zod schemas from Drizzle table definitions.
 *
 * These schemas are used for:
 *  - Input validation in Server Actions and tRPC procedures
 *  - Type-safe form validation with @hookform/resolvers/zod
 *  - API request/response validation
 *
 * ```ts
 * import { insertArticleSchema, selectArticleSchema } from '@substrate/db';
 * const parsed = insertArticleSchema.parse(formData);
 * ```
 */
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { articles, projects, notes, experiments, graphSnapshots } from './index';

// ── Insert schemas (for creating new records) ───────────────────────

export const insertArticleSchema = createInsertSchema(articles, {
  slug: (schema) => schema.slug.min(1).max(200),
  title: (schema) => schema.title.min(1).max(120),
  body: (schema) => schema.body.min(1),
  tags: (schema) => schema.tags.max(20),
}).omit({ id: true, createdAt: true, updatedAt: true, embedding: true });

export const insertProjectSchema = createInsertSchema(projects, {
  name: (schema) => schema.name.min(1).max(120),
  description: (schema) => schema.description.min(1).max(300),
  url: (schema) => schema.url.url().optional(),
  repo: (schema) => schema.repo.url().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertNoteSchema = createInsertSchema(notes, {
  title: (schema) => schema.title.min(1).max(120),
  body: (schema) => schema.body.min(1),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertExperimentSchema = createInsertSchema(experiments, {
  name: (schema) => schema.name.min(1).max(120),
  parameters: (schema) => schema.parameters,
}).omit({ id: true, createdAt: true, result: true, durationMs: true });

export const insertGraphSnapshotSchema = createInsertSchema(graphSnapshots).omit({
  id: true,
  createdAt: true,
});

// ── Select schemas (for API responses) ──────────────────────────────

export const selectArticleSchema = createSelectSchema(articles).omit({ embedding: true });
export const selectProjectSchema = createSelectSchema(projects);
export const selectNoteSchema = createSelectSchema(notes);
export const selectExperimentSchema = createSelectSchema(experiments);
export const selectGraphSnapshotSchema = createSelectSchema(graphSnapshots);

// ── Update schemas (for partial updates) ────────────────────────────

export const updateArticleSchema = insertArticleSchema.partial();
export const updateProjectSchema = insertProjectSchema.partial();
export const updateNoteSchema = insertNoteSchema.partial();

// ── Query schemas (for list endpoints) ──────────────────────────────

import { z } from 'zod';

export const listArticlesQuerySchema = z.object({
  tag: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']).default('published'),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export const listExperimentsQuerySchema = z.object({
  subsystem: z.enum(['lattice', 'crucible', 'archive']).optional(),
  limit: z.number().int().min(1).max(100).default(20),
});
