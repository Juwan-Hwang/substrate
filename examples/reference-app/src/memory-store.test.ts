/**
 * Tests for the in-memory reference implementations.
 *
 * These tests verify that every interface from @substrate/contracts
 * is correctly implemented by the in-memory adapters. They serve as
 * both validation and documentation — consumers can see exactly how
 * each interface is expected to behave.
 */

import {
  ANONYMOUS,
  assertStaticIndexIsPublic,
  authorizedSearch,
  availableTransitions,
  buildImpact,
  buildPreview,
  confirmPreview,
  createChangeSet,
  type EntityRef,
  entityRef,
  entityRefKey,
  executePublish,
  isSameAssociation,
  mustUseServer,
  principal,
  resolveTransition,
  type SnapshotReference,
  validateLifecycle,
} from '@substrate/contracts';
import { describe, expect, it } from 'vitest';
import {
  createDemoData,
  createSimpleAuthBundle,
  demoPrincipals,
  exampleLifecycle,
  InMemoryAssetStore,
  InMemoryAssociationStore,
  InMemoryContentAddressedStore,
  InMemoryEntityResolver,
  InMemorySnapshotStore,
  InMemoryTransactionalCommitEngine,
} from './memory-store';

// ── EntityResolver ────────────────────────────────────────────────────

describe('InMemoryEntityResolver', () => {
  it('resolves a single entity', async () => {
    const resolver = new InMemoryEntityResolver();
    createDemoData(resolver);

    const snap = await resolver.resolve(entityRef('writing', 'w-001'));
    expect(snap).not.toBeNull();
    expect(snap?.lifecycleState).toBe('published');
    expect(snap?.visibility).toBe('public');
  });

  it('returns null for unknown entities', async () => {
    const resolver = new InMemoryEntityResolver();
    const snap = await resolver.resolve(entityRef('writing', 'nonexistent'));
    expect(snap).toBeNull();
  });

  it('resolves a batch by (type, id) composite key', async () => {
    const resolver = new InMemoryEntityResolver();
    createDemoData(resolver);

    const refs: EntityRef[] = [
      entityRef('writing', 'w-001'),
      entityRef('project', 'p-001'),
      entityRef('writing', 'nonexistent'),
    ];
    const batch = await resolver.resolveBatch(refs);

    expect(batch.size).toBe(2);
    expect(batch.has(entityRefKey(entityRef('writing', 'w-001')))).toBe(true);
    expect(batch.has(entityRefKey(entityRef('project', 'p-001')))).toBe(true);
    expect(batch.has(entityRefKey(entityRef('writing', 'nonexistent')))).toBe(false);
  });
});

// ── SnapshotStore ──────────────────────────────────────────────────────

describe('InMemorySnapshotStore', () => {
  it('creates and retrieves snapshots', async () => {
    const store = new InMemorySnapshotStore();
    const snap = await store.create('{"state":"v1"}', { version: 1 });
    expect(snap.id).toBeTruthy();
    expect(snap.stateRef).toContain('mem:');

    const retrieved = await store.retrieve(snap.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.metadata.version).toBe(1);
  });

  it('lists snapshots in descending order', async () => {
    const store = new InMemorySnapshotStore();
    await store.create('a');
    await store.create('b');
    await store.create('c');

    const list = await store.list();
    expect(list.length).toBe(3);
    // Descending — newest first
    expect(list[0]).toBeDefined();
    expect(list[1]).toBeDefined();
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    expect(list[0]!.createdAt).toBeGreaterThanOrEqual(list[1]!.createdAt);
  });

  it('respects the limit filter', async () => {
    const store = new InMemorySnapshotStore();
    await store.create('a');
    await store.create('b');
    await store.create('c');

    const list = await store.list({ limit: 2 });
    expect(list.length).toBe(2);
  });

  it('respects the since filter', async () => {
    const store = new InMemorySnapshotStore();
    await store.create('a');
    // Wait 15ms so the second snapshot has a strictly later timestamp
    await new Promise((r) => setTimeout(r, 15));
    const before = new Date();
    await new Promise((r) => setTimeout(r, 15));
    await store.create('b');

    const list = await store.list({ since: before });
    expect(list.length).toBe(1);
  });

  it('returns null for unknown snapshot ID', async () => {
    const store = new InMemorySnapshotStore();
    const result = await store.retrieve('nonexistent');
    expect(result).toBeNull();
  });

  it('has no update or delete methods (immutability)', () => {
    const store = new InMemorySnapshotStore();
    expect('update' in store).toBe(false);
    expect('delete' in store).toBe(false);
  });
});

// ── ContentAddressedStore ─────────────────────────────────────────────

describe('InMemoryContentAddressedStore', () => {
  it('stores content and returns a hash', async () => {
    const cas = new InMemoryContentAddressedStore();
    const hash = await cas.store('hello world');
    expect(hash).toBeTruthy();
    expect(hash.length).toBe(64); // SHA-256 hex
  });

  it('is idempotent: same content → same hash', async () => {
    const cas = new InMemoryContentAddressedStore();
    const hash1 = await cas.store('hello world');
    const hash2 = await cas.store('hello world');
    expect(hash1).toBe(hash2);
  });

  it('retrieves content by hash', async () => {
    const cas = new InMemoryContentAddressedStore();
    const hash = await cas.store('hello world');
    const content = await cas.retrieve(hash);
    expect(content).not.toBeNull();
    expect(content instanceof Uint8Array).toBe(true);
    expect(new TextDecoder().decode(content as Uint8Array)).toBe('hello world');
  });

  it('returns null for unknown hash', async () => {
    const cas = new InMemoryContentAddressedStore();
    const content = await cas.retrieve('nonexistent');
    expect(content).toBeNull();
  });

  it('checks existence by hash', async () => {
    const cas = new InMemoryContentAddressedStore();
    const hash = await cas.store('hello');
    expect(await cas.exists(hash)).toBe(true);
    expect(await cas.exists('nonexistent')).toBe(false);
  });

  it('has no update or delete methods (immutability)', () => {
    const cas = new InMemoryContentAddressedStore();
    expect('update' in cas).toBe(false);
    expect('delete' in cas).toBe(false);
  });
});

// ── AssetStore ─────────────────────────────────────────────────────────

describe('InMemoryAssetStore', () => {
  it('stores original assets and retrieves them', async () => {
    const store = new InMemoryAssetStore();
    const content = new Uint8Array([1, 2, 3, 4, 5]);
    const asset = await store.storeOriginal(content, {
      contentType: 'image/png',
      size: content.byteLength,
    });

    expect(asset.id).toBeTruthy();
    expect(asset.metadata.contentType).toBe('image/png');
    expect(asset.originalHash.length).toBe(64);

    const retrieved = await store.retrieveOriginal(asset.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.byteLength).toBe(content.byteLength);
  });

  it('stores and retrieves representations', async () => {
    const store = new InMemoryAssetStore();
    const original = new Uint8Array([1, 2, 3, 4, 5]);
    const asset = await store.storeOriginal(original);

    const thumb = new Uint8Array([10, 20]);
    await store.storeRepresentation(asset.id, 'thumbnail', thumb, 'public');

    const retrieved = await store.retrieveRepresentation(asset.id, 'thumbnail');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.byteLength).toBe(2);
  });

  it('returns null for unknown asset', async () => {
    const store = new InMemoryAssetStore();
    expect(await store.retrieveOriginal('nonexistent')).toBeNull();
    expect(await store.getAssetMetadata('nonexistent')).toBeNull();
  });

  it('returns null for unknown representation', async () => {
    const store = new InMemoryAssetStore();
    const original = new Uint8Array([1, 2, 3]);
    const asset = await store.storeOriginal(original);

    expect(await store.retrieveRepresentation(asset.id, 'nonexistent')).toBeNull();
  });
});

// ── AssociationStore ──────────────────────────────────────────────────

describe('InMemoryAssociationStore', () => {
  it('creates undirected associations', () => {
    const store = new InMemoryAssociationStore();
    const a = entityRef('writing', 'w-001');
    const b = entityRef('project', 'p-001');

    const assoc = store.create(a, b);
    expect(assoc.entityA).toEqual(a);
    expect(assoc.entityB).toEqual(b);
  });

  it('prevents duplicate associations (undirected equivalence)', () => {
    const store = new InMemoryAssociationStore();
    const a = entityRef('writing', 'w-001');
    const b = entityRef('project', 'p-001');

    const first = store.create(a, b);
    const second = store.create(b, a); // Reversed order — same association

    expect(first.id).toBe(second.id);
  });

  it('lists associations for an entity', () => {
    const store = new InMemoryAssociationStore();
    const a = entityRef('writing', 'w-001');
    const b = entityRef('project', 'p-001');
    const c = entityRef('writing', 'w-002');

    store.create(a, b);
    store.create(a, c);

    const list = store.listForEntity(a);
    expect(list.length).toBe(2);
  });

  it('deletes associations by endpoint pair', () => {
    const store = new InMemoryAssociationStore();
    const a = entityRef('writing', 'w-001');
    const b = entityRef('project', 'p-001');

    store.create(a, b);
    expect(store.list().length).toBe(1);

    const deleted = store.delete(a, b);
    expect(deleted).toBe(true);
    expect(store.list().length).toBe(0);
  });

  it('isSameAssociation respects undirected equality', () => {
    const a = entityRef('writing', 'w-001');
    const b = entityRef('project', 'p-001');

    expect(isSameAssociation({ entityA: a, entityB: b }, { entityA: b, entityB: a })).toBe(true);
  });
});

// ── AuthorizationBundle ───────────────────────────────────────────────

describe('createSimpleAuthBundle', () => {
  const setup = () => {
    const resolver = new InMemoryEntityResolver();
    createDemoData(resolver);
    const bundle = createSimpleAuthBundle(resolver);
    return { resolver, bundle };
  };

  it('allows anonymous to read public entities', async () => {
    const { bundle } = setup();
    const decision = await bundle.policy.decide({
      principal: demoPrincipals.anonymous,
      entityRef: entityRef('writing', 'w-001'),
      operation: 'read',
    });
    expect(decision.allow).toBe(true);
  });

  it('denies anonymous from reading private entities', async () => {
    const { bundle } = setup();
    const decision = await bundle.policy.decide({
      principal: demoPrincipals.anonymous,
      entityRef: entityRef('writing', 'w-002'),
      operation: 'read',
    });
    expect(decision.allow).toBe(false);
  });

  it('denies anonymous from writing', async () => {
    const { bundle } = setup();
    const decision = await bundle.policy.decide({
      principal: demoPrincipals.anonymous,
      entityRef: entityRef('writing', 'w-001'),
      operation: 'write',
    });
    expect(decision.allow).toBe(false);
  });

  it('allows owner to write their own entities', async () => {
    const { bundle } = setup();
    const decision = await bundle.policy.decide({
      principal: demoPrincipals.owner,
      entityRef: entityRef('writing', 'w-001'),
      operation: 'write',
    });
    expect(decision.allow).toBe(true);
  });

  it('allows editor to write but not delete', async () => {
    const { bundle } = setup();
    const writeDecision = await bundle.policy.decide({
      principal: demoPrincipals.editor,
      entityRef: entityRef('writing', 'w-001'),
      operation: 'write',
    });
    expect(writeDecision.allow).toBe(true);

    const deleteDecision = await bundle.policy.decide({
      principal: demoPrincipals.editor,
      entityRef: entityRef('writing', 'w-001'),
      operation: 'delete',
    });
    expect(deleteDecision.allow).toBe(false);
  });

  it('buildQueryIntent returns public-only for anonymous', async () => {
    const { bundle } = setup();
    const intent = await bundle.buildQueryIntent(demoPrincipals.anonymous);
    expect(intent).not.toBeNull();
    expect(intent?.visibilityFilter).toBe('public');
  });

  it('buildQueryIntent returns null filter for editor', async () => {
    const { bundle } = setup();
    const intent = await bundle.buildQueryIntent(demoPrincipals.editor);
    expect(intent).not.toBeNull();
    expect(intent?.visibilityFilter).toBeNull();
  });

  it('memory compiler produces correct predicate for public-only', () => {
    const { bundle } = setup();
    const intent = { visibilityFilter: 'public' } as const;
    const compiler = bundle.compilers.memory;
    expect(compiler).toBeDefined();
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    const predicate = compiler!.compile(intent);

    expect(predicate({ visibility: 'public' })).toBe(true);
    expect(predicate({ visibility: 'private' })).toBe(false);
  });

  it('memory compiler produces correct predicate for public_or_owned', () => {
    const { bundle } = setup();
    const intent = { visibilityFilter: 'public_or_owned', userId: 'user-1' };
    const compiler = bundle.compilers.memory;
    expect(compiler).toBeDefined();
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    const predicate = compiler!.compile(intent);

    expect(predicate({ visibility: 'public', ownerId: null })).toBe(true);
    expect(predicate({ visibility: 'private', ownerId: 'user-1' })).toBe(true);
    expect(predicate({ visibility: 'private', ownerId: 'user-2' })).toBe(false);
  });
});

// ── TransactionalCommitEngine ──────────────────────────────────────────

describe('InMemoryTransactionalCommitEngine', () => {
  it('commits successfully when work does not throw', async () => {
    const engine = new InMemoryTransactionalCommitEngine();
    const cs = createChangeSet(
      [
        {
          kind: 'update_entity',
          ref: entityRef('writing', 'w-001'),
          payload: { title: 'Updated' },
        },
      ],
      'user-1',
    );

    const result = await engine.commit(cs, async (tx) => {
      await tx.lockEntity(entityRef('writing', 'w-001'));
      await tx.write({
        kind: 'update_entity',
        ref: entityRef('writing', 'w-001'),
        payload: { title: 'Updated' },
      });
      return 'success';
    });

    expect(result.ok).toBe(true);
    expect(result.value).toBe('success');
    expect(engine.appliedOperations.length).toBe(1);
  });

  it('rolls back when work throws', async () => {
    const engine = new InMemoryTransactionalCommitEngine();
    const cs = createChangeSet([], 'user-1');

    const result = await engine.commit(cs, async () => {
      throw new Error('boom');
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('boom');
    expect(engine.appliedOperations.length).toBe(0);
  });

  it('releases locks after commit', async () => {
    const engine = new InMemoryTransactionalCommitEngine();
    const ref = entityRef('writing', 'w-001');
    const cs = createChangeSet([{ kind: 'update_entity', ref, payload: {} }], 'user-1');

    await engine.commit(cs, async (tx) => {
      await tx.lockEntity(ref);
      return null;
    });

    // Should be able to lock again after commit
    const result = await engine.commit(cs, async (tx) => {
      await tx.lockEntity(ref);
      return 'ok';
    });
    expect(result.ok).toBe(true);
  });

  it('releases locks after rollback', async () => {
    const engine = new InMemoryTransactionalCommitEngine();
    const ref = entityRef('writing', 'w-001');
    const cs = createChangeSet([], 'user-1');

    await engine.commit(cs, async (tx) => {
      await tx.lockEntity(ref);
      throw new Error('fail');
    });

    // Should be able to lock again after rollback
    const result = await engine.commit(cs, async (tx) => {
      await tx.lockEntity(ref);
      return 'ok';
    });
    expect(result.ok).toBe(true);
  });

  it('writes snapshot references', async () => {
    const engine = new InMemoryTransactionalCommitEngine();
    const cs = createChangeSet([], 'user-1');
    const snapshot: SnapshotReference = {
      snapshotId: 'snap-001',
      stateRef: 'cas:abc123',
      metadata: { version: 1 },
    };

    const result = await engine.commit(cs, async (tx) => {
      await tx.writeSnapshotReference(snapshot);
      return 'done';
    });

    expect(result.ok).toBe(true);
    expect(engine.snapshotReferences.length).toBe(1);
    expect(engine.snapshotReferences[0]?.snapshotId).toBe('snap-001');
  });
});

// ── Lifecycle ──────────────────────────────────────────────────────────

describe('exampleLifecycle', () => {
  it('is a valid lifecycle definition', () => {
    const result = validateLifecycle(exampleLifecycle);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('resolves transitions correctly', () => {
    expect(resolveTransition(exampleLifecycle, 'draft', 'publish')).toBe('published');
    expect(resolveTransition(exampleLifecycle, 'published', 'unpublish')).toBe('draft');
    expect(resolveTransition(exampleLifecycle, 'draft', 'unpublish')).toBeNull();
  });

  it('lists available transitions from a state', () => {
    const transitions = availableTransitions(exampleLifecycle, 'draft');
    expect(transitions).toEqual(['publish']);
  });
});

// ── Search Privacy ────────────────────────────────────────────────────

describe('Search Privacy', () => {
  it('mustUseServer returns false for off mode', () => {
    expect(mustUseServer('off', ANONYMOUS)).toBe(false);
  });

  it('mustUseServer returns true for server mode', () => {
    expect(mustUseServer('server', ANONYMOUS)).toBe(true);
  });

  it('mustUseServer returns true for hybrid mode', () => {
    expect(mustUseServer('hybrid', ANONYMOUS)).toBe(true);
  });

  it('mustUseServer returns false for static + anonymous', () => {
    expect(mustUseServer('static', ANONYMOUS)).toBe(false);
  });

  it('mustUseServer returns true for static + authenticated', () => {
    expect(mustUseServer('static', principal('user-1', []))).toBe(true);
  });

  it('assertStaticIndexIsPublic passes for public-only items', () => {
    const items = [{ visibility: 'public' }, { visibility: 'public' }];
    expect(() => assertStaticIndexIsPublic(items, (v) => v === 'public')).not.toThrow();
  });

  it('assertStaticIndexIsPublic throws for non-public items', () => {
    const items = [{ visibility: 'private' }];
    expect(() => assertStaticIndexIsPublic(items, (v) => v === 'public')).toThrow();
  });

  it('authorizedSearch returns empty for null intent', async () => {
    const resolver = new InMemoryEntityResolver();
    const bundle = createSimpleAuthBundle(resolver);

    const response = await authorizedSearch(
      {
        query: 'test',
        principal: ANONYMOUS,
        authBundle: { ...bundle, buildQueryIntent: async () => null },
      },
      async () => ({
        results: [{ id: '1', type: 'writing', title: 'Test', excerpt: null, score: 1 }],
        total: 1,
      }),
    );

    expect(response.total).toBe(0);
    expect(response.results.length).toBe(0);
  });
});

// ── Full Publish Protocol (integration) ───────────────────────────────

describe('executePublish (full two-phase protocol)', () => {
  it('successfully publishes a changeset', async () => {
    const resolver = new InMemoryEntityResolver();
    createDemoData(resolver);
    const authBundle = createSimpleAuthBundle(resolver);
    const commitEngine = new InMemoryTransactionalCommitEngine();
    const snapshotStore = new InMemorySnapshotStore();

    const ref = entityRef('writing', 'w-001');
    const changeset = createChangeSet(
      [{ kind: 'transition_lifecycle', ref, target: 'published' }],
      'user-1',
    );

    // Phase A: Build preview + impact
    const preview = buildPreview(
      [
        {
          ref,
          lifecycleState: 'published',
          visibility: 'public',
          ownerId: 'user-1',
          updatedAt: Date.now(),
          deletedAt: null,
        },
      ],
      JSON.stringify({ ref, state: 'published' }),
    );
    const impact = buildImpact(true, [ref], JSON.stringify({ public: true }));
    const confirmation = confirmPreview(preview, impact);

    // Execute publish
    const result = await executePublish(
      {
        authBundle,
        entityResolver: resolver,
        commitEngine,
        projectPreview: async () => preview,
        assessPublicImpact: async () => impact,
        reprojectAfterLock: async () => preview,
      },
      changeset,
      demoPrincipals.owner,
      confirmation,
      async (tx) => {
        await tx.lockEntity(ref);
        await tx.write({ kind: 'transition_lifecycle', ref, target: 'published' });
        const snap = await snapshotStore.create(preview.serializedState);
        await tx.writeSnapshotReference({
          snapshotId: snap.id,
          stateRef: snap.stateRef,
          metadata: { changesetId: changeset.id },
        });
        return { snapshotId: snap.id };
      },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value?.snapshotId).toBeTruthy();
    }
    expect(commitEngine.appliedOperations.length).toBe(1);
    expect(commitEngine.snapshotReferences.length).toBe(1);
  });

  it('fails on preview mismatch', async () => {
    const resolver = new InMemoryEntityResolver();
    createDemoData(resolver);
    const authBundle = createSimpleAuthBundle(resolver);
    const commitEngine = new InMemoryTransactionalCommitEngine();

    const ref = entityRef('writing', 'w-001');
    const changeset = createChangeSet(
      [{ kind: 'transition_lifecycle', ref, target: 'published' }],
      'user-1',
    );

    // Phase A: Preview says "published"
    const previewA = buildPreview(
      [
        {
          ref,
          lifecycleState: 'published',
          visibility: 'public',
          ownerId: 'user-1',
          updatedAt: Date.now(),
          deletedAt: null,
        },
      ],
      JSON.stringify({ state: 'published' }),
    );
    const impact = buildImpact(true, [ref], JSON.stringify({ public: true }));
    const confirmation = confirmPreview(previewA, impact);

    // Phase B: Reproject returns different state
    const previewB = buildPreview(
      [
        {
          ref,
          lifecycleState: 'archived',
          visibility: 'public',
          ownerId: 'user-1',
          updatedAt: Date.now(),
          deletedAt: null,
        },
      ],
      JSON.stringify({ state: 'archived' }),
    );

    const result = await executePublish(
      {
        authBundle,
        entityResolver: resolver,
        commitEngine,
        projectPreview: async () => previewA,
        assessPublicImpact: async () => impact,
        reprojectAfterLock: async () => previewB, // Different!
      },
      changeset,
      demoPrincipals.owner,
      confirmation,
      async () => 'should not reach',
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('preview_mismatch');
    }
  });

  it('fails on preflight denied', async () => {
    const resolver = new InMemoryEntityResolver();
    createDemoData(resolver);
    const authBundle = createSimpleAuthBundle(resolver);
    const commitEngine = new InMemoryTransactionalCommitEngine();

    const ref = entityRef('writing', 'w-002'); // Private entity
    const changeset = createChangeSet(
      [{ kind: 'transition_lifecycle', ref, target: 'published' }],
      'user-3',
    );

    const preview = buildPreview([], '{}');
    const impact = buildImpact(false, [], '{}');
    const confirmation = confirmPreview(preview, impact);

    const result = await executePublish(
      {
        authBundle,
        entityResolver: resolver,
        commitEngine,
        projectPreview: async () => preview,
        assessPublicImpact: async () => impact,
        reprojectAfterLock: async () => preview,
      },
      changeset,
      demoPrincipals.anonymous, // Anonymous cannot write
      confirmation,
      async () => 'should not reach',
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('preflight_denied');
    }
  });
});
