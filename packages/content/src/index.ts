/**
 * @substrate-platform/content — Content layer for personal sites.
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

// ── Syndication (RSS 2.0 / Atom 1.0 / JSON Feed 1.1) ─────────────────

export type { FeedBuilder, FeedFormat } from './syndication';
export {
  createFeed,
  escapeXml,
  generateAtom,
  generateJsonFeed,
  generateRss2,
  stripXmlControlChars,
  toRfc822Date,
  toRfc3339Date,
  wrapCdata,
} from './syndication';
