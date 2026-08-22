/**
 * Unit tests for the Orama search index helper exported by @substrate-platform/content.
 *
 * Verifies that Northstar's mission log corpus is indexed, that term queries
 * match the right records, and that queries with no matches return an empty
 * hit set.
 */
import { createSearchIndex, type SearchableDoc } from '@substrate-platform/content/search';
import { describe, expect, it } from 'vitest';

const docs: SearchableDoc[] = [
  {
    id: 'plasma-containment',
    title: 'Plasma Containment Field Tuning',
    excerpt: 'Calibrating toroidal field coils for fusion burn.',
    body: 'The eighth generation of toroidal containment coils deployed at Europa Station exhibits a measurable drift in field symmetry after sustained operation.',
    slug: 'plasma-containment',
    tags: ['propulsion', 'fusion'],
    type: 'article',
  },
  {
    id: 'autonomous-navigation',
    title: 'Autonomous Navigation in the Deep Field',
    excerpt: 'Pulsar timing arrays for self-positioning beyond the heliopause.',
    body: 'The Northstar probe carries a pulsar timing array that observes millisecond pulsars and cross-correlates their pulse arrival times.',
    slug: 'autonomous-navigation',
    tags: ['navigation', 'pulsars'],
    type: 'article',
  },
  {
    id: 'quantum-comm',
    title: 'Quantum Entanglement Communication: Latency Realities',
    excerpt: 'Why entanglement does not eliminate latency.',
    body: 'The no-communication theorem is unambiguous: a measurement on one half of an entangled pair reveals correlation but does not transmit information.',
    slug: 'quantum-comm',
    tags: ['communications', 'quantum'],
    type: 'article',
  },
];

describe('createSearchIndex — Northstar corpus', () => {
  it('indexes documents and returns matches for a known term', async () => {
    const index = await createSearchIndex(docs);
    const result = await index.search('plasma');

    const titles = result.hits.map((hit) => (hit.document as SearchableDoc).title);

    expect(result.hits.length).toBeGreaterThan(0);
    expect(titles).toContain('Plasma Containment Field Tuning');
  });

  it('matches navigation-related terms', async () => {
    const index = await createSearchIndex(docs);
    const result = await index.search('pulsar');

    const titles = result.hits.map((hit) => (hit.document as SearchableDoc).title);
    expect(titles).toContain('Autonomous Navigation in the Deep Field');
  });

  it('returns an empty hit set for a term that matches nothing', async () => {
    const index = await createSearchIndex(docs);
    const result = await index.search('nonexistent-term-xyz');

    expect(result.hits).toHaveLength(0);
  });
});
