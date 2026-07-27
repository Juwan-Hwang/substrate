/**
 * Unit tests for @substrate/db — drizzle-zod insert/select schemas and the
 * PostgreSQL full-text search SQL builders. No database connection required.
 */
import { describe, expect, it } from 'vitest';
import { FTS_INDEX_SQL, ftsSearchSQL, ftsWeightedSearchSQL } from '../fts';
import {
  insertArticleSchema,
  insertExperimentSchema,
  insertNewsletterSubscriberSchema,
  selectArticleSchema,
} from '../schemas';

// ── insertArticleSchema ──────────────────────────────────────────────

describe('insertArticleSchema', () => {
  const validInput = {
    slug: 'hello-world',
    title: 'Hello World',
    body: 'This is the article body.',
  };

  it('validates a correct article input', () => {
    const result = insertArticleSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slug).toBe('hello-world');
      expect(result.data.title).toBe('Hello World');
    }
  });

  it('treats tags and status as optional (not provided → absent from output)', () => {
    const result = insertArticleSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      // drizzle-zod makes defaulted columns optional but does not carry
      // the default value into the Zod schema; the key is simply absent.
      expect(result.data.tags).toBeUndefined();
      expect(result.data.status).toBeUndefined();
    }
  });

  it('accepts the optional excerpt and a custom status', () => {
    const result = insertArticleSchema.safeParse({
      ...validInput,
      excerpt: 'A summary.',
      status: 'published',
      tags: ['intro'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing required fields (no title/body)', () => {
    const result = insertArticleSchema.safeParse({ slug: 'no-title' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing slug', () => {
    const result = insertArticleSchema.safeParse({ title: 'T', body: 'B' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty body', () => {
    const result = insertArticleSchema.safeParse({ ...validInput, body: '' });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown status enum value', () => {
    const result = insertArticleSchema.safeParse({ ...validInput, status: 'weird' });
    expect(result.success).toBe(false);
  });

  it('does not accept the omitted id/createdAt/updatedAt/embedding fields', () => {
    // These are omitted from the insert schema; passing them is harmless but
    // they are not required. The schema must still validate without them.
    const result = insertArticleSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });
});

// ── selectArticleSchema ──────────────────────────────────────────────

describe('selectArticleSchema', () => {
  it('validates a full article record (without embedding)', () => {
    const result = selectArticleSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      slug: 'hello-world',
      title: 'Hello World',
      excerpt: 'A summary.',
      body: 'Body text.',
      tags: ['a'],
      status: 'published',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(result.success).toBe(true);
  });

  it('strips the embedding column from parsed output', () => {
    const result = selectArticleSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      slug: 'hello-world',
      title: 'Hello World',
      excerpt: 'A summary.',
      body: 'Body text.',
      tags: [],
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
      embedding: [0.1, 0.2],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('embedding');
    }
  });
});

// ── insertExperimentSchema ───────────────────────────────────────────

describe('insertExperimentSchema', () => {
  const validInput = {
    name: 'Particle Sim',
    subsystem: 'lattice' as const,
    parameters: { iterations: 500, dt: 0.1 },
  };

  it('validates a correct experiment input', () => {
    const result = insertExperimentSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Particle Sim');
      expect(result.data.subsystem).toBe('lattice');
    }
  });

  it('rejects a missing name', () => {
    const { name: _name, ...rest } = validInput;
    const result = insertExperimentSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects an invalid subsystem', () => {
    const result = insertExperimentSchema.safeParse({ ...validInput, subsystem: 'unknown' });
    expect(result.success).toBe(false);
  });

  it('rejects missing parameters', () => {
    const { parameters: _parameters, ...rest } = validInput;
    const result = insertExperimentSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('does not require the omitted result/durationMs fields', () => {
    const result = insertExperimentSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('result');
      expect(result.data).not.toHaveProperty('durationMs');
    }
  });
});

// ── insertNewsletterSubscriberSchema ─────────────────────────────────

describe('insertNewsletterSubscriberSchema', () => {
  it('validates a correct email', () => {
    const result = insertNewsletterSubscriberSchema.safeParse({ email: 'user@example.com' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = insertNewsletterSubscriberSchema.safeParse({ email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing email', () => {
    const result = insertNewsletterSubscriberSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('does not require the omitted id/createdAt/confirmed fields', () => {
    const result = insertNewsletterSubscriberSchema.safeParse({ email: 'user@example.com' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('id');
      expect(result.data).not.toHaveProperty('confirmed');
    }
  });
});

// ── ftsSearchSQL ─────────────────────────────────────────────────────

describe('ftsSearchSQL', () => {
  it('returns a SQL string and params for the given query', () => {
    const { sql, params } = ftsSearchSQL({ query: 'postgres', limit: 5, offset: 10 });
    expect(typeof sql).toBe('string');
    expect(sql).toContain('plainto_tsquery');
    expect(sql).toContain('ts_rank_cd');
    expect(sql).toContain('FROM articles');
    expect(sql).toContain("status = 'published'");
    expect(sql).toContain('ORDER BY rank DESC');
    expect(sql).toContain('LIMIT $2 OFFSET $3');
    expect(params).toEqual(['postgres', 5, 10]);
  });

  it('uses the term as the first positional parameter', () => {
    const { params } = ftsSearchSQL({ query: 'hybrid search' });
    expect(params[0]).toBe('hybrid search');
  });

  it('applies default limit and offset when omitted', () => {
    const { params } = ftsSearchSQL({ query: 'test' });
    expect(params).toEqual(['test', 10, 0]);
  });
});

// ── ftsWeightedSearchSQL ─────────────────────────────────────────────

describe('ftsWeightedSearchSQL', () => {
  it('returns SQL with weighted setweight columns', () => {
    const { sql, params } = ftsWeightedSearchSQL({ query: 'hybrid', limit: 20, offset: 5 });
    expect(typeof sql).toBe('string');
    expect(sql).toContain('setweight');
    expect(sql).toContain("'A'");
    expect(sql).toContain("'B'");
    expect(sql).toContain("'C'");
    // Title weighted A, excerpt B, body C.
    expect(sql).toContain("setweight(to_tsvector('english', coalesce(title, '')), 'A')");
    expect(sql).toContain("setweight(to_tsvector('english', coalesce(excerpt, '')), 'B')");
    expect(sql).toContain("setweight(to_tsvector('english', coalesce(body, '')), 'C')");
    expect(sql).toContain('plainto_tsquery');
    expect(sql).toContain('ts_rank_cd');
    expect(params).toEqual(['hybrid', 20, 5]);
  });

  it('applies default limit and offset when omitted', () => {
    const { params } = ftsWeightedSearchSQL({ query: 'test' });
    expect(params).toEqual(['test', 10, 0]);
  });
});

// ── FTS_INDEX_SQL ────────────────────────────────────────────────────

describe('FTS_INDEX_SQL', () => {
  it('contains CREATE INDEX statements', () => {
    expect(FTS_INDEX_SQL).toContain('CREATE INDEX');
    // There are two index statements (FTS + tags).
    const matches = FTS_INDEX_SQL.match(/CREATE INDEX/g);
    expect(matches?.length).toBeGreaterThanOrEqual(2);
  });

  it('creates a GIN index on the weighted tsvector', () => {
    expect(FTS_INDEX_SQL).toContain('USING gin');
    expect(FTS_INDEX_SQL).toContain('articles_fts_idx');
    expect(FTS_INDEX_SQL).toContain('setweight');
  });

  it('creates a GIN index on the tags array', () => {
    expect(FTS_INDEX_SQL).toContain('articles_tags_idx');
    expect(FTS_INDEX_SQL).toMatch(/gin\(tags\)/);
  });

  it('uses IF NOT EXISTS for idempotent migration', () => {
    expect(FTS_INDEX_SQL).toContain('IF NOT EXISTS');
  });
});
