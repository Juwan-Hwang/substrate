/**
 * Fumadocs — documentation rendering and MDX processing.
 *
 * fumadocs-ui provides the <DocsPage>, <DocsBody>, <DocsTitle> components.
 * fumadocs-mdx compiles MDX with frontmatter and component mapping.
 * fumadocs-core handles search, TOC, and page tree.
 *
 * This module exports helper functions for rendering MDX content
 * with Fumadocs components.
 */
import { getTableOfContents } from 'fumadocs-core/server';
import { Accordion } from 'fumadocs-ui/components/accordion';
import { Callout } from 'fumadocs-ui/components/callout';
import { Card, Cards } from 'fumadocs-ui/components/card';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/page';
import type { MDXComponents } from 'mdx/types';

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
  Callout,
  Step,
  Steps,
};

/**
 * Generate a table of contents from MDX content.
 * Uses fumadocs-core's built-in TOC generator.
 */
export function generateToc(content: string): Array<{
  title: string;
  url: string;
  depth: number;
}> {
  const toc = getTableOfContents(content) as Array<{
    title: { props?: { children?: string } } | string;
    url: string;
    depth: number;
  }>;
  return toc.map((item) => ({
    title: typeof item.title === 'string' ? item.title : (item.title?.props?.children ?? ''),
    url: item.url,
    depth: item.depth,
  }));
}

export type { SearchableDoc } from './search';

/**
 * Search index for Fumadocs — uses Orama under the hood.
 * Delegates to the Orama search index defined in ./search.ts.
 */
export { createSearchIndex } from './search';

/**
 * Docs source — Fumadocs MDX source configuration.
 *
 * The docs content directory lives at `apps/aevum/docs/` (see
 * `index.mdx` and `getting-started.mdx`). Until the build wires up
 * `source()` from `fumadocs-mdx`, this static descriptor is the single
 * source of truth for the docs base URL and on-disk source path:
 *
 * ```ts
 * // Future migration to a fully typed Fumadocs source:
 * import { source } from 'fumadocs-mdx';
 * export const docsSource = source({
 *   baseUrl: '/docs',
 *   sourcePath: 'content/docs',
 * });
 * ```
 */
export const docsSource = {
  baseUrl: '/docs',
  sourcePath: '../../apps/aevum/docs',
};

/**
 * Static OG image path for docs pages.
 * Uses the /api/og route in @substrate/web.
 */
export function docsOgImage(title: string): string {
  return `/api/og?title=${encodeURIComponent(title)}&subtitle=Documentation`;
}
