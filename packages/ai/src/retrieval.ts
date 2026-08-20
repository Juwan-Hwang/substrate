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
/**
 * A single retrieved item with provenance for transparent citations.
 *
 * `source` records which channel produced the hit so the UI can badge
 * results; `citation` lets RAG answers reference their evidence.
 */
export type RetrievalResult = {
  id: string;
  score: number;
  /** Which retrieval channel produced this result. */
  source: 'hybrid' | 'fts' | 'vector';
  /** Provenance for transparent citations in RAG answers. */
  citation: { type: string; ref: string };
  /** Set when a cross-encoder reranker has reordered the result. */
  reranked?: boolean;
};

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
  /**
   * Table + column configuration for SQL-based search.
   * The application defines its own table/column names.
   */
  searchTable?: {
    name: string;
    bodyColumn: string;
    statusColumn?: string;
    publishedValue?: string;
    embeddingColumn?: string;
  };
};

/** Reciprocal Rank Fusion — merges multiple ranked lists into one. */
function rrf(rankedLists: { id: string; score: number }[][], k = 60): Map<string, number> {
  const scores = new Map<string, number>();
  for (const list of rankedLists) {
    for (let rank = 0; rank < list.length; rank++) {
      const entry = list[rank];
      if (!entry) continue;
      const { id } = entry;
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
  const tbl = config.searchTable;
  if (config.db && tbl) {
    const statusCond = tbl.statusColumn
      ? `${tbl.statusColumn} = '${tbl.publishedValue ?? 'published'}' AND `
      : '';
    const ftsResults = (await config.db.query(
      `SELECT id, ts_rank_cd(to_tsvector('english', ${tbl.bodyColumn}), plainto_tsquery('english', $1)) AS score
       FROM ${tbl.name}
       WHERE ${statusCond}to_tsvector('english', ${tbl.bodyColumn}) @@ plainto_tsquery('english', $1)
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
  if (config.db && embedding && tbl?.embeddingColumn) {
    const vecStr = `[${embedding.join(',')}]`;
    const statusCond = tbl.statusColumn
      ? `WHERE ${tbl.statusColumn} = '${tbl.publishedValue ?? 'published'}'`
      : 'WHERE TRUE';
    const vecResults = (await config.db.query(
      `SELECT id, 1 - (${tbl.embeddingColumn} <=> $1::vector) AS score
       FROM ${tbl.name} ${statusCond}
       ORDER BY ${tbl.embeddingColumn} <=> $1::vector LIMIT $2`,
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
    citation: { type: 'search-result', ref: r.id },
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
