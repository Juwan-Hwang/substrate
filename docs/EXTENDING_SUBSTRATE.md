# Extending Substrate

> How to implement the platform's extension points: `EntityResolver`,
> `Store`, `AuthorizationBundle`, and how to register your own
> application capabilities.

The platform defines interfaces. The application provides
implementations. The platform never imports from your application
code — the dependency direction is always `Application → Platform`.

---

## 1. Implement `EntityResolver`

The platform needs to read entity metadata (lifecycle state,
visibility, owner) for authorization checks and publish preview
verification. It does not know your table names — you implement
the resolver that fetches from your typed tables.

### Interface

```ts
// @substrate/contracts

interface EntityRef {
  readonly type: string;   // application-defined: 'article', 'project', etc.
  readonly id: string;     // internal UUID
}

interface EntitySnapshot {
  readonly ref: EntityRef;
  readonly lifecycleState: string;   // your state name — platform doesn't interpret
  readonly visibility: string;       // your visibility level — platform doesn't interpret
  readonly ownerId: string | null;
  readonly updatedAt: number;         // epoch ms
  readonly deletedAt: number | null;  // soft-delete timestamp
}

interface EntityResolver {
  resolve(ref: EntityRef): Promise<EntitySnapshot | null>;
  resolveBatch(refs: readonly EntityRef[]): Promise<Map<string, EntitySnapshot>>;
}
```

### Implementation

```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import { articles } from '@/lib/db/schema';   // your typed table
import { entities } from '@substrate/db';      // platform's generic table
import type { EntityResolver, EntitySnapshot, EntityRef } from '@substrate/contracts';
import { entityRefKey } from '@substrate/contracts';

export function createResolver(db: ReturnType<typeof drizzle>): EntityResolver {
  async function resolve(ref: EntityRef): Promise<EntitySnapshot | null> {
    // 1. Query the platform's generic `entities` table for metadata.
    // 2. If the entity is soft-deleted, return the snapshot with deletedAt set.
    // 3. If not found, return null.
    const [row] = await db
      .select()
      .from(entities)
      .where(and(
        eq(entities.type, ref.type),
        eq(entities.id, ref.id),
      ))
      .limit(1);

    if (!row) return null;

    return {
      ref,
      lifecycleState: row.lifecycleState,
      visibility: row.visibility,
      ownerId: row.ownerId,
      updatedAt: row.updatedAt.getTime(),
      deletedAt: row.deletedAt?.getTime() ?? null,
    };
  }

  return {
    resolve,
    async resolveBatch(refs) {
      const results = new Map<string, EntitySnapshot>();
      // Batch query — match by (type, id) composite key, never by id alone.
      // Different entity types may have overlapping internal IDs.
      for (const ref of refs) {
        const snapshot = await resolve(ref);
        if (snapshot) results.set(entityRefKey(ref), snapshot);
      }
      return results;
    },
  };
}
```

### Rules

- **Match by `(type, id)` composite key** — never by `id` alone. Different
  entity types may have overlapping internal IDs.
- **Return `null`** if the entity does not exist or is purged.
- The platform calls `resolveBatch` during association loading and bulk
  permission checks. Optimise it to avoid N+1 queries.
- The platform calls `resolve` during publish preview verification and
  authorization revalidation (inside the transaction, after row lock).

---

## 2. Implement `Store`

The platform defines three storage interfaces. You implement the ones
your feature manifest enables.

### 2.1 `SnapshotStore` — immutable point-in-time state

Required when `snapshot: true` in the feature manifest.

```ts
interface SnapshotStore {
  create(
    state: SerializedState,
    metadata?: Readonly<Record<string, unknown>>,
  ): Promise<StoredSnapshot>;
  retrieve(id: string): Promise<StoredSnapshot | null>;
  list(filter?: SnapshotListFilter): Promise<StoredSnapshot[]>;
  // NO update(). NO delete(). Immutable.
}
```

```ts
import { r2 } from '@/lib/r2-client';   // your R2 client
import type { SnapshotStore, StoredSnapshot, SerializedState } from '@substrate/contracts';

export function createR2SnapshotStore(bucket: R2Bucket): SnapshotStore {
  return {
    async create(state, metadata) {
      const id = crypto.randomUUID();
      const stateRef = `sha256:${await hash(state)}`;
      await bucket.put(`snapshots/${id}`, state);

      return { id, stateRef, metadata: metadata ?? {}, createdAt: Date.now() };
    },

    async retrieve(id) {
      const obj = await bucket.get(`snapshots/${id}`);
      if (!obj) return null;
      const state = await obj.text();
      return {
        id,
        stateRef: obj.etag,
        metadata: {},
        createdAt: new Date(obj.uploaded).getTime(),
      };
    },

    async list(filter) {
      const listed = await bucket.list({ prefix: 'snapshots/' });
      const items = listed.objects.slice(0, filter?.limit ?? 100);
      // Sort by uploaded date descending.
      return items.map((obj) => ({
        id: obj.key.replace('snapshots/', ''),
        stateRef: obj.etag,
        metadata: {},
        createdAt: new Date(obj.uploaded).getTime(),
      }));
    },
  };
}
```

### 2.2 `ContentAddressedStore` — content-addressed blobs

Required when `contentAddressedStorage: true` (also requires
`snapshot: true`).

```ts
interface ContentAddressedStore {
  store(content: Uint8Array | string): Promise<Hash>;
  retrieve(hash: Hash): Promise<Uint8Array | string | null>;
  exists(hash: Hash): Promise<boolean>;
  // NO update(). NO delete(). Immutable.
}
```

```ts
export function createR2CasStore(bucket: R2Bucket): ContentAddressedStore {
  return {
    async store(content) {
      const hash = `sha256:${await sha256(content)}`;
      // Idempotent — storing the same content twice returns the same hash.
      await bucket.put(`cas/${hash}`, content);
      return hash;
    },

    async retrieve(hash) {
      const obj = await bucket.get(`cas/${hash}`);
      if (!obj) return null;
      return new Uint8Array(await obj.arrayBuffer());
    },

    async exists(hash) {
      const head = await bucket.head(`cas/${hash}`);
      return head !== null;
    },
  };
}
```

### 2.3 `AssetStore` — binary asset storage

Required when `assets: true` in the feature manifest.

```ts
interface AssetStore {
  storeOriginal(content: Uint8Array, metadata?: AssetMetadata): Promise<Asset>;
  storeRepresentation(
    assetId: string,
    variant: string,
    content: Uint8Array,
    accessLevel: string,
  ): Promise<Representation>;
  retrieveOriginal(assetId: string): Promise<Uint8Array | null>;
  retrieveRepresentation(assetId: string, variant: string): Promise<Uint8Array | null>;
  getAssetMetadata(assetId: string): Promise<AssetMetadata | null>;
}
```

`accessLevel` is application-defined (`'public'`, `'restricted'`, etc.).
The platform stores it but does not interpret it.

### 2.4 `StoreAdapter` — bundle them together

```ts
interface StoreAdapter {
  readonly snapshots: SnapshotStore;
  readonly cas?: ContentAddressedStore;
  readonly assets?: AssetStore;
}
```

At application startup, assemble the adapters you need:

```ts
import type { StoreAdapter } from '@substrate/contracts';

export function createStoreAdapter(): StoreAdapter {
  const bucket = getR2Bucket();
  return {
    snapshots: createR2SnapshotStore(bucket),
    cas: createR2CasStore(bucket),
    // assets: createR2AssetStore(bucket),  // when assets: true
  };
}
```

### Rules

- **Immutable** — `SnapshotStore` and `ContentAddressedStore` have no
  `update()` or `delete()`. Once written, data is permanent. This
  enforces historical immutability.
- **Idempotent writes** — storing the same content in CAS returns the
  same hash. Re-writes are no-ops.
- The platform's `@substrate/db` provides PostgreSQL-backed default
  implementations of all three. You can use them directly, or implement
  your own with any backend (R2, S3, filesystem, in-memory for tests).

---

## 3. Implement `AuthorizationBundle`

The authorization engine has two layers:

1. **Semantic layer** — "can this principal perform this operation on
   this entity?" → `boolean`
2. **Query enforcement layer** — "what can this principal see in bulk?"
   → backend-specific query fragment

You implement both in a single `AuthorizationBundle` and register it
at startup.

### Interface

```ts
interface Principal {
  readonly userId: string | null;   // null = anonymous
  readonly roles: readonly string[];  // application-defined: 'owner', 'editor', etc.
}

interface AuthorizationContext {
  readonly principal: Principal;
  readonly entityRef: EntityRef;
  readonly operation: 'read' | 'write' | 'delete' | 'publish' | 'transition';
}

interface AuthorizationDecision {
  readonly allow: boolean;
}

interface AuthorizationPolicy {
  decide(ctx: AuthorizationContext): Promise<AuthorizationDecision>;
}

interface ConstraintCompiler<TQueryFragment> {
  compile(intent: AuthQueryIntent): TQueryFragment;
}

interface AuthorizationBundle {
  readonly policy: AuthorizationPolicy;
  readonly buildQueryIntent: (principal: Principal) => Promise<AuthQueryIntent | null>;
  readonly compilers: {
    readonly postgres?: ConstraintCompiler<SqlFragment>;
    readonly orama?: ConstraintCompiler<OramaFilter>;
    readonly memory?: ConstraintCompiler<MemoryPredicate>;
  };
}
```

### Implementation

```ts
import { and, eq } from 'drizzle-orm';
import { entities } from '@substrate/db';
import {
  ANONYMOUS,
  type AuthorizationBundle,
  type AuthorizationContext,
  type AuthorizationDecision,
  type OramaFilter,
  type Principal,
  type SqlFragment,
} from '@substrate/contracts';

// ── Semantic layer ──────────────────────────────────────────────────

async function decide(ctx: AuthorizationContext): Promise<AuthorizationDecision> {
  const { principal, entityRef, operation } = ctx;

  // Anonymous can only read public entities.
  if (principal.userId === null) {
    if (operation === 'read') {
      const [entity] = await db
        .select({ visibility: entities.visibility })
        .from(entities)
        .where(and(
          eq(entities.type, entityRef.type),
          eq(entities.id, entityRef.id),
        ))
        .limit(1);
      return { allow: entity?.visibility === 'public' };
    }
    return { allow: false };
  }

  // Owner can do anything with their own entities.
  const [entity] = await db
    .select({ ownerId: entities.ownerId })
    .from(entities)
    .where(and(
      eq(entities.type, entityRef.type),
      eq(entities.id, entityRef.id),
    ))
    .limit(1);

  if (entity?.ownerId === principal.userId) {
    return { allow: true };
  }

  // Editors can write but not delete.
  if (principal.roles.includes('editor') && operation !== 'delete') {
    return { allow: true };
  }

  return { allow: false };
}

// ── Query intent ────────────────────────────────────────────────────

// AuthQueryIntent is an opaque, serializable object. The platform does
// not interpret it — you define its shape and your compilers consume it.
type MyIntent = { ownerId: string | null; canSeeAll: boolean };

async function buildQueryIntent(principal: Principal) {
  return {
    ownerId: principal.userId,
    canSeeAll: principal.roles.includes('admin'),
  } as unknown as MyIntent;
}

// ── Per-backend compilers ───────────────────────────────────────────

const postgresCompiler = {
  compile(intent: MyIntent): SqlFragment {
    if (intent.canSeeAll) {
      return { sql: '1=1', params: [] };
    }
    return {
      sql: 'owner_id = $1 OR visibility = $2',
      params: [intent.ownerId, 'public'],
    };
  },
};

const oramaCompiler = {
  compile(intent: MyIntent): OramaFilter {
    if (intent.canSeeAll) return {};
    return {
      'or': [
        { ownerId: intent.ownerId },
        { visibility: 'public' },
      ],
    };
  },
};

// ── Bundle ──────────────────────────────────────────────────────────

export const authBundle: AuthorizationBundle = {
  policy: { decide },
  buildQueryIntent,
  compilers: {
    postgres: postgresCompiler,
    orama: oramaCompiler,
  },
};
```

### Two-phase authorization

The platform calls your policy twice during publish:

| Phase | When | Purpose | Result |
|-------|------|---------|--------|
| A — Preflight | Outside transaction, before user confirms | Fast reject for UI feedback | **Advisory** |
| B — Revalidation | Inside transaction, after row lock | Binding security decision | **Enforced** |

Phase B prevents TOCTOU races: the policy is re-evaluated after the row
is locked, so any concurrent changes between preview and commit are
detected.

### Rules

- `policy.decide()` must be a **pure function** — no side effects, no
  I/O outside of entity resolution. It returns a boolean, never a
  backend-specific query.
- `ConstraintCompiler` is a **pure function** — no database connection,
  no I/O, no side effects. It only produces a fragment.
- `buildQueryIntent` returns `null` when the principal has no access
  to any entity (empty result set).

---

## 4. Register your application capabilities

Substrate's platform layer is neutral — it provides mechanisms, not
values. You register your application's concrete implementations at
startup.

### 4.1 Feature manifest

Define which platform capabilities are active:

```ts
// src/instrumentation.ts
import { registerInstrumentation } from '@substrate/site/instrumentation';

export const register = registerInstrumentation({
  featureManifest: {
    auth: true,
    snapshot: true,
    contentAddressedStorage: true,
    assets: true,
    search: 'hybrid',
    ai: true,
    // ...see @substrate/config for the full schema
  },
  serviceName: 'my-site',
});
```

Or use a preset:

```ts
export const register = registerInstrumentation({
  featurePreset: 'ai-archive',
  serviceName: 'my-site',
});
```

### 4.2 Lifecycle definition

Define your entity's state machine. The platform validates transitions
against this definition at runtime.

```ts
import type { LifecycleDefinition } from '@substrate/contracts';

const articleLifecycle: LifecycleDefinition<string, string> = {
  initial: 'draft',
  states: ['draft', 'published', 'archived'] as const,
  transitions: {
    publish:  ['draft', 'published'] as const,
    unpublish: ['published', 'draft'] as const,
    archive:  ['published', 'archived'] as const,
    restore:  ['archived', 'draft'] as const,
  },
};
```

The platform never hardcodes your state names. `resolveTransition()`
and `availableTransitions()` are generic functions parameterised by
your definition.

### 4.3 Assemble `PublishDeps`

When using the publish protocol, assemble all your implementations
into a `PublishDeps` bundle:

```ts
import type { PublishDeps } from '@substrate/contracts';
import { createChangeSet } from '@substrate/contracts';

const publishDeps: PublishDeps = {
  authBundle,                           // from §3
  entityResolver: createResolver(db),  // from §1
  commitEngine: createCommitEngine(db), // your TransactionalCommitEngine
  projectPreview: async (changeset) => { /* ... */ },
  assessPublicImpact: async (preview) => { /* ... */ },
  reprojectAfterLock: async (changeset, tx) => { /* ... */ },
  // casPreWrite — when contentAddressedStorage: true
};
```

### 4.4 Typed tables

The platform provides only generic metadata tables: `entities`,
`associations`, `entity_indexes`, `snapshots`, `cas_objects`. Your
application's typed tables (e.g. `articles`, `projects`) live in your
own migration. They reference the platform's `entities` table via
foreign key on `(type, id)`.

```sql
-- Your application migration
CREATE TABLE articles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,      -- 'article'
  entity_id   TEXT NOT NULL,      -- matches entities.id
  title       TEXT NOT NULL,
  body        TEXT,
  FOREIGN KEY (entity_type, entity_id) REFERENCES entities(type, id)
);
```

### 4.5 What the platform will never do

These are hard guarantees enforced by the
[boundary CI gate](../scripts/check-boundary.ts):

- No hardcoded entity type names — `article`, `project` are your names.
- No hardcoded lifecycle states — `draft`, `published` are your names.
- No hardcoded visibility levels — `public`, `restricted` are your names.
- No brand names, person identifiers, or site-specific URLs.
- No application-specific tables — only generic metadata tables.
- No import from `examples/` or any application namespace.

If you find platform code that references your application's identity,
that's a bug.

---

## Reference

| Interface | Source | Purpose |
|-----------|--------|---------|
| `EntityResolver` | `@substrate/contracts` | Fetch entity metadata from your typed tables |
| `SnapshotStore` | `@substrate/contracts` | Immutable point-in-time state snapshots |
| `ContentAddressedStore` | `@substrate/contracts` | Content-addressed immutable blobs |
| `AssetStore` | `@substrate/contracts` | Binary asset storage with representations |
| `StoreAdapter` | `@substrate/contracts` | Bundle of storage adapters |
| `AuthorizationPolicy` | `@substrate/contracts` | Semantic permission decision |
| `ConstraintCompiler` | `@substrate/contracts` | Per-backend query fragment builder |
| `AuthorizationBundle` | `@substrate/contracts` | Full authorization bundle |
| `LifecycleDefinition` | `@substrate/contracts` | Declarative state machine |
| `TransactionalCommitEngine` | `@substrate/contracts` | Atomic commit with row locking |
| `PublishDeps` | `@substrate/contracts` | All dependencies for publish protocol |
| `FeatureManifest` | `@substrate/config` | Which platform capabilities are active |
| `PurgeContract` | `@substrate/contracts` | Safe deletion respecting snapshot reachability |
| `GarbageCollector` | `@substrate/contracts` | Optional CAS orphan cleanup |
