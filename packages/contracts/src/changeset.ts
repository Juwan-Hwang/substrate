/**
 * @substrate/contracts/changeset — ChangeSet + Transactional Commit Engine.
 *
 * A ChangeSet is a batch of domain-level semantic operations that commit
 * atomically. The TransactionalCommitEngine wraps them in a DB transaction
 * with row-level locking for TOCTOU safety.
 *
 * See: architecture-contract-v1.3.md §2.4 + §4.
 */

import type { EntityRef } from './entity-resolver';

// Re-export EntityRef for convenience.
export type { EntityRef } from './entity-resolver';

// ── DomainOperation ─────────────────────────────────────────────────

/**
 * Domain-level semantic operations — never raw table mutations.
 *
 * Each operation is a high-level intent. The platform's
 * TransactionalCommitEngine translates these into table writes
 * inside the transaction.
 *
 * Note: `create_association` and `delete_association` have NO `kind`
 * field — Association is purely (entityA, entityB), undirected and
 * untyped. See §9.
 */
export type DomainOperation =
  | { kind: 'create_entity'; ref: EntityRef; payload: unknown }
  | { kind: 'update_entity'; ref: EntityRef; payload: unknown }
  | { kind: 'transition_lifecycle'; ref: EntityRef; target: string }
  | { kind: 'change_visibility'; ref: EntityRef; target: string }
  | { kind: 'create_association'; a: EntityRef; b: EntityRef }
  | { kind: 'delete_association'; a: EntityRef; b: EntityRef }
  | { kind: 'soft_delete'; ref: EntityRef }
  | { kind: 'purge'; ref: EntityRef };

// ── ChangeSet ───────────────────────────────────────────────────────

/**
 * A batch of DomainOperations committed atomically.
 */
export interface ChangeSet {
  readonly id: string;
  readonly operations: readonly DomainOperation[];
  readonly authorId: string;
  readonly createdAt: number; // epoch ms
}

/**
 * Create a ChangeSet. Convenience constructor.
 */
export function createChangeSet(
  operations: readonly DomainOperation[],
  authorId: string,
): ChangeSet {
  return {
    id: crypto.randomUUID(),
    operations,
    authorId,
    createdAt: Date.now(),
  };
}

// ── Snapshot Reference ─────────────────────────────────────────────

/**
 * Reference to a site-level state Snapshot created during publish.
 *
 * When CAS is enabled, `stateRef` is a Manifest hash pointing to CAS
 * objects. When CAS is disabled, `stateRef` is a direct serialized
 * state blob identifier.
 */
export interface SnapshotReference {
  readonly snapshotId: string;
  readonly stateRef: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

// ── Transaction ─────────────────────────────────────────────────────

/**
 * Transaction handle provided to the commit callback.
 *
 * All write operations MUST go through this interface — never raw SQL
 * outside the engine. The Boundary CI gate enforces this (§13.3).
 */
export interface Transaction {
  /** Row-level lock for TOCTOU-safe revalidation (SELECT ... FOR UPDATE). */
  lockEntity(ref: EntityRef): Promise<void>;

  /** Insert / update within the transaction. */
  write(op: DomainOperation): Promise<void>;

  /** Insert snapshot reference within the transaction (platform table). */
  writeSnapshotReference(snapshot: SnapshotReference): Promise<void>;
}

// ── CommitResult ────────────────────────────────────────────────────

/**
 * Result of a TransactionalCommitEngine.commit() call.
 */
export interface CommitResult<T> {
  readonly ok: boolean;
  readonly value?: T;
  readonly error?: string;
  /** Orphan CAS objects left behind on failure (for GC). */
  readonly orphanCasObjects?: readonly string[];
}

// ── TransactionalCommitEngine ───────────────────────────────────────

/**
 * The platform's atomic commit engine.
 *
 * Call sequence (see §4.1 for full publish protocol):
 *   1. Build ChangeSet
 *   2. Preflight Authorization (Phase A — advisory)
 *   3. Preview State (render for user)
 *   4. Public Impact Assessment
 *   5. User Confirms
 *   6. CAS pre-write (if enabled — precondition, not in DB tx)
 *   7. BEGIN TRANSACTION
 *   8. tx.lockEntity(refs) — SELECT ... FOR UPDATE
 *   9. Recompute projected state
 *  10. Recompute public impact
 *  11. Verify user's confirmed preview matches recomputed state
 *  12. Revalidate Authorization (Phase B — binding)
 *  13. Write Current State (tx.write)
 *  14. Write Snapshot Reference + application revision row
 *  15. COMMIT
 */
export interface TransactionalCommitEngine {
  /**
   * Commit a ChangeSet atomically.
   *
   * The `work` callback receives a Transaction handle and performs all
   * DB writes inside the single transaction. The engine handles:
   *   - Opening/closing the transaction
   *   - Row-level locking
   *   - Atomic commit or rollback
   *   - Orphan CAS tracking on failure
   */
  commit<T>(changeset: ChangeSet, work: (tx: Transaction) => Promise<T>): Promise<CommitResult<T>>;
}

// ── Result helpers ─────────────────────────────────────────────────

export function commitOk<T>(value: T): CommitResult<T> {
  return { ok: true, value };
}

export function commitFail<T>(
  error: string,
  orphanCasObjects?: readonly string[],
): CommitResult<T> {
  return orphanCasObjects !== undefined
    ? { ok: false, error, orphanCasObjects }
    : { ok: false, error };
}
