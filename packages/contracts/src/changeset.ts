/**
 * @substrate-platform/contracts/changeset — ChangeSet + Transactional Commit Engine.
 *
 * A ChangeSet is a batch of domain-level semantic operations that commit
 * atomically. The TransactionalCommitEngine wraps them in a DB transaction
 * with row-level locking for TOCTOU safety.
 *
 * See: architecture-contract-v1.3.md §2.4 + §4.
 */

import type { EntityRef } from './entity-resolver';
import { entityRefKey } from './entity-resolver';

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
  | {
      kind: 'create_entity';
      ref: EntityRef;
      payload: unknown;
      targetVisibility?: string | undefined;
    }
  | {
      kind: 'update_entity';
      ref: EntityRef;
      payload: unknown;
      targetVisibility?: string | undefined;
    }
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
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Create a ChangeSet. Convenience constructor.
 */
export function createChangeSet(
  operations: readonly DomainOperation[],
  authorId: string,
  metadata?: Readonly<Record<string, unknown>>,
): ChangeSet {
  return {
    id: crypto.randomUUID(),
    operations,
    authorId,
    createdAt: Date.now(),
    ...(metadata ? { metadata } : {}),
  };
}

// ── Operation Folding & Planning ───────────────────────────────────

/**
 * Merge multiple sequential DomainOperations targeting the same entity
 * into a minimal equivalent sequence.
 */
export function foldDomainOperations(
  operations: readonly DomainOperation[],
): readonly DomainOperation[] {
  const entityOps = new Map<string, DomainOperation[]>();
  const associationOps: DomainOperation[] = [];

  for (const op of operations) {
    if (op.kind === 'create_association' || op.kind === 'delete_association') {
      associationOps.push(op);
      continue;
    }

    const key = entityRefKey(op.ref);
    const list = entityOps.get(key) ?? [];
    list.push(op);
    entityOps.set(key, list);
  }

  const folded: DomainOperation[] = [];

  for (const [, ops] of entityOps) {
    if (ops.length === 0) continue;
    if (ops.length === 1 && ops[0]) {
      folded.push(ops[0]);
      continue;
    }

    let current: DomainOperation | null = null;

    for (const op of ops) {
      if (!current) {
        current = op;
        continue;
      }

      // If created then updated, fold into create with latest payload & visibility
      if (current.kind === 'create_entity' && op.kind === 'update_entity') {
        current = {
          kind: 'create_entity',
          ref: current.ref,
          payload:
            typeof current.payload === 'object' && typeof op.payload === 'object'
              ? { ...current.payload, ...op.payload }
              : op.payload,
          targetVisibility: op.targetVisibility ?? current.targetVisibility,
        };
      } else if (current.kind === 'create_entity' && op.kind === 'change_visibility') {
        current = {
          ...current,
          targetVisibility: op.target,
        };
      } else if (current.kind === 'update_entity' && op.kind === 'update_entity') {
        current = {
          kind: 'update_entity',
          ref: current.ref,
          payload:
            typeof current.payload === 'object' && typeof op.payload === 'object'
              ? { ...current.payload, ...op.payload }
              : op.payload,
          targetVisibility: op.targetVisibility ?? current.targetVisibility,
        };
      } else if (
        current.kind === 'create_entity' &&
        (op.kind === 'soft_delete' || op.kind === 'purge')
      ) {
        // Created then deleted in same changeset -> cancel out
        current = null;
      } else {
        folded.push(current);
        current = op;
      }
    }

    if (current) {
      folded.push(current);
    }
  }

  return [...folded, ...associationOps];
}

export interface ExecutionStep {
  readonly stepIndex: number;
  readonly operation: DomainOperation;
  readonly entityKey: string;
}

export interface ExecutionPlan {
  readonly changesetId: string;
  readonly steps: readonly ExecutionStep[];
  readonly totalSteps: number;
  readonly isExecutable: boolean;
  readonly validationErrors: readonly string[];
}

const OPERATION_EXECUTION_ORDER: Record<DomainOperation['kind'], number> = {
  create_entity: 1,
  update_entity: 2,
  transition_lifecycle: 3,
  change_visibility: 4,
  create_association: 5,
  delete_association: 6,
  soft_delete: 7,
  purge: 8,
};

/**
 * Compile a ChangeSet into a deterministic, dependency-safe ExecutionPlan.
 */
export function createExecutionPlan(changeset: ChangeSet): ExecutionPlan {
  const errors: string[] = [];

  if (changeset.operations.length === 0) {
    errors.push('ChangeSet contains no operations to execute.');
  }

  const folded = foldDomainOperations(changeset.operations);

  // Sort operations by deterministic dependency ordering
  const sorted = [...folded].sort((a, b) => {
    const orderA = OPERATION_EXECUTION_ORDER[a.kind] ?? 99;
    const orderB = OPERATION_EXECUTION_ORDER[b.kind] ?? 99;
    if (orderA !== orderB) return orderA - orderB;

    const refA = 'ref' in a ? entityRefKey(a.ref) : `${entityRefKey(a.a)}_${entityRefKey(a.b)}`;
    const refB = 'ref' in b ? entityRefKey(b.ref) : `${entityRefKey(b.a)}_${entityRefKey(b.b)}`;
    return refA.localeCompare(refB);
  });

  const steps: ExecutionStep[] = sorted.map((op, index) => ({
    stepIndex: index + 1,
    operation: op,
    entityKey: 'ref' in op ? entityRefKey(op.ref) : `${entityRefKey(op.a)}_${entityRefKey(op.b)}`,
  }));

  return {
    changesetId: changeset.id,
    steps,
    totalSteps: steps.length,
    isExecutable: errors.length === 0 && steps.length > 0,
    validationErrors: errors,
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
 */
export interface TransactionalCommitEngine {
  /**
   * Commit a ChangeSet atomically.
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
