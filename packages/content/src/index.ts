/**
 * @substrate/content — Content layer for the Archive subsystem.
 *
 * MDX v3 + Velite for content collection, Fumadocs for docs rendering,
 * Zod schemas for validation, Orama for instant static search.
 */
import { defineCollection, defineConfig, s, type z } from 'velite';

/** Zod schema for article frontmatter. */
export const articleSchema = s.object({
  title: s.string().max(120),
  slug: s.path(),
  date: s.isodate(),
  excerpt: s.string().optional(),
  tags: s.array(s.string()).default([]),
  draft: s.boolean().default(false),
  body: s.mdx(),
}) as z.ZodType;

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
}) as z.ZodType;

/** Zod schema for notes. */
export const noteSchema = s.object({
  title: s.string().max(120),
  slug: s.path(),
  date: s.isodate(),
  body: s.mdx(),
  tags: s.array(s.string()).default([]),
}) as z.ZodType;

/** Velite configuration — content collections. */
const veliteConfig = defineConfig({
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

export default veliteConfig as unknown as Record<string, unknown>;

export type Project = z.infer<typeof projectSchema>;
export type Note = z.infer<typeof noteSchema>;

// ── Static corpus ──────────────────────────────────────────────────
// The demo article corpus lives in ./corpus and is the single source of
// truth consumed by @substrate/web's `lib/articles.ts`. `Article` is the
// corpus type (SearchableDoc); the Velite collection type can still be
// derived as `z.infer<typeof articleSchema>` when MDX lands.
export type { Article } from './corpus';
export { demoDocs, getArticle } from './corpus';

// ── Fumadocs ────────────────────────────────────────────────────────

export {
  docsOgImage,
  docsSource,
  fumadocsComponents,
  generateToc,
} from './fumadocs';
