/**
 * @substrate/content — Content layer for the Archive subsystem.
 *
 * MDX v3 + Velite for content collection, Fumadocs for docs rendering,
 * Zod schemas for validation, Orama for instant static search.
 */
import { defineCollection, defineConfig, s } from 'velite';

/** Zod schema for article frontmatter. */
export const articleSchema = s.object({
  title: s.string().max(120),
  slug: s.path(),
  date: s.isodate(),
  excerpt: s.string().optional(),
  tags: s.array(s.string()).default([]),
  draft: s.boolean().default(false),
  body: s.mdx(),
});

/** Zod schema for project metadata. */
export const projectSchema = s.object({
  name: s.string().max(120),
  slug: s.path(),
  description: s.string().max(300),
  url: s.string().url().optional(),
  repo: s.string().url().optional(),
  status: s.enum(['active', 'archived', 'experimental']).default('active'),
  tags: s.array(s.string()).default([]),
  body: s.mdx(),
});

/** Zod schema for notes. */
export const noteSchema = s.object({
  title: s.string().max(120),
  slug: s.path(),
  date: s.isodate(),
  body: s.mdx(),
  tags: s.array(s.string()).default([]),
});

/** Velite configuration — content collections. */
export default defineConfig({
  collections: {
    articles: defineCollection({
      name: 'Article',
      pattern: '**/*.mdx',
      directory: '../../apps/aevum/archive/articles',
      schema: articleSchema,
    }),
    projects: defineCollection({
      name: 'Project',
      pattern: '**/*.mdx',
      directory: '../../apps/aevum/archive/projects',
      schema: projectSchema,
    }),
    notes: defineCollection({
      name: 'Note',
      pattern: '**/*.mdx',
      directory: '../../apps/aevum/archive/notes',
      schema: noteSchema,
    }),
  },
});

export type Article = s.infer<typeof articleSchema>;
export type Project = s.infer<typeof projectSchema>;
export type Note = s.infer<typeof noteSchema>;
