/**
 * @substrate/content — Content layer for personal sites.
 *
 * MDX v3 + Velite for content collection, Fumadocs for docs rendering,
 * Zod schemas for validation, Orama for instant static search.
 *
 * The platform provides the `createContentConfig` factory and the
 * `createSearchIndex` utility. The application supplies its own
 * Zod schemas, collection names, and content directory paths.
 */

export type { SearchableDoc } from './search';
export { createSearchIndex } from './search';

// ── Fumadocs ────────────────────────────────────────────────────────

export {
  createDocsSource,
  docsOgImage,
  fumadocsComponents,
  generateToc,
} from './fumadocs';
