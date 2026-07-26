/**
 * Hybrid Retrieval + Rerank — semantic search with source citations.
 *
 * Combines:
 *  - PostgreSQL FTS (keyword/BM25) via Drizzle
 *  - pgvector cosine similarity (semantic)
 *  - Cross-encoder reranking (Transformers.js on the client, or API-based)
 *
 * Results are merged via reciprocal rank fusion, then reranked,
 * with source citations attached for transparency.
 */
import type { RetrievalResult } from './index.js';

export type HybridSearchParams = {
  query: string;
  queryEmbedding?: number[];
  limit?: number;
  ftsWeight?: number;
  vectorWeight?: number;
};

export type HybridSearchConfig = {
  /** Postgres connection for FTS + vector search. */
  db?: { query: (sql: string, params: unknown[]) => Promise<unknown[]> };
  /** Pre-computed embedding for the query (e.g., from Transformers.js). */
  embed?: (text: string) => Promise<number[]>;
};

/** Reciprocal Rank Fusion — merges multiple ranked lists into one. */
function rrf(
  rankedLists: { id: string; score: number }[][],
  k = 60,
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const list of rankedLists) {
    for (let rank = 0; rank < list.length; rank++) {
      const { id } = list[rank];
      const contribution = 1 / (k + rank + 1);
      scores.set(id, (scores.get(id) ?? 0) + contribution);
    }
  }
  return scores;
}

export async function hybridRetrieval(
  params: HybridSearchParams,
  config: HybridSearchConfig,
): Promise<RetrievalResult[]> {
  const { query, limit = 10, ftsWeight = 0.4, vectorWeight = 0.6 } = params;
  const lists: { id: string; score: number }[][] = [];

  // 1. Keyword search via PostgreSQL FTS.
  if (config.db) {
    const ftsResults = (await config.db.query(
      `SELECT id, ts_rank_cd(to_tsvector('english', body), plainto_tsquery('english', $1)) AS score
       FROM articles WHERE status = 'published'
       AND to_tsvector('english', body) @@ plainto_tsquery('english', $1)
       ORDER BY score DESC LIMIT $2`,
      [query, limit * 2],
    )) as { id: string; score: number }[];
    lists.push(ftsResults.map((r) => ({ id: r.id, score: r.score * ftsWeight })));
  }

  // 2. Semantic search via pgvector.
  let embedding = params.queryEmbedding;
  if (!embedding && config.embed) {
    embedding = await config.embed(query);
  }
  if (config.db && embedding) {
    const vecStr = `[${embedding.join(',')}]`;
    const vecResults = (await config.db.query(
      `SELECT id, 1 - (embedding <=> $1::vector) AS score
       FROM articles WHERE status = 'published'
       ORDER BY embedding <=> $1::vector LIMIT $2`,
      [vecStr, limit * 2],
    )) as { id: string; score: number }[];
    lists.push(vecResults.map((r) => ({ id: r.id, score: r.score * vectorWeight })));
  }

  // 3. Fuse via RRF.
  const fused = rrf(lists);
  const sorted = [...fused.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, score]) => ({ id, score }));

  return sorted.map((r) => ({
    id: r.id,
    score: r.score,
    source: 'hybrid' as const,
    citation: { type: 'article' as const, ref: r.id },
  }));
}

/**
 * Rerank results using a cross-encoder model.
 * On the client, uses Transformers.js; on the server, delegates to an API.
 */
export async function rerank(
  query: string,
  results: RetrievalResult[],
  rerankerFn?: (query: string, docs: string[]) => Promise<number[]>,
): Promise<RetrievalResult[]> {
  if (!rerankerFn) return results;

  const docTexts = results.map((r) => r.id); // In production, fetch actual text.
  const scores = await rerankerFn(query, docTexts);

  return results
    .map((r, i) => ({ ...r, score: scores[i] ?? r.score, reranked: true }))
    .sort((a, b) => b.score - a.score);
}
