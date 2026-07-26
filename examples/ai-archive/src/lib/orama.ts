/**
 * Orama client-side fallback search.
 *
 * Used when no `DATABASE_URL` is configured, and as a safety net when a
 * Postgres query fails. The index is built lazily over the static demo
 * corpus and cached for the lifetime of the process.
 */
import { createSearchIndex, type SearchableDoc } from '@substrate/content/search';
import { demoArticles } from './demo-articles';
import type { SearchResult } from './types';

type OramaHit = { document: SearchableDoc; score: number };
type OramaResult = { hits?: OramaHit[] };

let indexPromise: ReturnType<typeof createSearchIndex> | null = null;

/** Lazily build (and memoise) the Orama index over the demo corpus. */
function getIndex(): ReturnType<typeof createSearchIndex> {
  if (!indexPromise) indexPromise = createSearchIndex([...demoArticles]);
  return indexPromise;
}

/**
 * Search the demo corpus with Orama.
 *
 * @returns results normalised to the shared {@link SearchResult} shape so
 * the UI can render Postgres and Orama hits identically.
 */
export async function oramaSearch(term: string, limit = 8): Promise<SearchResult[]> {
  const trimmed = term.trim();
  if (!trimmed) return [];

  const index = await getIndex();
  const raw = (await index.search(trimmed, limit)) as OramaResult;
  const hits = raw.hits ?? [];

  return hits.map((hit) => {
    const doc = hit.document;
    return {
      id: doc.id,
      slug: doc.slug,
      title: doc.title,
      excerpt: doc.excerpt,
      score: hit.score,
      source: 'orama' as const,
      citation: { type: 'article' as const, ref: doc.id },
    };
  });
}
