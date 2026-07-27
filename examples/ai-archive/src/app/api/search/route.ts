/**
 * `/api/search` — hybrid search endpoint (Node runtime).
 *
 * Resolution order:
 *  1. If `DATABASE_URL` is set → weighted PostgreSQL FTS
 *     (`ftsWeightedSearchSQL`) over published articles.
 *  2. On any Postgres error, or when no DB is configured → Orama
 *     client-side index over the demo corpus.
 *
 * The response shape is identical in both branches so the client never
 * needs to know which provider answered.
 */
import { NextResponse } from 'next/server';
import { postgresFtsSearch } from '@/lib/db';
import { hasDatabase } from '@/lib/env';
import { createArchiveLogger } from '@/lib/logger';
import { oramaSearch } from '@/lib/orama';
import type { SearchResponse } from '@/lib/types';

const logger = createArchiveLogger('search');

export const runtime = 'nodejs';

const clamp = (n: number, max: number) => (Number.isFinite(n) && n > 0 ? Math.min(n, max) : 10);

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const query = url.searchParams.get('q') ?? '';
  const limit = clamp(Number(url.searchParams.get('limit') ?? '10'), 50);

  if (!query.trim()) {
    return NextResponse.json<SearchResponse>({ query, provider: 'orama', results: [] });
  }

  // 1. Try Postgres FTS when a database is configured.
  if (hasDatabase()) {
    try {
      const results = await postgresFtsSearch(query, limit);
      return NextResponse.json<SearchResponse>({ query, provider: 'postgres', results });
    } catch (err) {
      logger.error('postgres FTS failed, falling back to orama', { error: err });
    }
  }

  // 2. Fallback / default: Orama over the demo corpus.
  const results = await oramaSearch(query, limit);
  return NextResponse.json<SearchResponse>({ query, provider: 'orama', results });
}
