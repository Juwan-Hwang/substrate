/**
 * @substrate-platform/contracts/publish — Publish Atomicity Protocol.
 *
 * Implements the two-phase publish protocol from §4.1:
 *
 *   Phase A (outside transaction):
 *     1. Build ChangeSet
 *     2. Preflight Authorization (advisory)
 *     3. Preview State (render for user)
 *     4. Public Impact Assessment
 *     5. User Confirms (PublishConfirmation with SHA-256 fingerprint)
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
 *    14. Write Snapshot Reference + application revision row
 *    15. COMMIT
 *
 * See: architecture-contract-v1.3.md §4.
 */

import { createHash } from 'node:crypto';

import type { AuthorizationBundle, AuthorizationContext, Principal } from './authorization';
import type {
  ChangeSet,
  SnapshotReference,
  Transaction,
  TransactionalCommitEngine,
} from './changeset';
import type { EntityRef, EntityResolver, EntitySnapshot } from './entity-resolver';
import { entityRefKey } from './entity-resolver';

export type {
  AuthorizationBundle,
  AuthorizationContext,
  Principal,
} from './authorization';
export type {
  ChangeSet,
  CommitResult,
  SnapshotReference,
  Transaction,
  TransactionalCommitEngine,
} from './changeset';
export type { EntityRef, EntityResolver, EntitySnapshot } from './entity-resolver';

// ── Preview & Impact Types ──────────────────────────────────────────

/**
 * The projected state after applying a ChangeSet, before commit.
 */
export interface PreviewState {
  /** Affected entities with their projected post-change metadata. */
  readonly entities: ReadonlyArray<EntitySnapshot>;
  /** Serialised representation of the projected state (for comparison). */
  readonly serializedState: string;
}

/**
 * Assessment of what will become publicly visible or modified after this publish.
 */
export interface PublicImpactAssessment {
  /** Will any entity transition to a publicly visible state or create public content? */
  readonly becomesPublic: boolean;
  /** Entities that will be newly exposed publicly. */
  readonly newlyExposedEntities: readonly EntityRef[];
  /** Entities whose public content or metadata is modified. */
  readonly modifiedPublicEntities?: readonly EntityRef[];
  /** Entities removed from public visibility. */
  readonly removedPublicEntities?: readonly EntityRef[];
  /** Serialised representation of the impact (for comparison). */
  readonly serializedImpact: string;
}

// ── Confirmation & Fingerprint ──────────────────────────────────────

export type ConfirmationStatus = 'confirmed' | 'revoked';

/**
 * The user's explicit confirmation of the public impact.
 */
export interface PublishConfirmation {
  readonly id: string;
  readonly changesetId: string;
  readonly confirmedBy: string;
  readonly confirmedAt: number; // epoch ms
  readonly assessmentFingerprint: string;
  readonly status: ConfirmationStatus;
  readonly revokedAt?: number;
  readonly revokedBy?: string;
  readonly revocationReason?: string;
}

/**
 * Backward-compatible PreviewConfirmation capture.
 */
export interface PreviewConfirmation {
  readonly previewHash: string;
  readonly impactHash: string;
  readonly confirmedAt: number; // epoch ms
}

/**
 * Compute deterministic SHA-256 fingerprint for a PublicImpactAssessment.
 */
export function calculateAssessmentFingerprint(impact: PublicImpactAssessment): string {
  const normalized = {
    becomesPublic: impact.becomesPublic,
    newlyExposed: [...impact.newlyExposedEntities].map(entityRefKey).sort(),
    modified: [...(impact.modifiedPublicEntities ?? [])].map(entityRefKey).sort(),
    removed: [...(impact.removedPublicEntities ?? [])].map(entityRefKey).sort(),
  };

  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

/**
 * Compute stable SHA-256 hash from a PreviewState's serialized form.
 */
export function hashPreviewState(state: PreviewState): string {
  return createHash('sha256').update(state.serializedState).digest('hex');
}

/**
 * Compute stable SHA-256 hash from a PublicImpactAssessment.
 */
export function hashPublicImpact(impact: PublicImpactAssessment): string {
  return calculateAssessmentFingerprint(impact);
}

// ── Publication Attempt & Recovery ──────────────────────────────────

export type AttemptState = 'pending' | 'committed' | 'failed' | 'recovered';

export interface PublicationAttempt {
  readonly attemptId: string;
  readonly changesetId: string;
  readonly state: AttemptState;
  readonly createdAt: number;
  readonly committedAt?: number;
  readonly failedAt?: number;
  readonly error?: string;
}

// ── Publish Protocol Error ──────────────────────────────────────────

/**
 * Errors that can occur during the publish protocol.
 */
export type PublishError =
  | { type: 'preflight_denied'; reason: string }
  | { type: 'confirmation_required'; reason: string }
  | { type: 'confirmation_mismatch'; expected: string; actual: string }
  | { type: 'confirmation_revoked'; reason: string }
  | { type: 'cas_prewrite_failed'; reason: string }
  | { type: 'preview_mismatch'; expected: string; actual: string }
  | { type: 'auth_revalidation_denied' }
  | { type: 'commit_failed'; reason: string };

// ── Publish Dependencies ────────────────────────────────────────────

export interface PublishDeps {
  readonly authBundle: AuthorizationBundle;
  readonly entityResolver: EntityResolver;
  readonly commitEngine: TransactionalCommitEngine;
  readonly projectPreview: (changeset: ChangeSet) => Promise<PreviewState>;
  readonly assessPublicImpact: (preview: PreviewState) => Promise<PublicImpactAssessment>;
  readonly reprojectAfterLock: (changeset: ChangeSet, tx: Transaction) => Promise<PreviewState>;
  readonly casPreWrite?: (changeset: ChangeSet) => Promise<readonly string[]>;
}

// ── Publish Protocol Execution ──────────────────────────────────────

export interface PublishSuccess<T> {
  readonly ok: true;
  readonly value: T;
  readonly snapshot?: SnapshotReference;
}

export interface PublishFailure {
  readonly ok: false;
  readonly error: PublishError;
  readonly orphanCasObjects?: readonly string[];
}

export type PublishResult<T> = PublishSuccess<T> | PublishFailure;

/**
 * Execute the full two-phase publish protocol.
 */
export async function executePublish<T>(
  deps: PublishDeps,
  changeset: ChangeSet,
  principal: Principal,
  confirmation: PreviewConfirmation | PublishConfirmation,
  commitWork: (tx: Transaction) => Promise<T>,
): Promise<PublishResult<T>> {
  // Normalize confirmation input
  const expectedImpactHash =
    'assessmentFingerprint' in confirmation
      ? confirmation.assessmentFingerprint
      : confirmation.impactHash;

  const expectedPreviewHash = 'previewHash' in confirmation ? confirmation.previewHash : undefined;

  if ('status' in confirmation && confirmation.status === 'revoked') {
    return {
      ok: false,
      error: {
        type: 'confirmation_revoked',
        reason: confirmation.revocationReason ?? 'Confirmation was revoked.',
      },
    };
  }

  // ── Phase A: Preflight (advisory) ──────────────────────────────
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

  const commitResult = await deps.commitEngine.commit<T>(changeset, async (tx) => {
    // Step 8: Lock all affected entities
    for (const ref of affectedRefs) {
      await tx.lockEntity(ref);
    }

    // Steps 9-10: Recompute projected state + public impact inside transaction
    const recomputedPreview = await deps.reprojectAfterLock(changeset, tx);
    const recomputedImpact = await deps.assessPublicImpact(recomputedPreview);

    // Step 11: Verify user's confirmed impact/preview matches recomputed state
    const recomputedImpactHash = calculateAssessmentFingerprint(recomputedImpact);

    if (expectedImpactHash && recomputedImpactHash !== expectedImpactHash) {
      throw new PreviewMismatchError(recomputedImpactHash, expectedImpactHash);
    }

    if (expectedPreviewHash) {
      const recomputedPreviewHash = hashPreviewState(recomputedPreview);
      if (recomputedPreviewHash !== expectedPreviewHash) {
        throw new PreviewMismatchError(recomputedPreviewHash, expectedPreviewHash);
      }
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

    // Steps 13-14: Write current state + snapshot
    return commitWork(tx);
  });

  if (commitResult.ok && commitResult.value !== undefined) {
    return { ok: true, value: commitResult.value };
  }

  if (commitResult.error?.startsWith('PREVIEW_MISMATCH')) {
    return casHashes.length > 0
      ? {
          ok: false,
          error: { type: 'preview_mismatch', expected: expectedImpactHash, actual: '' },
          orphanCasObjects: casHashes,
        }
      : {
          ok: false,
          error: { type: 'preview_mismatch', expected: expectedImpactHash, actual: '' },
        };
  }

  if (commitResult.error?.startsWith('AUTH_REVALIDATION')) {
    return casHashes.length > 0
      ? { ok: false, error: { type: 'auth_revalidation_denied' }, orphanCasObjects: casHashes }
      : { ok: false, error: { type: 'auth_revalidation_denied' } };
  }

  return casHashes.length > 0
    ? {
        ok: false,
        error: { type: 'commit_failed', reason: commitResult.error ?? 'Unknown' },
        orphanCasObjects: casHashes,
      }
    : { ok: false, error: { type: 'commit_failed', reason: commitResult.error ?? 'Unknown' } };
}

// ── Preview Builder ────────────────────────────────────────────────

export function buildPreview(
  snapshots: readonly EntitySnapshot[],
  serializedState: string,
): PreviewState {
  return { entities: snapshots, serializedState };
}

export function buildImpact(
  becomesPublic: boolean,
  newlyExposed: readonly EntityRef[],
  serializedImpact: string,
  modifiedPublic?: readonly EntityRef[],
  removedPublic?: readonly EntityRef[],
): PublicImpactAssessment {
  return {
    becomesPublic,
    newlyExposedEntities: newlyExposed,
    ...(modifiedPublic ? { modifiedPublicEntities: modifiedPublic } : {}),
    ...(removedPublic ? { removedPublicEntities: removedPublic } : {}),
    serializedImpact,
  };
}

export function confirmPreview(
  preview: PreviewState,
  impact: PublicImpactAssessment,
): PreviewConfirmation {
  return {
    previewHash: hashPreviewState(preview),
    impactHash: calculateAssessmentFingerprint(impact),
    confirmedAt: Date.now(),
  };
}

// ── Internal helpers ───────────────────────────────────────────────

class PreviewMismatchError extends Error {
  readonly actual: string;
  readonly expected: string;
  constructor(actual: string, expected: string) {
    super(`PREVIEW_MISMATCH: expected ${expected}, got ${actual}`);
    this.name = 'PreviewMismatchError';
    this.actual = actual;
    this.expected = expected;
  }
}

class AuthRevalidationError extends Error {
  constructor() {
    super('AUTH_REVALIDATION: denied after lock');
    this.name = 'AuthRevalidationError';
  }
}

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
      return op.a;
    default:
      return null;
  }
}

function getOperationAuthType(
  ops: readonly import('./changeset').DomainOperation[],
  _ref: EntityRef,
): import('./authorization').AuthOperation {
  const hasTransition = ops.some((op) => op.kind === 'transition_lifecycle');
  return hasTransition ? 'publish' : 'write';
}
