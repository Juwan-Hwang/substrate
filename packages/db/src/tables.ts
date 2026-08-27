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
 *   - publication_attempts (generic execution tracking)
 *   - publishing_confirmations (generic authorization confirmations)
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
  varchar,
} from 'drizzle-orm/pg-core';

// ── Platform Core Tables ─────────────────────────────────────────────

/**
 * Generic Entity Registry — sole authority for lifecycle, visibility,
 * owner, timestamps, and deletion state.
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

/**
 * Site-level State Snapshot — immutable point-in-time copy of the
 * entire application state at publish time.
 */
export const snapshots = pgTable('snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  stateRef: text('state_ref').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Content-Addressed Storage objects — immutable, content-addressed blobs.
 */
export const casObjects = pgTable('cas_objects', {
  hash: text('hash').primaryKey(),
  size: integer('size').notNull(),
  storageBackend: text('storage_backend').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Publication Attempts — execution tracking for publish protocol.
 */
export const publicationAttempts = pgTable(
  'publication_attempts',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    entityType: varchar('entity_type', { length: 64 }).notNull(),
    entityId: varchar('entity_id', { length: 255 }).notNull(),
    changesetId: varchar('changeset_id', { length: 255 }),
    state: varchar('state', { length: 32 }).notNull(),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    committedAt: timestamp('committed_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
  },
  (table) => [
    index('publication_attempts_entity_idx').on(table.entityType, table.entityId),
    index('publication_attempts_state_idx').on(table.state),
  ],
);

/**
 * Publishing Confirmations — authorization records for public impact.
 */
export const publishingConfirmations = pgTable(
  'publishing_confirmations',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    changesetId: varchar('changeset_id', { length: 255 }).notNull(),
    confirmedBy: varchar('confirmed_by', { length: 255 }).notNull(),
    assessmentFingerprint: varchar('assessment_fingerprint', { length: 255 }).notNull(),
    status: varchar('status', { length: 32 }).default('confirmed').notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedBy: varchar('revoked_by', { length: 255 }),
    revocationReason: text('revocation_reason'),
  },
  (table) => [
    index('publishing_confirmations_changeset_idx').on(table.changesetId),
    index('publishing_confirmations_status_idx').on(table.status),
  ],
);

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
export type PublicationAttemptRow = typeof publicationAttempts.$inferSelect;
export type NewPublicationAttemptRow = typeof publicationAttempts.$inferInsert;
export type PublishingConfirmationRow = typeof publishingConfirmations.$inferSelect;
export type NewPublishingConfirmationRow = typeof publishingConfirmations.$inferInsert;
