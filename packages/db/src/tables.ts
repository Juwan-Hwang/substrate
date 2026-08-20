/**
 * Drizzle table definitions — the single source of truth for all schemas.
 *
 * This module exists separately from `index.ts` to break circular
 * dependencies. `index.ts` re-exports these tables as a barrel, and
 * `schemas.ts` / `turso.ts` import directly from here to avoid the
 * TDZ (Temporal Dead Zone) error that occurs when Turbopack evaluates
 * `index.ts` → `schemas.ts` → `index.ts` before table constants are
 * initialised.
 *
 * ## Platform vs Application Tables
 *
 * This file defines ONLY platform-level tables:
 *   - entities (generic entity registry)
 *   - associations (undirected entity relations)
 *   - entity_indexes (query optimization)
 *   - snapshots (immutable state snapshots)
 *   - cas_objects (content-addressed storage)
 *
 * Application-specific tables are defined by the application
 * in its own migration and schema files.
 */

import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// ── Platform Core Tables ─────────────────────────────────────────────
//
// These tables are the platform's generic metadata authority.
// Application typed tables store ONLY
// business/extension fields — lifecycle_state, visibility, owner_id
// all live in `entities`.
//
// See: architecture-contract-v1.3.md §11 + §14.3.

/**
 * Generic Entity Registry — sole authority for lifecycle, visibility,
 * owner, timestamps, and deletion state.
 *
 * `type` is app-defined ('writing', 'project', etc.).
 * `lifecycle_state` is app-defined ('draft', 'published', etc.).
 * `visibility` is app-defined ('private', 'restricted', 'public').
 * The platform NEVER hardcodes any of these values.
 */
export const entities = pgTable(
  'entities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: text('type').notNull(),
    lifecycleState: text('lifecycle_state').notNull(),
    visibility: text('visibility').notNull(),
    ownerId: text('owner_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('entities_type_id_idx').on(table.type, table.id),
    index('entities_lifecycle_idx').on(table.lifecycleState),
    index('entities_visibility_idx').on(table.visibility),
  ],
);

/**
 * Association — undirected, untyped entity relation.
 *
 * NO `kind` column. NO `relation_type` column.
 * Association only expresses "A and B are related."
 * See: architecture-contract-v1.3.md §9.
 */
export const associations = pgTable(
  'associations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityAType: text('entity_a_type').notNull(),
    entityAId: text('entity_a_id').notNull(),
    entityBType: text('entity_b_type').notNull(),
    entityBId: text('entity_b_id').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('associations_a_idx').on(table.entityAType, table.entityAId),
    index('associations_b_idx').on(table.entityBType, table.entityBId),
  ],
);

/**
 * Entity indexes — query optimization for the entities table.
 *
 * Composite primary key on (entity_type, entity_id) prevents duplicate
 * rows for the same entity. Each (type, id) pair has exactly one index
 * row reflecting its current lifecycle state and visibility.
 */
export const entityIndexes = pgTable(
  'entity_indexes',
  {
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    lifecycleState: text('lifecycle_state').notNull(),
    visibility: text('visibility').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.entityType, table.entityId] }),
    index('entity_indexes_lifecycle_visibility_idx').on(table.lifecycleState, table.visibility),
  ],
);

// ── History Layer Tables ───────────────────────────────────────────
//
// Platform primitives only: snapshots + cas_objects.
// NO revisions table — Revision is an application entity.
// The application creates revisions in its own migration.
//
// See: architecture-contract-v1.3.md §2.5 + §14.3.

/**
 * Site-level State Snapshot — immutable point-in-time copy of the
 * entire application state at publish time.
 *
 * `state_ref`: when CAS is enabled -> Manifest hash -> CAS objects.
 *              when CAS is disabled -> direct serialized state blob identifier.
 * NO entity_type, NO entity_id — one Snapshot = entire application state.
 */
export const snapshots = pgTable('snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  stateRef: text('state_ref').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Content-Addressed Storage objects — immutable, content-addressed blobs.
 * Orphans are GC-safe (idempotent, content-addressed).
 */
export const casObjects = pgTable('cas_objects', {
  hash: text('hash').primaryKey(),
  size: integer('size').notNull(),
  storageBackend: text('storage_backend').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── Inferred types ───────────────────────────────────────────────────

export type Entity = typeof entities.$inferSelect;
export type NewEntity = typeof entities.$inferInsert;
export type AssociationRow = typeof associations.$inferSelect;
export type NewAssociationRow = typeof associations.$inferInsert;
export type EntityIndex = typeof entityIndexes.$inferSelect;
export type NewEntityIndex = typeof entityIndexes.$inferInsert;
export type Snapshot = typeof snapshots.$inferSelect;
export type NewSnapshot = typeof snapshots.$inferInsert;
export type CasObject = typeof casObjects.$inferSelect;
export type NewCasObject = typeof casObjects.$inferInsert;
