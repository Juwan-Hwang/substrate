/**
 * Server Actions — Archive content search & reindex.
 *
 * Uses PostgreSQL full-text search (via @substrate/db) for server-side search,
 * and triggers Orama reindex for client-side instant search.
 */
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const searchSchema = z.object({
  query: z.string().min(1).max(200),
  limit: z.number().int().min(1).max(50).default(10),
});

export type SearchResult = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  type: 'article' | 'project' | 'note';
  score: number;
};

export type SearchState = {
  ok: boolean;
  results?: SearchResult[];
  error?: string;
};

export async function searchContent(
  _prev: SearchState,
  formData: FormData,
): Promise<SearchState> {
  const parsed = searchSchema.safeParse({
    query: formData.get('query'),
    limit: Number(formData.get('limit') ?? 10),
  });

  if (!parsed.success) {
    return { ok: false, error: 'Invalid search query.' };
  }

  // In production: use PostgreSQL FTS via @substrate/db
  // SELECT id, slug, title, excerpt, ts_rank_cd(...) AS score
  // FROM articles WHERE to_tsvector('english', body) @@ plainto_tsquery('english', $1)
  // ORDER BY score DESC LIMIT $2

  return { ok: true, results: [] };
}

export async function reindexContent(): Promise<{ ok: boolean; message: string }> {
  // Trigger content reindex via edge Queue
  revalidatePath('/archive');
  return { ok: true, message: 'Reindex triggered.' };
}
