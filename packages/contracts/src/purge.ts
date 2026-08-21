/**
 * @substrate-platform/contracts/purge — Purge Safety Contract.
 *
 * `purge()` must not cascade-delete objects referenced by historical
 * snapshots. Physical deletion of historical objects is governed by
 * **snapshot reachability**, not by the current entity's lifecycle.
 *
 * The platform provides:
 *   - `PurgeContract` interface (§7.2)
 *   - `GarbageCollector` interface (§7.3)
 *
 * The platform MUST NOT provide a `purgeAll()` or `purgeDeep()` that
 * bypasses snapshot reachability.
 *
 * See: architecture-contract-v1.3.md §7.
 */

import type { EntityRef } from './entity-resolver';

// Re-export EntityRef for convenience.
export type { EntityRef } from './entity-resolver';

// ── PurgeContract ───────────────────────────────────────────────────

/**
 * Purge contract — deletes the current entity row only.
 *
 * Does NOT delete:
 *   - CAS objects (immutable, content-addressed)
 *   - Snapshots (historical record)
 *   - Revisions (application-owned, historical reachability)
 *   - Associations (unless explicitly requested and they don't
 *     break historical reachability)
 *
 * The purge operation is the **final, irreversible** step in the
 * soft-delete lifecycle: active → trashed → purged.
 *
 * After purge:
 *   - The current entity row is deleted from `entities`.
 *   - Historical snapshots that captured this entity's state remain
 *     intact in CAS / snapshots storage.
 *   - Any committed Revision that references a Snapshot containing
 *     this entity's state remains reachable.
 */
export interface PurgeContract {
  /**
   * Purge the CURRENT entity row only.
   *
   * This is the only purge method the platform provides. It deletes
   * the live row in `entities` and cascades to the typed table row
   * (via FK ON DELETE CASCADE on the typed table's `entity_id` column).
   *
   * It does NOT delete:
   *   - CAS objects
   *   - Snapshots
   *   - Revisions
   *   - Associations (unless explicitly requested and they don't
   *     break historical reachability)
   */
  purgeCurrent(ref: EntityRef): Promise<void>;
}

// ── GarbageCollector ────────────────────────────────────────────────

/**
 * Optional garbage collector for orphaned CAS objects.
 *
 * GC is **optional** and **non-urgent**. Orphaned CAS objects are
 * harmless (immutable, content-addressed) and can persist indefinitely
 * until GC runs.
 *
 * The platform MAY provide a GC implementation. The application MAY configure
 * its scheduling (cron interval, on-demand trigger, etc.).
 *
 * The GC must:
 *   1. Scan all committed revisions (application table).
 *   2. Build a reachability set of CAS objects.
 *   3. Delete CAS objects NOT in the reachability set.
 *
 * The platform MUST NOT provide a `purgeAll()` or `purgeDeep()` that
 * bypasses snapshot reachability. Such operations would violate the
 * historical immutability contract (I7).
 */
export interface GarbageCollector {
  /**
   * Run a GC sweep. Returns the number of orphaned CAS objects removed.
   *
   * This operation is idempotent — running it multiple times is safe.
   * If no orphans exist, it returns 0.
   */
  sweep(): Promise<GarbageCollectionResult>;
}

/**
 * Result of a garbage collection sweep.
 */
export interface GarbageCollectionResult {
  /** Number of CAS objects deleted (0 if none were orphaned). */
  readonly deletedCount: number;
  /** Number of CAS objects scanned total. */
  readonly scannedCount: number;
  /** Number of CAS objects in the reachability set. */
  readonly reachableCount: number;
  /** Duration in milliseconds. */
  readonly durationMs: number;
}
