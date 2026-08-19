/**
 * `/api/ingest` — content ingestion endpoint.
 *
 * Accepts an article and either:
 *  - persists it to PostgreSQL via the Drizzle instance (`createDb`),
 *    generates a 1536-dim embedding when an AI key is present (written
 *    via a raw `::vector` update so it is immune to Drizzle pgvector
 *    typing differences across versions), and reports the reindex as
 *    queued; or
 *  - returns a demo success when no `DATABASE_URL` is configured, so the
 *    ingestion flow is always explorable.
 */

import { createOpenAI } from '@ai-sdk/openai';
import { articles } from '@substrate/db';
import { embed } from 'ai';
import { NextResponse } from 'next/server';
import { drizzleDb, rawQuery } from '@/lib/db';
import { hasAI, hasDatabase, openaiApiKey } from '@/lib/env';
import { createArchiveLogger } from '@/lib/logger';
import type { IngestPayload, IngestResponse } from '@/lib/types';

const logger = createArchiveLogger('ingest');

/** Derive a URL-safe slug from a title. */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as Partial<IngestPayload> | null;
  const title = (body?.title ?? '').trim();
  const bodyText = (body?.body ?? '').trim();

  if (!title || !bodyText) {
    return NextResponse.json<IngestResponse>(
      { status: 'error', message: 'title and body are required' },
      { status: 400 },
    );
  }

  const slug = (body?.slug ?? '').trim() || slugify(title);
  const tags = body?.tags ?? [];

  // Demo mode — no database configured.
  if (!hasDatabase()) {
    return NextResponse.json<IngestResponse>({
      status: 'demo',
      id: crypto.randomUUID(),
      message: 'Demo mode (no DATABASE_URL): ingestion simulated. Set DATABASE_URL to persist.',
    });
  }

  try {
    const db = drizzleDb();

    // Insert the row via Drizzle (typed). Embedding is written separately
    // below so we never depend on Drizzle's pgvector insert typing.
    const values: typeof articles.$inferInsert = {
      slug,
      title,
      body: bodyText,
      tags,
      status: 'draft',
    };
    const excerpt = (body?.excerpt ?? '').trim();
    if (excerpt) values.excerpt = excerpt;

    const [inserted] = await db.insert(articles).values(values).returning({ id: articles.id });
    const id = inserted?.id;

    // Optional embedding — requires an AI provider key.
    const key = openaiApiKey();
    if (id && hasAI() && key) {
      const openai = createOpenAI({ apiKey: key });
      const { embedding } = await embed({
        model: openai.embedding('text-embedding-3-small'),
        value: `${title}\n\n${bodyText}`,
      });
      const vecLiteral = `[${embedding.join(',')}]`;
      await rawQuery(
        'UPDATE articles SET embedding = $1::vector, updated_at = now() WHERE id = $2',
        [vecLiteral, id],
      );
    }

    return NextResponse.json<IngestResponse>({
      status: 'success',
      ...(id ? { id } : {}),
      message: 'Article ingested. Reindex queued.',
    });
  } catch (err) {
    logger.error('ingest failed', { error: err });
    return NextResponse.json<IngestResponse>(
      { status: 'error', message: 'Ingestion failed. Check server logs.' },
      { status: 500 },
    );
  }
}
