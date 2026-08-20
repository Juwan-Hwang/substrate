/**
 * search-privacy.test.ts — I5: Search Privacy Enforcement.
 *
 * Tests:
 *  - anonymous + static → no server required (allowed)
 *  - authenticated + static → server required
 *  - static + server → server required
 *  - hybrid → server required
 *  - off → no server required
 *  - assertStaticIndexIsPublic with all-public items → passes
 *  - assertStaticIndexIsPublic with private item → throws SearchPrivacyViolation
 *  - authorizedSearch with null intent → empty results
 *  - authorizedSearch with non-null intent → passes intent to query executor
 */
import { describe, expect, it, vi } from 'vitest';
import {
  ANONYMOUS,
  type AuthorizationBundle,
  principal,
} from './authorization';
import {
  assertStaticIndexIsPublic,
  authorizedSearch,
  mustUseServer,
  SearchPrivacyViolation,
} from './search-privacy';

// ── mustUseServer ────────────────────────────────────────────────

describe('mustUseServer', () => {
  it('anonymous + static → false (allowed, no server needed)', () => {
    expect(mustUseServer('static', ANONYMOUS)).toBe(false);
  });

  it('authenticated + static → true (server required)', () => {
    const authed = principal('user-1', ['reader']);
    expect(mustUseServer('static', authed)).toBe(true);
  });

  it('static + server mode → true', () => {
    expect(mustUseServer('server', ANONYMOUS)).toBe(true);
  });

  it('hybrid mode → true (always goes through server)', () => {
    expect(mustUseServer('hybrid', ANONYMOUS)).toBe(true);
    expect(mustUseServer('hybrid', principal('u1', []))).toBe(true);
  });

  it('off mode → false (search disabled)', () => {
    expect(mustUseServer('off', ANONYMOUS)).toBe(false);
    expect(mustUseServer('off', principal('u1', []))).toBe(false);
  });
});

// ── assertStaticIndexIsPublic ────────────────────────────────────

describe('assertStaticIndexIsPublic', () => {
  const isPublic = (v: string) => v === 'public';

  it('passes when all items are public', () => {
    const items = [
      { visibility: 'public' },
      { visibility: 'public' },
    ];
    expect(() => assertStaticIndexIsPublic(items, isPublic)).not.toThrow();
  });

  it('throws SearchPrivacyViolation when a private item is in the index', () => {
    const items = [
      { visibility: 'public' },
      { visibility: 'private' },
    ];
    expect(() => assertStaticIndexIsPublic(items, isPublic)).toThrow(SearchPrivacyViolation);
  });

  it('throws when a restricted item is in the index', () => {
    const items = [{ visibility: 'restricted' }];
    expect(() => assertStaticIndexIsPublic(items, isPublic)).toThrow(SearchPrivacyViolation);
  });

  it('error message mentions the violating visibility', () => {
    const items = [{ visibility: 'private' }];
    try {
      assertStaticIndexIsPublic(items, isPublic);
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(SearchPrivacyViolation);
      expect((e as Error).message).toContain('private');
    }
  });

  it('passes on an empty index', () => {
    expect(() => assertStaticIndexIsPublic([], isPublic)).not.toThrow();
  });
});

// ── authorizedSearch ─────────────────────────────────────────────

describe('authorizedSearch', () => {
  function makeBundle(intent: unknown): AuthorizationBundle {
    return {
      policy: { decide: vi.fn(async () => ({ allow: true })) },
      buildQueryIntent: vi.fn(async () => intent),
      compilers: {},
    };
  }

  it('returns empty results when intent is null (no access)', async () => {
    const bundle = makeBundle(null);
    const result = await authorizedSearch(
      {
        query: 'hello',
        principal: principal('user-1', []),
        authBundle: bundle,
      },
      vi.fn(),
    );
    expect(result.results).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('passes intent to the query executor when intent is non-null', async () => {
    const intent = { filter: 'public_only' };
    const bundle = makeBundle(intent);
    const executor = vi.fn(async () => ({
      results: [{ id: '1', type: 'writing', title: 'Hello', excerpt: null, score: 1 }],
      total: 1,
    }));

    const result = await authorizedSearch(
      {
        query: 'hello',
        principal: principal('user-1', []),
        authBundle: bundle,
      },
      executor,
    );

    expect(executor).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'hello' }),
      intent,
    );
    expect(result.total).toBe(1);
    expect(result.results).toHaveLength(1);
  });
});
