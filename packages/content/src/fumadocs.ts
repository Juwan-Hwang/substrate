/**
 * Fumadocs — documentation rendering and MDX processing.
 *
 * fumadocs-ui provides the <DocsPage>, <DocsBody>, <DocsTitle> components.
 * fumadocs-mdx compiles MDX with frontmatter and component mapping.
 * fumadocs-core handles search, TOC, and page tree.
 *
 * This module exports the source configuration and helper functions
 * for rendering MDX content with Fumadocs components.
 */
import { source } from 'fumadocs-mdx';
import {
  DocsPage,
  DocsBody,
  DocsDescription,
  DocsTitle,
} from 'fumadocs-ui/page';
import { Card, Cards } from 'fumadocs-ui/components/card';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { Accordion, AccordionItem } from 'fumadocs-ui/components/accordion';
import { Callout } from 'fumadocs-ui/components/callout';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import type { MDXComponents } from 'mdx/types';

/**
 * Fumadocs MDX source — scans the content directory for .mdx files
 * and builds a page tree.
 *
 * Configure in velite.config / fumadocs-mdx.config:
 * ```ts
 * // content/src/index.ts already defines Velite collections.
 * // Fumadocs MDX runs as a separate build step for docs content.
 * ```
 */
export const docsSource = source({
  baseUrl: '/docs',
  sourceDir: 'docs',
  rootDir: '../../apps/aevum',
});

/**
 * Default MDX component mapping for Fumadocs.
 *
 * Pass this to <MDXContent components={fumadocsComponents} />.
 */
export const fumadocsComponents: MDXComponents = {
  DocsPage,
  DocsBody,
  DocsDescription,
  DocsTitle,
  Card,
  Cards,
  Tab,
  Tabs,
  Accordion,
  AccordionItem,
  Callout,
  Step,
  Steps,
};

/**
 * Generate a table of contents from MDX content.
 * Uses fumadocs-core's built-in TOC generator.
 */
export async function generateToc(content: string): Promise<
  Array<{
    title: string;
    url: string;
    depth: number;
  }>
> {
  const { getHeadings } = await import('fumadocs-mdx/runtime');
  const headings = getHeadings(content);
  return headings.map((h) => ({
    title: h.content,
    url: `#${h.slug}`,
    depth: h.level,
  }));
}

/**
 * Search index for Fumadocs — uses Orama under the hood.
 * Delegates to the Orama search index defined in ./search.ts.
 */
export { createSearchIndex } from './search';
export type { SearchableDoc } from './search';

/**
 * Static OG image path for docs pages.
 * Uses the /api/og route in @substrate/web.
 */
export function docsOgImage(title: string): string {
  return `/api/og?title=${encodeURIComponent(title)}&subtitle=Documentation`;
}
