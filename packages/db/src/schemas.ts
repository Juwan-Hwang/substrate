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
import { z } from 'zod';
import {
  articles,
  experiments,
  graphSnapshots,
  newsletterSubscribers,
  notes,
  projects,
} from './index';

// ── Insert schemas (for creating new records) ───────────────────────

export const insertArticleSchema = createInsertSchema(articles, {
  slug: (schema) => (schema as z.ZodString).min(1).max(200),
  title: (schema) => (schema as z.ZodString).min(1).max(120),
  body: (schema) => (schema as z.ZodString).min(1),
  tags: (schema) => (schema as z.ZodArray<z.ZodString>).max(20),
}).omit({ id: true, createdAt: true, updatedAt: true, embedding: true });

export const insertProjectSchema = createInsertSchema(projects, {
  name: (schema) => (schema as z.ZodString).min(1).max(120),
  description: (schema) => (schema as z.ZodString).min(1).max(300),
  url: (schema) => (schema as z.ZodString).url().optional(),
  repo: (schema) => (schema as z.ZodString).url().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertNoteSchema = createInsertSchema(notes, {
  title: (schema) => (schema as z.ZodString).min(1).max(120),
  body: (schema) => (schema as z.ZodString).min(1),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertExperimentSchema: z.ZodType = createInsertSchema(experiments, {
  name: (schema) => (schema as z.ZodString).min(1).max(120),
  parameters: (schema) => schema,
}).omit({ id: true, createdAt: true, result: true, durationMs: true });

export const insertGraphSnapshotSchema: z.ZodType = createInsertSchema(graphSnapshots).omit({
  id: true,
  createdAt: true,
});

export const insertNewsletterSubscriberSchema = createInsertSchema(newsletterSubscribers, {
  email: (schema) => (schema as z.ZodString).email(),
}).omit({ id: true, createdAt: true, confirmed: true });

// ── Select schemas (for API responses) ──────────────────────────────

export const selectArticleSchema = createSelectSchema(articles).omit({ embedding: true });
export const selectProjectSchema: z.ZodType = createSelectSchema(projects);
export const selectNoteSchema: z.ZodType = createSelectSchema(notes);
export const selectExperimentSchema: z.ZodType = createSelectSchema(experiments);
export const selectGraphSnapshotSchema: z.ZodType = createSelectSchema(graphSnapshots);
export const selectNewsletterSubscriberSchema: z.ZodType =
  createSelectSchema(newsletterSubscribers);

// ── Update schemas (for partial updates) ────────────────────────────

export const updateArticleSchema = insertArticleSchema.partial();
export const updateProjectSchema = insertProjectSchema.partial();
export const updateNoteSchema = insertNoteSchema.partial();

// ── Query schemas (for list endpoints) ──────────────────────────────

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
