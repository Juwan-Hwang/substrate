/**
 * Generic Platform End-to-End Test Suite.
 *
 * Demonstrates and proves that Substrate is a 100% domain-agnostic platform
 * capable of running arbitrary websites (e.g., an E-Commerce Product & Docs Catalog)
 * with custom lifecycles, policies, changesets, public impact assessments,
 * SHA-256 confirmation fingerprints, and two-phase publishing.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  type AuthorizationBundle,
  type AuthorizationContext,
  type AuthorizationPolicy,
  type ChangeSet,
  type CommitResult,
  commitOk,
  createChangeSet,
  createExecutionPlan,
  createLifecycleEngine,
  type EntityRef,
  type EntitySnapshot,
  entityRef,
  executePublish,
  foldDomainOperations,
  type LifecycleDefinition,
  type PreviewState,
  type Principal,
  type PublicImpactAssessment,
  type PublishConfirmation,
  type PublishDeps,
  type Transaction,
  type TransactionalCommitEngine,
} from '../index';

describe('Phase 15 — Generic Substrate Platform E2E (Non-Aevum Scenario)', () => {
  // ── 1. Custom Domain Definition (Product Catalog Site) ────────────

  type ProductState = 'draft' | 'under_review' | 'approved' | 'published' | 'retired';
  type ProductEvent = 'submit_for_review' | 'approve' | 'publish' | 'retire' | 'reject';

  const productLifecycle: LifecycleDefinition<ProductState, ProductEvent> = {
    initial: 'draft',
    states: ['draft', 'under_review', 'approved', 'published', 'retired'],
    transitions: {
      submit_for_review: ['draft', 'under_review'],
      approve: ['under_review', 'approved'],
      publish: ['approved', 'published'],
      retire: ['published', 'retired'],
      reject: ['under_review', 'draft'],
    },
  };

  const productEngine = createLifecycleEngine(productLifecycle);

  it('verifies custom non-Aevum lifecycle transitions', () => {
    expect(productEngine.canTransition('draft', 'submit_for_review')).toBe(true);
    expect(productEngine.transition('draft', 'submit_for_review')).toBe('under_review');
    expect(productEngine.transition('under_review', 'approve')).toBe('approved');
    expect(productEngine.transition('approved', 'publish')).toBe('published');
    expect(productEngine.transition('published', 'retire')).toBe('retired');
    expect(productEngine.canTransition('draft', 'publish')).toBe(false);
  });

  // ── 2. Generic ChangeSet, Planning & Operation Folding ─────────────

  it('builds, folds, and plans a multi-entity ChangeSet for Product & DocPage', () => {
    const prodRef = entityRef('product', 'prod-cloud-v1');
    const docRef = entityRef('doc_page', 'doc-getting-started');

    const cs = createChangeSet(
      [
        {
          kind: 'create_entity',
          ref: prodRef,
          payload: { sku: 'SKU-001', name: 'Cloud Tier 1', price: 99 },
          targetVisibility: 'private',
        },
        {
          kind: 'update_entity',
          ref: prodRef,
          payload: { price: 89, currency: 'USD' },
          targetVisibility: 'public',
        },
        {
          kind: 'create_entity',
          ref: docRef,
          payload: { title: 'Getting Started Guide', slug: 'getting-started' },
          targetVisibility: 'public',
        },
        {
          kind: 'create_association',
          a: prodRef,
          b: docRef,
        },
      ],
      'merchant-user-1',
    );

    const folded = foldDomainOperations(cs.operations);
    expect(folded).toHaveLength(3); // prod (create+update merged), doc, association

    const plan = createExecutionPlan(cs);
    expect(plan.isExecutable).toBe(true);
    expect(plan.totalSteps).toBe(3);
    expect(plan.steps[0]?.operation.kind).toBe('create_entity');
    expect(plan.steps[2]?.operation.kind).toBe('create_association');
  });

  // ── 3. Generic Two-Phase Publishing with Confirmation & SHA-256 Fingerprint ──

  it('executes two-phase publish with SHA-256 confirmation on custom platform entities', async () => {
    const prodRef = entityRef('product', 'prod-enterprise-v2');

    const cs: ChangeSet = createChangeSet(
      [
        {
          kind: 'create_entity',
          ref: prodRef,
          payload: { name: 'Enterprise Cloud', price: 999 },
          targetVisibility: 'public',
        },
        {
          kind: 'transition_lifecycle',
          ref: prodRef,
          target: 'published',
        },
      ],
      'catalog-admin',
    );

    const editorPrincipal: Principal = {
      userId: 'editor-1',
      roles: ['catalog_editor', 'publisher'],
    };

    const policy: AuthorizationPolicy = {
      async decide(ctx: AuthorizationContext) {
        return { allow: ctx.principal.roles.includes('publisher') };
      },
    };

    const authBundle: AuthorizationBundle = {
      policy,
      buildQueryIntent: async () => ({ kind: 'all_allowed' }),
      compilers: {
        postgres: { compile: () => ({ sql: 'TRUE', params: [] }) },
        orama: { compile: () => ({}) },
        memory: { compile: () => () => true },
      },
    };

    const lockedRefs: string[] = [];
    const committedWrites: string[] = [];

    const mockCommitEngine: TransactionalCommitEngine = {
      async commit<T>(
        _changeset: ChangeSet,
        work: (tx: Transaction) => Promise<T>,
      ): Promise<CommitResult<T>> {
        const tx: Transaction = {
          lockEntity: vi.fn(async (ref: EntityRef) => {
            lockedRefs.push(`${ref.type}:${ref.id}`);
          }),
          write: vi.fn(async (op) => {
            committedWrites.push('ref' in op ? `${op.kind}:${op.ref.type}:${op.ref.id}` : op.kind);
          }),
          writeSnapshotReference: vi.fn(async () => {}),
        };
        const res = await work(tx);
        return commitOk(res);
      },
    };

    const projectPreview = async (_c: ChangeSet): Promise<PreviewState> => {
      const snap: EntitySnapshot = {
        ref: prodRef,
        lifecycleState: 'published',
        visibility: 'public',
        ownerId: 'catalog-admin',
        updatedAt: 1700000000000,
        deletedAt: null,
      };
      return {
        entities: [snap],
        serializedState: JSON.stringify({ [prodRef.id]: snap }),
      };
    };

    const assessPublicImpact = async (_preview: PreviewState): Promise<PublicImpactAssessment> => {
      return {
        becomesPublic: true,
        newlyExposedEntities: [prodRef],
        serializedImpact: JSON.stringify({ publicAdded: [prodRef] }),
      };
    };

    const deps: PublishDeps = {
      authBundle,
      entityResolver: {
        resolve: async () => null,
        resolveBatch: async () => new Map(),
      },
      commitEngine: mockCommitEngine,
      projectPreview,
      assessPublicImpact,
      reprojectAfterLock: projectPreview,
    };

    // Phase A: Generate Preview & Compute Impact
    const preview = await deps.projectPreview(cs);
    const impact = await deps.assessPublicImpact(preview);

    // Compute Fingerprint
    const { calculateAssessmentFingerprint } = await import('../publish');
    const fingerprint = calculateAssessmentFingerprint(impact);
    expect(fingerprint).toHaveLength(64);

    // User confirms
    const confirmation: PublishConfirmation = {
      id: 'conf-catalog-001',
      changesetId: cs.id,
      confirmedBy: 'catalog-admin@company.org',
      confirmedAt: Date.now(),
      assessmentFingerprint: fingerprint,
      status: 'confirmed',
    };

    // Phase B: Execute publish
    const result = await executePublish(deps, cs, editorPrincipal, confirmation, async (tx) => {
      for (const op of cs.operations) {
        await tx.write(op);
      }
      return { publishedProduct: 'prod-enterprise-v2', status: 'published' };
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.publishedProduct).toBe('prod-enterprise-v2');
    }

    // Verify row locking occurred
    expect(lockedRefs).toContain('product:prod-enterprise-v2');
    expect(committedWrites).toHaveLength(2);
  });
});
