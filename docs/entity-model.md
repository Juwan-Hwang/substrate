# Substrate Entity Model & Relationships

> The **Entity Model** defines how Substrate handles entity identity, lifecycle state, visibility tiers, and associations without coupling to concrete content taxonomies.

---

## 1. Generic Entity Structure

At the platform level, all content items are referenced via a lightweight, typed reference:

```ts
export interface EntityRef {
  readonly type: string;
  readonly id: string;
}

export function entityRef(type: string, id: string): EntityRef {
  return { type, id };
}
```

An entity snapshot represents the state of an entity at a given point in time:

```ts
export interface EntitySnapshot {
  readonly ref: EntityRef;
  readonly lifecycleState: string;
  readonly visibility: string;
  readonly ownerId: string | null;
  readonly updatedAt: number;
  readonly metadata?: Record<string, unknown>;
}
```

---

## 2. Undirected Associations

Substrate manages entity relationships through **undirected associations**:

```ts
export interface Association {
  readonly a: EntityRef;
  readonly b: EntityRef;
}
```

### Invariants:
1. **Symmetric Identity**: An association between `(A, B)` is identical to `(B, A)` (`isSameAssociation(x, y) === true`).
2. **Untyped Links**: Associations do not carry hardcoded relational kinds (e.g. `has_author` vs `relates_to`). Semantic relationships are determined by entity type pairings or application metadata.

---

## 3. Database Layer: Generic Registry vs Application Typed Tables

Substrate separates generic registry tracking from typed application tables:

### Platform Table (`entities` in `@substrate-platform/db`):
* Tracks universal metadata: `id`, `type`, `lifecycle_state`, `visibility`, `owner_id`, `created_at`, `updated_at`, `deleted_at`.
* Fast query indexing: `entity_indexes` optimized for `(lifecycle_state, visibility)` lookups.

### Application Tables (e.g., `writings`, `media`, `doc_articles`):
* Stores rich typed content payloads (e.g., `slug`, `title`, `body_ast`, `tags`, `reading_time`).
* Cleanly linked to entity IDs without platform schema pollution.
