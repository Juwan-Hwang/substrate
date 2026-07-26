/**
 * Unit tests for the Orama search index helper exported by @substrate/content.
 *
 * Verifies that documents are indexed, that term queries match the right
 * records, and that queries with no matches return an empty hit set.
 */
import { describe, expect, it } from 'vitest';
import { createSearchIndex, type SearchableDoc } from '@substrate/content/search';

const docs: SearchableDoc[] = [
  {
    id: 'design-systems',
    title: 'Design Systems at Scale',
    excerpt: 'Token-driven theming keeps a UI consistent.',
    body: 'A design system codifies tokens, primitives, and patterns so teams ship consistent interfaces.',
    slug: 'design-systems',
    tags: ['design', 'css'],
    type: 'article',
  },
  {
    id: 'instant-search',
    title: 'Instant Search with Orama',
    excerpt: 'Zero-round-trip search in the browser.',
    body: 'Orama builds a compact in-memory index so content teams can search without a server.',
    slug: 'instant-search',
    tags: ['search', 'orama'],
    type: 'article',
  },
  {
    id: 'edge-og',
    title: 'Edge-First OG Images',
    excerpt: 'Dynamic social cards at the edge.',
    body: 'Generate open graph images on the edge for every page without a build step.',
    slug: 'edge-og',
    tags: ['og', 'edge'],
    type: 'article',
  },
];

describe('createSearchIndex', () => {
  it('indexes documents and returns matches for a known term', async () => {
    const index = await createSearchIndex(docs);
    const result = await index.search('design');

    const titles = result.hits.map((hit) => (hit.document as SearchableDoc).title);

    expect(result.hits.length).toBeGreaterThan(0);
    expect(titles).toContain('Design Systems at Scale');
  });

  it('returns an empty hit set for a term that matches nothing', async () => {
    const index = await createSearchIndex(docs);
    const result = await index.search('nonexistent-term-xyz');

    expect(result.hits).toHaveLength(0);
  });
});
