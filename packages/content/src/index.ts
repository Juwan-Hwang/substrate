/**
 * @substrate/content — Content layer for personal sites.
 *
 * MDX v3 + Velite for content collection, Fumadocs for docs rendering,
 * Zod schemas for validation, Orama for instant static search.
 *
 * The platform provides schemas and a config factory. The application
 * supplies the content directory paths and actual content.
 */
import { defineCollection, defineConfig, s, type z } from 'velite';

// ── Zod schemas for frontmatter validation ───────────────────────────

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

// ── Config factory ───────────────────────────────────────────────────
//
// Applications call `createContentConfig` with their own content
// directory paths, then pass the result to Velite.

export type ContentConfigOptions = {
  articlesDir: string;
  projectsDir: string;
  notesDir: string;
};

export function createContentConfig(options: ContentConfigOptions) {
  return defineConfig({
    collections: {
      articles: defineCollection({
        name: 'Article',
        pattern: '**/*.mdx',
        directory: options.articlesDir,
        schema: articleSchema,
      }),
      projects: defineCollection({
        name: 'Project',
        pattern: '**/*.mdx',
        directory: options.projectsDir,
        schema: projectSchema,
      }),
      notes: defineCollection({
        name: 'Note',
        pattern: '**/*.mdx',
        directory: options.notesDir,
        schema: noteSchema,
      }),
    },
  });
}

export type Project = z.infer<typeof projectSchema>;
export type Note = z.infer<typeof noteSchema>;

// ── Fumadocs ────────────────────────────────────────────────────────

export {
  createDocsSource,
  docsOgImage,
  fumadocsComponents,
  generateToc,
} from './fumadocs';

export type { SearchableDoc } from './search';
export { createSearchIndex } from './search';
