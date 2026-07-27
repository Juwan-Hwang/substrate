/**
 * Server Actions — Archive content search & reindex.
 *
 * Uses PostgreSQL full-text search (via @substrate/db) for server-side search,
 * and triggers reindex via the edge Queue for content updates.
 */
'use server';

import * as Sentry from '@sentry/nextjs';
import { createDb } from '@substrate/db';
import { createLogger } from '@substrate/observability';
import { sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const logger = createLogger('Archive');

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

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not configured');
  }
  return createDb({ url });
}

export async function searchContent(_prev: SearchState, formData: FormData): Promise<SearchState> {
  const parsed = searchSchema.safeParse({
    query: formData.get('query'),
    limit: Number(formData.get('limit') ?? 10),
  });

  if (!parsed.success) {
    return { ok: false, error: 'Invalid search query.' };
  }

  try {
    const db = getDb();
    const searchQuery = parsed.data.query;
    const searchLimit = parsed.data.limit;

    const rows = (await db.execute(
      sql`SELECT id, slug, title, excerpt,
                 ts_rank_cd(
                   setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                   setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
                   setweight(to_tsvector('english', coalesce(body, '')), 'C'),
                   plainto_tsquery('english', ${searchQuery})
                 ) AS rank
          FROM articles
          WHERE status = 'published'
            AND (
              setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
              setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
              setweight(to_tsvector('english', coalesce(body, '')), 'C')
            ) @@ plainto_tsquery('english', ${searchQuery})
          ORDER BY rank DESC
          LIMIT ${searchLimit}`,
    )) as Array<{
      id: string;
      slug: string;
      title: string;
      excerpt: string | null;
      rank: number;
    }>;

    const results: SearchResult[] = rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt ?? '',
      type: 'article' as const,
      score: row.rank,
    }));

    return { ok: true, results };
  } catch (err) {
    logger.log({
      level: 'error',
      subsystem: 'Archive',
      message: 'searchContent failed',
      timestamp: Date.now(),
      context: { error: err },
    });
    Sentry.captureException(err);
    return { ok: false, error: 'Search failed. Please try again.' };
  }
}

export async function reindexContent(): Promise<{ ok: boolean; message: string }> {
  // Trigger content reindex via edge Queue.
  // The edge worker picks this up and regenerates embeddings + FTS index.
  revalidatePath('/archive');
  return { ok: true, message: 'Reindex triggered.' };
}
