/**
 * PostgreSQL Full-Text Search (FTS) — server-side content search.
 *
 * Uses `tsvector` / `tsquery` for efficient keyword search with ranking.
 * Combined with pgvector semantic search in @substrate/ai for hybrid retrieval.
 *
 * Requires the `articles` table to have:
 *  - A `tsv` column (generated tsvector) OR
 *  - An expression index on `to_tsvector('english', body)`
 */

export type FTSResult = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  rank: number;
};

export type FTSQuery = {
  query: string;
  limit?: number;
  offset?: number;
};

/**
 * Search articles using PostgreSQL full-text search.
 *
 * Uses `plainto_tsquery` for user-friendly query parsing (handles
 * multi-word queries without special syntax).
 *
 * ```sql
 * SELECT id, slug, title, excerpt,
 *        ts_rank_cd(to_tsvector('english', body), plainto_tsquery('english', $1)) AS rank
 * FROM articles
 * WHERE status = 'published'
 *   AND to_tsvector('english', body) @@ plainto_tsquery('english', $1)
 * ORDER BY rank DESC
 * LIMIT $2 OFFSET $3
 * ```
 */
export function ftsSearchSQL(query: FTSQuery): { sql: string; params: unknown[] } {
  const { query: term, limit = 10, offset = 0 } = query;
  return {
    sql: `
      SELECT id, slug, title, excerpt,
             ts_rank_cd(
               to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, '')),
               plainto_tsquery('english', $1)
             ) AS rank
      FROM articles
      WHERE status = 'published'
        AND to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, '')) @@ plainto_tsquery('english', $1)
      ORDER BY rank DESC
      LIMIT $2 OFFSET $3
    `,
    params: [term, limit, offset],
  };
}

/**
 * Search with weighted ranking (title > excerpt > body).
 *
 * ```sql
 * SELECT id, slug, title, excerpt,
 *   ts_rank_cd(
 *     setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
 *     setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
 *     setweight(to_tsvector('english', coalesce(body, '')), 'C'),
 *     plainto_tsquery('english', $1)
 *   ) AS rank
 * ```
 */
export function ftsWeightedSearchSQL(query: FTSQuery): { sql: string; params: unknown[] } {
  const { query: term, limit = 10, offset = 0 } = query;
  return {
    sql: `
      SELECT id, slug, title, excerpt,
             ts_rank_cd(
               setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
               setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
               setweight(to_tsvector('english', coalesce(body, '')), 'C'),
               plainto_tsquery('english', $1)
             ) AS rank
      FROM articles
      WHERE status = 'published'
        AND (
          setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(body, '')), 'C')
        ) @@ plainto_tsquery('english', $1)
      ORDER BY rank DESC
      LIMIT $2 OFFSET $3
    `,
    params: [term, limit, offset],
  };
}

/**
 * SQL for creating a GIN index on the articles table for FTS.
 *
 * Run this as a migration:
 * ```sql
 * CREATE INDEX IF NOT EXISTS articles_fts_idx
 * ON articles
 * USING gin(
 *   setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
 *   setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
 *   setweight(to_tsvector('english', coalesce(body, '')), 'C')
 * );
 * ```
 */
export const FTS_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS articles_fts_idx
  ON articles
  USING gin(
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'C')
  );

  -- Also index tags for array contains queries
  CREATE INDEX IF NOT EXISTS articles_tags_idx
  ON articles USING gin(tags);
`;
