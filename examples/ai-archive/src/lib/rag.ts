/**
 * Pure RAG helpers — fusion, prompt construction, and citation wiring.
 *
 * Everything here is a pure function with no I/O, which makes the fusion
 * algorithm trivially unit-testable (see `src/__tests__/search.test.ts`).
 */
import type { Citation, SearchResult } from './types';

/**
 * Reciprocal Rank Fusion.
 *
 * Merges several ranked id lists into one score map using
 * `1 / (k + rank)`. Score-agnostic — ideal for fusing FTS and vector
 * lists whose score scales are incomparable.
 *
 * @param rankedLists each list is already sorted best-first
 * @param k smoothing constant (60 is the canonical default)
 */
export function reciprocalRankFusion(
  rankedLists: readonly (readonly { id: string; score: number }[])[],
  k = 60,
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const list of rankedLists) {
    for (let rank = 0; rank < list.length; rank++) {
      const entry = list[rank];
      if (!entry) continue;
      const contribution = 1 / (k + rank + 1);
      scores.set(entry.id, (scores.get(entry.id) ?? 0) + contribution);
    }
  }
  return scores;
}

/** Sort a fused score map into a descending array of `{ id, score }`. */
export function sortFused(
  fused: Map<string, number>,
  limit?: number,
): { id: string; score: number }[] {
  const sorted = [...fused.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
  return limit ? sorted.slice(0, limit) : sorted;
}

/** Assign `[1], [2], …` citation indices to retrieved results. */
export function toCitations(results: readonly SearchResult[]): Citation[] {
  return results.map((r, i) => ({
    index: i + 1,
    title: r.title,
    slug: r.slug,
    ref: r.citation.ref,
  }));
}

/**
 * Build the RAG system prompt that grounds the model in retrieved
 * evidence and instructs it to cite sources with `[n]` markers.
 */
export function buildRagPrompt(
  question: string,
  context: readonly SearchResult[],
): string {
  const sources = context
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.excerpt}`)
    .join('\n\n');

  return [
    'You are AI Archive, a retrieval-augmented assistant.',
    'Answer the user question using ONLY the provided sources.',
    'Cite sources with [n] markers matching the numbered sources below.',
    'If the sources do not contain the answer, say so explicitly.',
    '',
    'Sources:',
    sources.length > 0 ? sources : '(no sources retrieved)',
  ].join('\n');
}
