/**
 * @substrate/contracts/publish — Publish Atomicity Protocol.
 *
 * Implements the two-phase publish protocol from §4.1:
 *
 *   Phase A (outside transaction):
 *     1. Build ChangeSet
 *     2. Preflight Authorization (advisory)
 *     3. Preview State (render for user)
 *     4. Public Impact Assessment
 *     5. User Confirms
 *
 *   Phase B (inside transaction):
 *     6. CAS pre-write (if enabled — precondition)
 *     7. BEGIN TRANSACTION
 *     8. tx.lockEntity(refs) — SELECT ... FOR UPDATE
 *     9. Recompute projected state
 *    10. Recompute public impact
 *    11. Verify user's confirmed preview matches recomputed state
 *    12. Revalidate Authorization (binding)
 *    13. Write Current State
 *    14. Write Snapshot Reference + Aevum Revision row
 *    15. COMMIT
 *
 * The user's confirmed preview is a snapshot of the preview content +
 * public impact result — NOT a permanent authorization ticket.
 *
 * See: architecture-contract-v1.3.md §4.
 */

import type {
  AuthorizationBundle,
  AuthorizationContext,
  Principal,
} from './authorization';
import type {
  ChangeSet,
  CommitResult,
  SnapshotReference,
  Transaction,
  TransactionalCommitEngine,
} from './changeset';
import type { EntityRef } from './entity-resolver';
import type { EntitySnapshot } from './entity-resolver';
import type { EntityResolver } from './entity-resolver';

// Re-export types consumers need.
export type {
  ChangeSet,
  CommitResult,
  SnapshotReference,
  Transaction,
  TransactionalCommitEngine,
} from './changeset';
export type {
  AuthorizationBundle,
  AuthorizationContext,
  Principal,
} from './authorization';
export type { EntityRef, EntityResolver, EntitySnapshot } from './entity-resolver';

// ── Preview Types ───────────────────────────────────────────────────

/**
 * The projected state after applying a ChangeSet, before commit.
 * This is what the user sees and confirms.
 */
export interface PreviewState {
  /** Affected entities with their projected post-change metadata. */
  readonly entities: ReadonlyArray<EntitySnapshot>;
  /** Serialised representation of the projected state (for comparison). */
  readonly serializedState: string;
}

/**
 * Assessment of what will become publicly visible after this publish.
 */
export interface PublicImpactAssessment {
  /** Will any entity transition to a publicly visible state? */
  readonly becomesPublic: boolean;
  /** Entities that will be newly exposed publicly. */
  readonly newlyExposedEntities: readonly EntityRef[];
  /** Serialised representation of the impact (for comparison). */
  readonly serializedImpact: string;
}

/**
 * The user's confirmation of the preview.
 *
 * This captures a hash of the preview state + public impact at
 * confirmation time. After locking, the platform recomputes and
 * verifies this hash matches — preventing stale-preview commits.
 */
export interface PreviewConfirmation {
  readonly previewHash: string;
  readonly impactHash: string;
  readonly confirmedAt: number; // epoch ms
}

/**
 * Compute a stable hash from a PreviewState's serialized form.
 * Uses a simple FNV-1a hash for portability (no crypto dependency needed
 * for comparison — this is not a security hash, just a staleness check).
 */
export function hashPreviewState(state: PreviewState): string {
  return fnv1a(state.serializedState);
}

/**
 * Compute a stable hash from a PublicImpactAssessment.
 */
export function hashPublicImpact(impact: PublicImpactAssessment): string {
  return fnv1a(impact.serializedImpact);
}

// ── Publish Protocol Error ──────────────────────────────────────────

/**
 * Errors that can occur during the publish protocol.
 */
export type PublishError =
  | { type: 'preflight_denied'; reason: string }
  | { type: 'cas_prewrite_failed'; reason: string }
  | { type: 'preview_mismatch'; expected: string; actual: string }
  | { type: 'auth_revalidation_denied' }
  | { type: 'commit_failed'; reason: string };

// ── Publish Dependencies ────────────────────────────────────────────

/**
 * All dependencies required by the publish protocol.
 * The application assembles this bundle at startup.
 */
export interface PublishDeps {
  readonly authBundle: AuthorizationBundle;
  readonly entityResolver: EntityResolver;
  readonly commitEngine: TransactionalCommitEngine;
  /**
   * Project the state after applying a ChangeSet (outside transaction).
   * Used for preview rendering and public impact assessment.
   */
  readonly projectPreview: (changeset: ChangeSet) => Promise<PreviewState>;
  /**
   * Assess what becomes publicly visible after this ChangeSet.
   */
  readonly assessPublicImpact: (preview: PreviewState) => Promise<PublicImpactAssessment>;
  /**
   * Re-project the state after locking (inside transaction).
   * Must reflect any concurrent changes that happened before lock acquisition.
   */
  readonly reprojectAfterLock: (
    changeset: ChangeSet,
    tx: Transaction,
  ) => Promise<PreviewState>;
  /**
   * Optional CAS pre-write. If contentAddressedStorage is enabled,
   * this writes CAS objects to external storage before the transaction.
   * Returns the list of CAS object hashes for orphan tracking.
   */
  readonly casPreWrite?: (changeset: ChangeSet) => Promise<readonly string[]>;
}

// ── Publish Protocol ────────────────────────────────────────────────

/**
 * Result of a successful publish.
 */
export interface PublishSuccess<T> {
  readonly ok: true;
  readonly value: T;
  readonly snapshot?: SnapshotReference;
}

/**
 * Result of a failed publish.
 */
export interface PublishFailure {
  readonly ok: false;
  readonly error: PublishError;
  readonly orphanCasObjects?: readonly string[];
}

export type PublishResult<T> = PublishSuccess<T> | PublishFailure;

/**
 * Execute the full publish protocol (§4.1).
 *
 * This function orchestrates the two-phase publish:
 *   Phase A (advisory): preflight → preview → impact → confirm
 *   Phase B (binding): CAS pre-write → lock → recompute → verify → revalidate → commit
 *
 * The caller is responsible for:
 *   - Building the ChangeSet
 *   - Rendering the preview to the user
 *   - Obtaining user confirmation
 *   - Supplying the PreviewConfirmation (hash of what the user saw)
 *
 * The protocol enforces:
 *   I2: Public Site == Public Archive (atomic publish)
 *   I6: Authorization revalidation occurs inside the transaction
 *   I13: User's confirmed preview is verified against recomputed state
 *   I14: CAS pre-write is a precondition, not part of DB atomicity
 */
export async function executePublish<T>(
  deps: PublishDeps,
  changeset: ChangeSet,
  principal: Principal,
  confirmation: PreviewConfirmation,
  commitWork: (tx: Transaction) => Promise<T>,
): Promise<PublishResult<T>> {
  // ── Phase A: Preflight (advisory) ──────────────────────────────

  // For each affected entity, run preflight authorization.
  // This is a fast reject for UX — the binding decision is in Phase B.
  const affectedRefs = changeset.operations
    .map((op) => getOperationRef(op))
    .filter((r): r is EntityRef => r !== null);

  for (const ref of affectedRefs) {
    const ctx: AuthorizationContext = {
      principal,
      entityRef: ref,
      operation: getOperationAuthType(changeset.operations, ref),
    };
    const preflightResult = await deps.authBundle.policy.decide(ctx);
    if (!preflightResult.allow) {
      return {
        ok: false,
        error: { type: 'preflight_denied', reason: `Denied for ${ref.type}:${ref.id}` },
      };
    }
  }

  // ── Phase B: Transaction (binding) ──────────────────────────────

  // Step 6: CAS pre-write (precondition, not in DB transaction)
  let casHashes: readonly string[] = [];
  if (deps.casPreWrite) {
    try {
      casHashes = await deps.casPreWrite(changeset);
    } catch (e) {
      return {
        ok: false,
        error: {
          type: 'cas_prewrite_failed',
          reason: e instanceof Error ? e.message : String(e),
        },
      };
    }
  }

  // Steps 7-15: Transaction
  const commitResult = await deps.commitEngine.commit<T>(changeset, async (tx) => {
    // Step 8: Lock all affected entities
    for (const ref of affectedRefs) {
      await tx.lockEntity(ref);
    }

    // Steps 9-10: Recompute projected state + public impact
    const recomputedPreview = await deps.reprojectAfterLock(changeset, tx);
    const recomputedImpact = await deps.assessPublicImpact(recomputedPreview);

    // Step 11: Verify user's confirmed preview matches recomputed state
    const recomputedPreviewHash = hashPreviewState(recomputedPreview);
    const recomputedImpactHash = hashPublicImpact(recomputedImpact);

    if (
      recomputedPreviewHash !== confirmation.previewHash ||
      recomputedImpactHash !== confirmation.impactHash
    ) {
      throw new PreviewMismatchError(
        recomputedPreviewHash,
        confirmation.previewHash,
      );
    }

    // Step 12: Revalidate Authorization (binding, inside transaction)
    for (const ref of affectedRefs) {
      const ctx: AuthorizationContext = {
        principal,
        entityRef: ref,
        operation: getOperationAuthType(changeset.operations, ref),
      };
      const allowed = await deps.authBundle.policy.decide(ctx);
      if (!allowed.allow) {
        throw new AuthRevalidationError();
      }
    }

    // Steps 13-14: Write current state + snapshot (via commitWork callback)
    return commitWork(tx);
  });

  // Step 15: Result handling
  if (commitResult.ok) {
    return { ok: true, value: commitResult.value! };
  }

  // Determine error type from the thrown exception
  if (commitResult.error?.startsWith('PREVIEW_MISMATCH')) {
    return {
      ok: false,
      error: {
        type: 'preview_mismatch',
        expected: confirmation.previewHash,
        actual: '',
      },
      orphanCasObjects: casHashes.length > 0 ? casHashes : undefined,
    };
  }

  if (commitResult.error?.startsWith('AUTH_REVALIDATION')) {
    return {
      ok: false,
      error: { type: 'auth_revalidation_denied' },
      orphanCasObjects: casHashes.length > 0 ? casHashes : undefined,
    };
  }

  return {
    ok: false,
    error: { type: 'commit_failed', reason: commitResult.error ?? 'Unknown' },
    orphanCasObjects: casHashes.length > 0 ? casHashes : undefined,
  };
}

// ── Preview Builder ────────────────────────────────────────────────

/**
 * Build a PreviewState from entity snapshots.
 * Convenience for application implementations of `projectPreview`.
 */
export function buildPreview(
  snapshots: readonly EntitySnapshot[],
  serializedState: string,
): PreviewState {
  return { entities: snapshots, serializedState };
}

/**
 * Build a PublicImpactAssessment.
 * Convenience for application implementations of `assessPublicImpact`.
 */
export function buildImpact(
  becomesPublic: boolean,
  newlyExposed: readonly EntityRef[],
  serializedImpact: string,
): PublicImpactAssessment {
  return {
    becomesPublic,
    newlyExposedEntities: newlyExposed,
    serializedImpact,
  };
}

/**
 * Create a PreviewConfirmation from a PreviewState + PublicImpactAssessment.
 */
export function confirmPreview(
  preview: PreviewState,
  impact: PublicImpactAssessment,
): PreviewConfirmation {
  return {
    previewHash: hashPreviewState(preview),
    impactHash: hashPublicImpact(impact),
    confirmedAt: Date.now(),
  };
}

// ── Internal helpers ───────────────────────────────────────────────

class PreviewMismatchError extends Error {
  constructor(
    readonly actual: string,
    readonly expected: string,
  ) {
    super(`PREVIEW_MISMATCH: expected ${expected}, got ${actual}`);
    this.name = 'PreviewMismatchError';
  }
}

class AuthRevalidationError extends Error {
  constructor() {
    super('AUTH_REVALIDATION: denied after lock');
    this.name = 'AuthRevalidationError';
  }
}

/**
 * Extract the primary EntityRef from a DomainOperation.
 */
function getOperationRef(op: import('./changeset').DomainOperation): EntityRef | null {
  switch (op.kind) {
    case 'create_entity':
    case 'update_entity':
    case 'transition_lifecycle':
    case 'change_visibility':
    case 'soft_delete':
    case 'purge':
      return op.ref;
    case 'create_association':
    case 'delete_association':
      return op.a; // primary ref is `a`; `b` is also affected
    default:
      return null;
  }
}

/**
 * Map a DomainOperation to its AuthOperation type.
 */
function getOperationAuthType(
  ops: readonly import('./changeset').DomainOperation[],
  _ref: EntityRef,
): import('./authorization').AuthOperation {
  // Simplified: any write operation in a changeset is 'publish'
  // if it contains a transition_lifecycle to a published state,
  // otherwise 'write'. The application can override this.
  const hasTransition = ops.some((op) => op.kind === 'transition_lifecycle');
  return hasTransition ? 'publish' : 'write';
}

/**
 * FNV-1a hash (32-bit). Simple, fast, non-cryptographic.
 * Used for staleness detection, not security.
 */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Convert to unsigned 32-bit hex string
  return (hash >>> 0).toString(16).padStart(8, '0');
}
