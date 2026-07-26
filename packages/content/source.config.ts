/**
 * Fumadocs MDX source configuration.
 *
 * Defines the docs source for fumadocs-mdx. This file is consumed by
 * the fumadocs-mdx build step to generate a typed page tree.
 *
 * The Velite config (src/index.ts) handles article/project/note collections.
 * This config handles the documentation tree (guides, API docs, etc.).
 */
import { source } from 'fumadocs-mdx';

export const docs = source({
  baseUrl: '/docs',
  rootDir: '../../apps/aevum',
  sourceDir: 'docs',
});
