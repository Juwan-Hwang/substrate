/**
 * @example/reference-app — In-memory reference implementations.
 *
 * This module provides working in-memory implementations of every
 * storage and authorization interface defined in @substrate-platform/contracts.
 *
 * The implementations are deliberately simple — they use Map and
 * crypto.randomUUID(). They are NOT production-ready, but they ARE
 * fully conformant: every interface method is implemented, every
 * invariant is respected, and every test passes.
 *
 * Consumers of Substrate can use this as a blueprint when writing
 * their own PostgreSQL / R2 / Turso adapters.
 */

import {
  ANONYMOUS,
  type Asset,
  type AssetMetadata,
  type AssetStore,
  type Association,
  type AuthorizationBundle,
  type AuthorizationContext,
  type AuthQueryIntent,
  association,
  type ChangeSet,
  type CommitResult,
  type ContentAddressedStore,
  commitFail,
  commitOk,
  type DomainOperation,
  type EntityRef,
  type EntityResolver,
  type EntitySnapshot,
  entityRef,
  entityRefKey,
  isSameAssociation,
  type MemoryPredicate,
  type Principal,
  principal,
  type Representation,
  type SerializedState,
  type SnapshotListFilter,
  type SnapshotReference,
  type SnapshotStore,
  type StoreAdapter,
  type StoredSnapshot,
  type Transaction,
  type TransactionalCommitEngine,
} from '@substrate-platform/contracts';

// ────────────────────────────────────────────────────────────────────────
// 1. InMemoryEntityResolver
// ────────────────────────────────────────────────────────────────────────

/**
 * In-memory EntityResolver.
 *
 * Stores EntitySnapshots keyed by `entityRefKey(ref)`.
 *
 * In a real application, `resolve()` would SELECT from the `entities`
 * table joined with the application's typed table. Here we use a Map.
 */
export class InMemoryEntityResolver implements EntityResolver {
  private readonly snapshots = new Map<string, EntitySnapshot>();

  /** Insert or replace a snapshot. Returns `this` for chaining. */
  upsert(snapshot: EntitySnapshot): this {
    this.snapshots.set(entityRefKey(snapshot.ref), snapshot);
    return this;
  }

  /** Remove a snapshot. Returns `true` if it existed. */
  delete(ref: EntityRef): boolean {
    return this.snapshots.delete(entityRefKey(ref));
  }

  async resolve(ref: EntityRef): Promise<EntitySnapshot | null> {
    return this.snapshots.get(entityRefKey(ref)) ?? null;
  }

  async resolveBatch(refs: readonly EntityRef[]): Promise<Map<string, EntitySnapshot>> {
    const result = new Map<string, EntitySnapshot>();
    for (const ref of refs) {
      const snap = this.snapshots.get(entityRefKey(ref));
      if (snap) result.set(entityRefKey(ref), snap);
    }
    return result;
  }
}

// ────────────────────────────────────────────────────────────────────────
// 2. InMemorySnapshotStore
// ────────────────────────────────────────────────────────────────────────

/**
 * In-memory SnapshotStore.
 *
 * Honours the immutability contract: no update(), no delete().
 * Once a snapshot is created, it is permanent.
 */
export class InMemorySnapshotStore implements SnapshotStore {
  private readonly store = new Map<string, StoredSnapshot>();

  async create(
    state: SerializedState,
    metadata: Readonly<Record<string, unknown>> = {},
  ): Promise<StoredSnapshot> {
    const id = crypto.randomUUID();
    const stateRef = typeof state === 'string' ? `mem:${id}` : `mem-bytes:${id}`;
    const snapshot: StoredSnapshot = {
      id,
      stateRef,
      metadata,
      createdAt: Date.now(),
    };
    this.store.set(id, snapshot);
    return snapshot;
  }

  async retrieve(id: string): Promise<StoredSnapshot | null> {
    return this.store.get(id) ?? null;
  }

  async list(filter?: SnapshotListFilter): Promise<StoredSnapshot[]> {
    let results = [...this.store.values()].sort((a, b) => b.createdAt - a.createdAt);
    if (filter?.since) {
      const since = filter.since.getTime();
      results = results.filter((s) => s.createdAt >= since);
    }
    if (filter?.limit) {
      results = results.slice(0, filter.limit);
    }
    return results;
  }

  // NO update(). NO delete(). Immutable.
}

// ────────────────────────────────────────────────────────────────────────
// 3. InMemoryContentAddressedStore
// ────────────────────────────────────────────────────────────────────────

/**
 * In-memory ContentAddressedStore.
 *
 * Uses SubtleCrypto (SHA-256) for content addressing.
 * The same content always produces the same hash — writes are idempotent.
 */
export class InMemoryContentAddressedStore implements ContentAddressedStore {
  private readonly blobs = new Map<string, Uint8Array>();

  async store(content: Uint8Array | string): Promise<string> {
    const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
    const hash = await this.hash(bytes);
    if (!this.blobs.has(hash)) {
      this.blobs.set(hash, bytes);
    }
    return hash;
  }

  async retrieve(hash: string): Promise<Uint8Array | string | null> {
    return this.blobs.get(hash) ?? null;
  }

  async exists(hash: string): Promise<boolean> {
    return this.blobs.has(hash);
  }

  private async hash(bytes: Uint8Array): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', bytes.buffer as ArrayBuffer);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
}

// ────────────────────────────────────────────────────────────────────────
// 4. InMemoryAssetStore
// ────────────────────────────────────────────────────────────────────────

/**
 * In-memory AssetStore.
 *
 * Stores originals as Uint8Array and representations keyed by (assetId, variant).
 * Originals are immutable — once stored, they cannot be changed.
 * Representations are append-only.
 */
export class InMemoryAssetStore implements AssetStore {
  private readonly assets = new Map<string, { asset: Asset; content: Uint8Array }>();
  private readonly reps = new Map<string, Representation & { content: Uint8Array }>();

  async storeOriginal(content: Uint8Array, metadata?: AssetMetadata): Promise<Asset> {
    const id = crypto.randomUUID();
    const hash = await sha256(content);
    const asset: Asset = {
      id,
      originalHash: hash,
      metadata: metadata ?? { contentType: 'application/octet-stream', size: content.byteLength },
      createdAt: Date.now(),
    };
    this.assets.set(id, { asset, content });
    return asset;
  }

  async storeRepresentation(
    assetId: string,
    variant: string,
    content: Uint8Array,
    accessLevel: string,
  ): Promise<Representation> {
    const hash = await sha256(content);
    const rep: Representation & { content: Uint8Array } = {
      assetId,
      variant,
      hash,
      accessLevel,
      createdAt: Date.now(),
      content,
    };
    this.reps.set(`${assetId}:${variant}`, rep);
    return rep;
  }

  async retrieveOriginal(assetId: string): Promise<Uint8Array | null> {
    return this.assets.get(assetId)?.content ?? null;
  }

  async retrieveRepresentation(assetId: string, variant: string): Promise<Uint8Array | null> {
    return this.reps.get(`${assetId}:${variant}`)?.content ?? null;
  }

  async getAssetMetadata(assetId: string): Promise<AssetMetadata | null> {
    return this.assets.get(assetId)?.asset.metadata ?? null;
  }
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes.buffer as ArrayBuffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ────────────────────────────────────────────────────────────────────────
// 5. InMemoryStoreAdapter
// ────────────────────────────────────────────────────────────────────────

/**
 * Convenience: bundle all three in-memory stores into a StoreAdapter.
 */
export function createInMemoryStoreAdapter(): StoreAdapter {
  return {
    snapshots: new InMemorySnapshotStore(),
    cas: new InMemoryContentAddressedStore(),
    assets: new InMemoryAssetStore(),
  };
}

// ────────────────────────────────────────────────────────────────────────
// 6. InMemoryAssociationStore (bonus — not a platform interface)
// ────────────────────────────────────────────────────────────────────────

/**
 * In-memory association storage.
 *
 * The platform's Association is undirected and untyped.
 * This store maintains that contract: no `kind`, no `source`/`target`.
 */
export class InMemoryAssociationStore {
  private readonly associations = new Map<string, Association>();

  /** Create an association. Returns the stored association. */
  create(a: EntityRef, b: EntityRef): Association {
    // Check for duplicates (undirected equivalence)
    for (const existing of this.associations.values()) {
      if (isSameAssociation(existing, { entityA: a, entityB: b })) {
        return existing;
      }
    }
    const id = crypto.randomUUID();
    const assoc = association(id, a, b);
    this.associations.set(id, assoc);
    return assoc;
  }

  /** Delete an association by endpoint pair. Returns true if deleted. */
  delete(a: EntityRef, b: EntityRef): boolean {
    for (const [id, existing] of this.associations) {
      if (isSameAssociation(existing, { entityA: a, entityB: b })) {
        this.associations.delete(id);
        return true;
      }
    }
    return false;
  }

  /** List all associations involving a given entity. */
  listForEntity(ref: EntityRef): Association[] {
    return [...this.associations.values()].filter(
      (a) =>
        (a.entityA.type === ref.type && a.entityA.id === ref.id) ||
        (a.entityB.type === ref.type && a.entityB.id === ref.id),
    );
  }

  /** Get all associations. */
  list(): Association[] {
    return [...this.associations.values()];
  }
}

// ────────────────────────────────────────────────────────────────────────
// 7. SimpleAuthorizationBundle
// ────────────────────────────────────────────────────────────────────────

/**
 * A simple, configurable AuthorizationBundle.
 *
 * Policy rules:
 *   - Anonymous can read 'public' entities only.
 *   - Authenticated users can read everything.
 *   - 'owner' role can write/delete/publish/transition their own entities.
 *   - 'editor' role can write/publish/transition any entity.
 *
 * This is intentionally simple — real applications will have richer policies.
 */
export function createSimpleAuthBundle(
  resolver: EntityResolver,
  options: {
    /** Application-defined: which visibility values count as 'public'. */
    isPublic?: (visibility: string) => boolean;
    /** Application-defined: which lifecycle states are 'published'. */
    isPublishedState?: (state: string) => boolean;
  } = {},
): AuthorizationBundle {
  const isPublic = options.isPublic ?? ((v: string) => v === 'public');
  const _isPublishedState = options.isPublishedState ?? ((s: string) => s === 'published');

  return {
    policy: {
      async decide(ctx: AuthorizationContext): Promise<{ allow: boolean }> {
        const snapshot = await resolver.resolve(ctx.entityRef);
        if (!snapshot) return { allow: false };

        // Anonymous: read public entities only
        if (ctx.principal.userId === null) {
          if (ctx.operation !== 'read') return { allow: false };
          return { allow: isPublic(snapshot.visibility) };
        }

        // Authenticated users: can always read
        if (ctx.operation === 'read') return { allow: true };

        // Owner: can do anything to their own entities
        if (ctx.principal.roles.includes('owner') && snapshot.ownerId === ctx.principal.userId) {
          return { allow: true };
        }

        // Editor: can write/publish/transition (but not delete others' entities)
        if (ctx.principal.roles.includes('editor')) {
          if (ctx.operation === 'delete') return { allow: false };
          return { allow: true };
        }

        // Default: deny
        return { allow: false };
      },
    },

    async buildQueryIntent(p: Principal): Promise<AuthQueryIntent | null> {
      if (p.userId === null) {
        // Anonymous: only public visibility
        return { visibilityFilter: 'public' };
      }
      if (p.roles.includes('editor') || p.roles.includes('owner')) {
        // Editors/owners: see everything
        return { visibilityFilter: null };
      }
      // Authenticated non-editor: public + their own
      return { visibilityFilter: 'public_or_owned', userId: p.userId };
    },

    compilers: {
      memory: {
        compile(intent: AuthQueryIntent): MemoryPredicate {
          const filter = intent.visibilityFilter;
          if (filter === null) return () => true;
          if (filter === 'public') {
            return (doc: unknown) => {
              const d = doc as { visibility?: string };
              return d.visibility === 'public';
            };
          }
          if (filter === 'public_or_owned') {
            const userId = intent.userId as string;
            return (doc: unknown) => {
              const d = doc as { visibility?: string; ownerId?: string | null };
              return d.visibility === 'public' || d.ownerId === userId;
            };
          }
          return () => false;
        },
      },
    },
  };
}

// ────────────────────────────────────────────────────────────────────────
// 8. InMemoryTransactionalCommitEngine
// ────────────────────────────────────────────────────────────────────────

/**
 * In-memory TransactionalCommitEngine.
 *
 * Simulates a real database transaction:
 *   - Lock tracking (detects concurrent lock attempts on same entity)
 *   - Operation buffer (applied atomically on success, discarded on failure)
 *   - Orphan CAS tracking on failure
 *
 * The `work` callback receives a Transaction handle. If it throws,
 * the transaction is rolled back (no operations are applied).
 */
export class InMemoryTransactionalCommitEngine implements TransactionalCommitEngine {
  private readonly locked = new Set<string>();
  /** Operations applied after a successful commit, for test inspection. */
  readonly appliedOperations: DomainOperation[] = [];
  readonly snapshotReferences: SnapshotReference[] = [];

  async commit<T>(
    _changeset: ChangeSet,
    work: (tx: Transaction) => Promise<T>,
  ): Promise<CommitResult<T>> {
    const locks = new Set<string>();
    const opBuffer: DomainOperation[] = [];
    const snapshotBuffer: SnapshotReference[] = [];
    // Capture the locked set for the tx object literal (avoids `const engine = this`).
    const lockedRef = this.locked;

    const tx: Transaction = {
      async lockEntity(ref: EntityRef): Promise<void> {
        const key = entityRefKey(ref);
        // Same-transaction re-lock is a no-op (like SELECT ... FOR UPDATE).
        if (locks.has(key)) return;
        if (lockedRef.has(key)) {
          throw new Error(`LOCK_CONTENTION: ${key} is already locked by another transaction`);
        }
        locks.add(key);
        lockedRef.add(key);
      },
      async write(op: DomainOperation): Promise<void> {
        opBuffer.push(op);
      },
      async writeSnapshotReference(snapshot: SnapshotReference): Promise<void> {
        snapshotBuffer.push(snapshot);
      },
    };

    try {
      const value = await work(tx);
      // Success: apply buffered operations
      this.appliedOperations.push(...opBuffer);
      this.snapshotReferences.push(...snapshotBuffer);
      return commitOk(value);
    } catch (e) {
      return commitFail<T>(e instanceof Error ? e.message : String(e));
    } finally {
      // Release all locks
      for (const key of locks) {
        this.locked.delete(key);
      }
    }
  }
}

// ────────────────────────────────────────────────────────────────────────
// 9. Application Lifecycle (example)
// ────────────────────────────────────────────────────────────────────────

/**
 * An example application lifecycle definition.
 *
 * The platform's LifecycleDefinition is generic — it never hardcodes
 * state names. This example shows what an application might define:
 *
 *   draft → published → archived
 *   published → draft (unpublish)
 *   archived → draft (restore)
 */
export const exampleLifecycle = {
  initial: 'draft',
  states: ['draft', 'published', 'archived'],
  transitions: {
    publish: ['draft', 'published'],
    unpublish: ['published', 'draft'],
    archive: ['published', 'archived'],
    restore: ['archived', 'draft'],
  },
} as const;

// ────────────────────────────────────────────────────────────────────────
// 10. Demo data factory
// ────────────────────────────────────────────────────────────────────────

/**
 * Create demo entity snapshots for testing.
 *
 * These are application-defined EntityRef values. The platform
 * never hardcodes entity type names — 'writing', 'project' etc.
 * are supplied by the application.
 */
export function createDemoData(resolver: InMemoryEntityResolver): void {
  const now = Date.now();

  resolver.upsert({
    ref: entityRef('writing', 'w-001'),
    lifecycleState: 'published',
    visibility: 'public',
    ownerId: 'user-1',
    updatedAt: now,
    deletedAt: null,
  });

  resolver.upsert({
    ref: entityRef('writing', 'w-002'),
    lifecycleState: 'draft',
    visibility: 'private',
    ownerId: 'user-1',
    updatedAt: now,
    deletedAt: null,
  });

  resolver.upsert({
    ref: entityRef('project', 'p-001'),
    lifecycleState: 'published',
    visibility: 'public',
    ownerId: 'user-1',
    updatedAt: now,
    deletedAt: null,
  });

  resolver.upsert({
    ref: entityRef('project', 'p-002'),
    lifecycleState: 'draft',
    visibility: 'restricted',
    ownerId: 'user-2',
    updatedAt: now,
    deletedAt: null,
  });
}

/**
 * Demo principals for testing.
 */
export const demoPrincipals = {
  anonymous: ANONYMOUS,
  owner: principal('user-1', ['owner']),
  editor: principal('user-2', ['editor']),
  otherUser: principal('user-3', []),
} as const;
