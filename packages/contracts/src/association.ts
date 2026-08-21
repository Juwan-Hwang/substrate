/**
 * @substrate-platform/contracts/association — Association Primitive.
 *
 * v1.3 correction #1: Delete `kind`. Association is purely
 * `(entityA, entityB)` — undirected, untyped.
 *
 * No `kind` field. No `relationType`. No `source`/`target` bias.
 * Association only expresses "A and B are related."
 *
 * If the application needs typed relations, it defines its own table
 * (e.g. `collection_memberships`) on top of Association.
 *
 * Collection is NOT a platform primitive. The application defines `Collection`
 * and `CollectionMembership` on top of Association (or its own table).
 *
 * See: architecture-contract-v1.3.md §9.
 */

import type { EntityRef } from './entity-resolver';

// Re-export EntityRef for convenience.
export type { EntityRef } from './entity-resolver';

// ── Association ────────────────────────────────────────────────────

/**
 * An undirected, untyped association between two entities.
 *
 * No `kind` field. No `relationType`. No `source`/`target` bias.
 * Association only expresses "A and B are related."
 *
 * The DB schema (§9):
 * ```sql
 * CREATE TABLE associations (
 *   id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   entity_a_type TEXT NOT NULL,
 *   entity_a_id   TEXT NOT NULL,
 *   entity_b_type TEXT NOT NULL,
 *   entity_b_id   TEXT NOT NULL,
 *   created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
 *   UNIQUE(entity_a_type, entity_a_id, entity_b_type, entity_b_id)
 * );
 * -- NO kind column. NO relation_type column.
 * ```
 */
export interface Association {
  /** Internal UUID — not exposed in URLs, never federated. */
  readonly id: string;
  /** One endpoint of the undirected relation. */
  readonly entityA: EntityRef;
  /** The other endpoint of the undirected relation. */
  readonly entityB: EntityRef;
  /** Creation timestamp (epoch ms). */
  readonly createdAt: number;
}

/**
 * Create an Association value object.
 * Convenience constructor that enforces the (entityA, entityB) pair.
 */
export function association(
  id: string,
  entityA: EntityRef,
  entityB: EntityRef,
  createdAt: number = Date.now(),
): Association {
  return { id, entityA, entityB, createdAt } as const;
}

/**
 * Check if two associations are equivalent (same pair, regardless of order).
 * Since Association is undirected, (A, B) == (B, A).
 */
export function isSameAssociation(
  a: Pick<Association, 'entityA' | 'entityB'>,
  b: Pick<Association, 'entityA' | 'entityB'>,
): boolean {
  const aKey1 = `${a.entityA.type}:${a.entityA.id}↔${a.entityB.type}:${a.entityB.id}`;
  const aKey2 = `${a.entityB.type}:${a.entityB.id}↔${a.entityA.type}:${a.entityA.id}`;
  const bKey1 = `${b.entityA.type}:${b.entityA.id}↔${b.entityB.type}:${b.entityB.id}`;
  const bKey2 = `${b.entityB.type}:${b.entityB.id}↔${b.entityA.type}:${b.entityA.id}`;
  return aKey1 === bKey1 || aKey1 === bKey2 || aKey2 === bKey1 || aKey2 === bKey2;
}
