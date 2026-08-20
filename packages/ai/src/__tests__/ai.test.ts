/**
 * Unit tests for @substrate/ai — provider adapter, Workers AI provider
 * construction, and the hybrid retrieval + rerank pipeline.
 *
 * No external services are called: `fetch` is mocked and the Postgres
 * `db.query` used by `hybridRetrieval` is stubbed.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AIConfig, ProviderType } from '../config';
import { createWorkersAIProvider, providerAdapter } from '../provider-adapter';
import { hybridRetrieval, type RetrievalResult, rerank } from '../retrieval';

// ── providerAdapter ──────────────────────────────────────────────────

describe('providerAdapter', () => {
  it('returns a workers-ai adapter with model + workersAI functions', () => {
    const config: AIConfig = {
      defaultProvider: 'workers-ai',
      workersAI: { accountId: 'acc', apiToken: 'tok' },
    };
    const adapter = providerAdapter(config);

    expect(adapter.type).toBe('workers-ai');
    expect(typeof adapter.model).toBe('function');
    expect(typeof adapter.workersAI).toBe('function');

    // model() should delegate to the Workers AI provider and return an object
    // exposing a doGenerate function.
    const model = adapter.model('@cf/baai/bge-base-en-v1.5') as {
      doGenerate: unknown;
    };
    expect(typeof model).toBe('object');
    expect(typeof model.doGenerate).toBe('function');
  });

  it('returns a web-llm adapter whose model throws (must be client-initialised)', () => {
    const config: AIConfig = { defaultProvider: 'web-llm' };
    const adapter = providerAdapter(config);

    expect(adapter.type).toBe('web-llm');
    expect(() => adapter.model('Xenova/model')).toThrow(/WebLLM/);
  });

  it('returns a cloud adapter whose model echoes the modelId for openai', () => {
    const config: AIConfig = { defaultProvider: 'openai', openai: { apiKey: 'sk-x' } };
    const adapter = providerAdapter(config);

    expect(adapter.type).toBe('openai');
    expect(adapter.model('gpt-4o')).toBe('gpt-4o');
  });

  it('returns a cloud adapter for anthropic', () => {
    const config: AIConfig = { defaultProvider: 'anthropic', anthropic: { apiKey: 'sk-x' } };
    const adapter = providerAdapter(config);

    expect(adapter.type).toBe('anthropic');
    expect(adapter.model('claude-3-5-sonnet')).toBe('claude-3-5-sonnet');
  });

  it('returns a cloud adapter for google', () => {
    const config: AIConfig = { defaultProvider: 'google', google: { apiKey: 'key' } };
    const adapter = providerAdapter(config);

    expect(adapter.type).toBe('google');
    expect(adapter.model('gemini-1.5-pro')).toBe('gemini-1.5-pro');
  });

  it('falls back to a throwing model when workers-ai has no credentials', () => {
    const config: AIConfig = { defaultProvider: 'workers-ai' };
    const adapter = providerAdapter(config);

    expect(adapter.type).toBe('workers-ai');
    expect(adapter.workersAI).toBeUndefined();
    expect(() => adapter.model('m')).toThrow(/No provider configured/);
  });

  it('types cover every declared ProviderType', () => {
    const providers: ProviderType[] = ['openai', 'anthropic', 'google', 'workers-ai', 'web-llm'];
    for (const p of providers) {
      const adapter = providerAdapter({ defaultProvider: p });
      expect(adapter.type).toBe(p);
    }
  });
});

// ── createWorkersAIProvider ──────────────────────────────────────────

describe('createWorkersAIProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an object with a model function', () => {
    const provider = createWorkersAIProvider('acc', 'tok');
    expect(typeof provider).toBe('object');
    expect(typeof provider.model).toBe('function');
  });

  it('model() returns an object with a doGenerate function', () => {
    const provider = createWorkersAIProvider('acc', 'tok');
    const model = provider.model('@cf/meta/llama-3.1-8b-instruct');
    expect(typeof model).toBe('object');
    expect(typeof model.doGenerate).toBe('function');
  });

  it('doGenerate POSTs to the Cloudflare AI endpoint with auth + body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: async () => ({ result: 'ok' }),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    const provider = createWorkersAIProvider('acc123', 'tok456');
    const model = provider.model('@cf/meta/llama-3.1-8b-instruct');
    const output = await model.doGenerate({ prompt: 'hi', system: 'sys' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/accounts/acc123/ai/run/@cf/meta/llama-3.1-8b-instruct',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer tok456',
          'Content-Type': 'application/json',
        }),
      }),
    );
    const call = mockFetch.mock.calls[0]?.[1] as { body: string };
    const body = JSON.parse(call.body);
    expect(body).toEqual({ prompt: 'hi', system: 'sys' });
    expect(output).toEqual({ result: 'ok' });
  });
});

// ── hybridRetrieval ──────────────────────────────────────────────────

describe('hybridRetrieval', () => {
  // Shared search-table config — mimics an application's `articles` table.
  const searchTable = {
    name: 'articles',
    bodyColumn: 'body',
    statusColumn: 'status',
    publishedValue: 'published',
    embeddingColumn: 'embedding',
  } as const;

  it('returns results sorted by score descending', async () => {
    const ftsResults = [
      { id: 'a', score: 0.9 },
      { id: 'b', score: 0.5 },
    ];
    const vectorResults = [
      { id: 'a', score: 0.8 },
      { id: 'c', score: 0.7 },
    ];
    const db = {
      query: vi
        .fn<(sql: string, params: unknown[]) => Promise<unknown[]>>()
        .mockResolvedValueOnce(ftsResults)
        .mockResolvedValueOnce(vectorResults),
    };

    const results = await hybridRetrieval(
      { query: 'test', queryEmbedding: [0.1, 0.2], limit: 10 },
      { db, searchTable },
    );

    expect(results).toHaveLength(3);
    // 'a' ranks #1 in both lists → highest reciprocal-rank-fusion score.
    expect(results[0]?.id).toBe('a');
    // Scores are non-increasing.
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i]?.score ?? 0).toBeGreaterThanOrEqual(results[i + 1]?.score ?? 0);
    }
    // Every result is tagged as hybrid with a citation.
    for (const r of results) {
      expect(r.source).toBe('hybrid');
      expect(r.citation).toEqual({ type: 'search-result', ref: r.id });
    }
  });

  it('queries both FTS and vector channels when an embedding is available', async () => {
    const db = {
      query: vi.fn().mockResolvedValue([{ id: 'a', score: 0.5 }]),
    };
    await hybridRetrieval(
      { query: 'test', queryEmbedding: [0.1, 0.2], limit: 5 },
      { db, searchTable },
    );
    expect(db.query).toHaveBeenCalledTimes(2);
  });

  it('skips the vector channel when no embedding and no embed fn are provided', async () => {
    const db = { query: vi.fn().mockResolvedValue([{ id: 'a', score: 0.5 }]) };
    await hybridRetrieval({ query: 'test', limit: 5 }, { db, searchTable });
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it('handles empty results gracefully', async () => {
    const db = { query: vi.fn().mockResolvedValue([]) };
    const results = await hybridRetrieval(
      { query: 'nothing', queryEmbedding: [0.1], limit: 5 },
      { db, searchTable },
    );
    expect(results).toEqual([]);
  });

  it('respects the requested limit', async () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `id-${i}`, score: 1 - i * 0.01 }));
    const db = { query: vi.fn().mockResolvedValue(many) };
    const results = await hybridRetrieval(
      { query: 'test', queryEmbedding: [0.1], limit: 4 },
      { db, searchTable },
    );
    expect(results).toHaveLength(4);
  });

  it('uses an embed function when queryEmbedding is absent', async () => {
    const ftsResults = [{ id: 'a', score: 0.5 }];
    const vecResults = [{ id: 'a', score: 0.9 }];
    const db = {
      query: vi.fn().mockResolvedValueOnce(ftsResults).mockResolvedValueOnce(vecResults),
    };
    const embed = vi.fn().mockResolvedValue([0.4, 0.5, 0.6]);

    const results = await hybridRetrieval(
      { query: 'semantic', limit: 5 },
      { db, embed, searchTable },
    );

    expect(embed).toHaveBeenCalledWith('semantic');
    expect(db.query).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe('a');
  });
});

// ── rerank ───────────────────────────────────────────────────────────

describe('rerank', () => {
  const sampleResults: RetrievalResult[] = [
    { id: 'a', score: 0.9, source: 'hybrid', citation: { type: 'search-result', ref: 'a' } },
    { id: 'b', score: 0.5, source: 'hybrid', citation: { type: 'search-result', ref: 'b' } },
  ];

  it('returns the original results unchanged when no reranker is provided', async () => {
    const result = await rerank('query', sampleResults);
    expect(result).toBe(sampleResults); // same reference, no copy
  });

  it('applies reranker scores and sorts descending', async () => {
    const rerankerFn = vi.fn().mockResolvedValue([0.1, 0.95]);
    const result = await rerank('query', sampleResults, rerankerFn);

    expect(rerankerFn).toHaveBeenCalledWith('query', ['a', 'b']);
    expect(result).toHaveLength(2);
    // 'b' now has the higher score (0.95) so it moves to the front.
    expect(result[0]?.id).toBe('b');
    expect(result[0]?.score).toBe(0.95);
    expect(result[0]?.reranked).toBe(true);
    expect(result[1]?.id).toBe('a');
    expect(result[1]?.score).toBe(0.1);
    expect(result[1]?.reranked).toBe(true);
  });

  it('marks every reranked result with reranked: true', async () => {
    const rerankerFn = vi.fn().mockResolvedValue([0.3, 0.7]);
    const result = await rerank('query', sampleResults, rerankerFn);
    expect(result.every((r) => r.reranked === true)).toBe(true);
  });

  it('falls back to the original score when the reranker returns fewer scores', async () => {
    const rerankerFn = vi.fn().mockResolvedValue([0.42]); // only one score
    const result = await rerank('query', sampleResults, rerankerFn);
    // 'a' got the provided score (0.42); 'b' keeps its original score (0.5)
    // via the `?? r.score` fallback. Results are sorted descending, so 'b'
    // (0.5) comes first.
    const a = result.find((r) => r.id === 'a');
    const b = result.find((r) => r.id === 'b');
    expect(a?.score).toBe(0.42);
    expect(b?.score).toBe(0.5);
    expect(result[0]?.id).toBe('b');
  });

  it('handles an empty result list', async () => {
    const rerankerFn = vi.fn().mockResolvedValue([]);
    const result = await rerank('query', [], rerankerFn);
    expect(result).toEqual([]);
    expect(rerankerFn).toHaveBeenCalledWith('query', []);
  });
});
