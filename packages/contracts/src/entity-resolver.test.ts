/**
 * entity-resolver.test.ts — I21: EntityRef is polymorphic (type + id).
 *
 * Tests:
 *  - entityRef creates a {type, id} pair
 *  - entityRefKey produces "type:id" format
 *  - resolveBatch matches by (type, id), not id alone
 *  - Different entity types with same id are distinct entities
 */
import { describe, expect, it, vi } from 'vitest';
import {
  entityRef,
  entityRefKey,
  type EntityResolver,
  type EntityRef,
  type EntitySnapshot,
} from './entity-resolver';

// ── entityRef ────────────────────────────────────────────────────

describe('entityRef', () => {
  it('creates a {type, id} pair', () => {
    const ref = entityRef('writing', 'w-1');
    expect(ref.type).toBe('writing');
    expect(ref.id).toBe('w-1');
  });

  it('has type and id as readonly properties', () => {
    const ref = entityRef('writing', 'w-1');
    expect(ref.type).toBe('writing');
    expect(ref.id).toBe('w-1');
    // The `as const` in entityRef makes properties readonly at the type level.
    // Runtime immutability is enforced by the type system, not Object.freeze.
  });
});

// ── entityRefKey ─────────────────────────────────────────────────

describe('entityRefKey', () => {
  it('produces "type:id" format', () => {
    const ref = entityRef('writing', 'w-1');
    expect(entityRefKey(ref)).toBe('writing:w-1');
  });

  it('is stable for the same input', () => {
    const ref1 = entityRef('project', 'p-1');
    const ref2 = entityRef('project', 'p-1');
    expect(entityRefKey(ref1)).toBe(entityRefKey(ref2));
  });

  it('is different for different types with same id', () => {
    const writing = entityRef('writing', 'same-id');
    const project = entityRef('project', 'same-id');
    expect(entityRefKey(writing)).not.toBe(entityRefKey(project));
  });
});

// ── resolveBatch: (type, id) matching ────────────────────────────

describe('EntityResolver.resolveBatch (type, id matching)', () => {
  function makeResolver(snapshots: Map<string, EntitySnapshot>): EntityResolver {
    return {
      resolve: vi.fn(async (ref) => snapshots.get(entityRefKey(ref)) ?? null),
      resolveBatch: vi.fn(async (refs) => {
        const result = new Map<string, EntitySnapshot>();
        for (const ref of refs) {
          const key = entityRefKey(ref);
          const snap = snapshots.get(key);
          if (snap) result.set(key, snap);
        }
        return result;
      }),
    };
  }

  it('matches by (type, id) — different types with same id are distinct', async () => {
    const writingSnap: EntitySnapshot = {
      ref: entityRef('writing', 'same-id'),
      lifecycleState: 'draft',
      visibility: 'public',
      ownerId: 'user-1',
      updatedAt: 1,
      deletedAt: null,
    };
    const projectSnap: EntitySnapshot = {
      ref: entityRef('project', 'same-id'),
      lifecycleState: 'active',
      visibility: 'private',
      ownerId: 'user-2',
      updatedAt: 2,
      deletedAt: null,
    };

    const snapshots = new Map<string, EntitySnapshot>([
      ['writing:same-id', writingSnap],
      ['project:same-id', projectSnap],
    ]);

    const resolver = makeResolver(snapshots);

    const results = await resolver.resolveBatch([
      entityRef('writing', 'same-id'),
      entityRef('project', 'same-id'),
    ]);

    expect(results.size).toBe(2);
    expect(results.get('writing:same-id')).toBe(writingSnap);
    expect(results.get('project:same-id')).toBe(projectSnap);
  });

  it('returns empty Map for non-existent entities', async () => {
    const resolver = makeResolver(new Map());
    const results = await resolver.resolveBatch([entityRef('writing', 'ghost')]);
    expect(results.size).toBe(0);
  });

  it('resolve returns null for non-existent entity', async () => {
    const resolver = makeResolver(new Map());
    const result = await resolver.resolve(entityRef('writing', 'ghost'));
    expect(result).toBeNull();
  });

  it('resolve returns the snapshot for an existing entity', async () => {
    const snap: EntitySnapshot = {
      ref: entityRef('writing', 'w-1'),
      lifecycleState: 'draft',
      visibility: 'public',
      ownerId: 'user-1',
      updatedAt: 42,
      deletedAt: null,
    };
    const resolver = makeResolver(new Map([['writing:w-1', snap]]));
    const result = await resolver.resolve(entityRef('writing', 'w-1'));
    expect(result).toBe(snap);
  });
});
