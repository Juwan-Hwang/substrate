/**
 * Vitest suite for the AI Archive example.
 *
 * Covers the three pure concerns that the graceful-degradation path
 * relies on:
 *  1. Orama fallback index creation + querying.
 *  2. The Reciprocal Rank Fusion algorithm (pure function).
 *  3. Structural validity of the static demo corpus.
 */

import { createSearchIndex } from '@substrate-platform/content/search';
import { describe, expect, it } from 'vitest';
import { demoArticles } from '../lib/demo-articles';
import { reciprocalRankFusion, sortFused } from '../lib/rag';

describe('Orama fallback search', () => {
  it('builds an index from the demo corpus and returns matching hits', async () => {
    const index = await createSearchIndex([...demoArticles]);
    const result = (await index.search('vector', 10)) as {
      hits?: { document: { title: string } }[];
    };

    expect(result.hits).toBeDefined();
    const hits = result.hits ?? [];
    expect(hits.length).toBeGreaterThan(0);

    const titles = hits.map((h) => h.document.title);
    expect(titles.some((t) => t.toLowerCase().includes('vector'))).toBe(true);
  });

  it('returns an empty hit set for a term not in the corpus', async () => {
    const index = await createSearchIndex([...demoArticles]);
    const result = (await index.search('zzz-no-such-term-xyz', 10)) as {
      hits?: unknown[];
    };
    expect(result.hits ?? []).toHaveLength(0);
  });
});

describe('Reciprocal Rank Fusion', () => {
  it('rewards documents that appear near the top of multiple lists', () => {
    const listA = [
      { id: 'a', score: 0.9 },
      { id: 'b', score: 0.5 },
    ];
    const listB = [
      { id: 'b', score: 0.8 },
      { id: 'c', score: 0.3 },
    ];

    const fused = reciprocalRankFusion([listA, listB], 60);
    const sorted = sortFused(fused);

    // b appears in both lists → must rank first.
    expect(sorted[0]?.id).toBe('b');
    expect(fused.get('b')).toBeGreaterThan(fused.get('a') ?? 0);
    expect(fused.get('b')).toBeGreaterThan(fused.get('c') ?? 0);
  });

  it('matches the closed-form 1/(k+rank) contribution', () => {
    const list = [
      { id: 'x', score: 1 },
      { id: 'y', score: 1 },
    ];
    const fused = reciprocalRankFusion([list], 60);

    // rank 0 → 1/61, rank 1 → 1/62
    expect(fused.get('x')).toBeCloseTo(1 / 61, 10);
    expect(fused.get('y')).toBeCloseTo(1 / 62, 10);
  });

  it('respects the limit argument when sorting', () => {
    const list = ['a', 'b', 'c', 'd'].map((id) => ({ id, score: 1 }));
    const fused = reciprocalRankFusion([list]);
    const sorted = sortFused(fused, 2);
    expect(sorted).toHaveLength(2);
  });
});

describe('Demo article corpus', () => {
  it('contains five well-formed articles', () => {
    expect(demoArticles).toHaveLength(5);

    for (const doc of demoArticles) {
      expect(typeof doc.id).toBe('string');
      expect(doc.id.length).toBeGreaterThan(0);
      expect(typeof doc.slug).toBe('string');
      expect(typeof doc.title).toBe('string');
      expect(doc.title.length).toBeGreaterThan(0);
      expect(typeof doc.excerpt).toBe('string');
      expect(doc.excerpt.length).toBeGreaterThan(0);
      expect(typeof doc.body).toBe('string');
      expect(doc.body.length).toBeGreaterThan(0);
      expect(Array.isArray(doc.tags)).toBe(true);
      expect(doc.tags.length).toBeGreaterThan(0);
      expect(doc.type).toBe('article');
    }
  });

  it('has unique ids and slugs', () => {
    const ids = new Set(demoArticles.map((d) => d.id));
    const slugs = new Set(demoArticles.map((d) => d.slug));
    expect(ids.size).toBe(demoArticles.length);
    expect(slugs.size).toBe(demoArticles.length);
  });
});
