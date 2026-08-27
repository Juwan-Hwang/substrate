/**
 * demo-docs — Second Consumer Application Validation.
 *
 * Demonstrates an independent, multi-tenant Documentation Platform built
 * exclusively on `@substrate-platform/contracts`.
 *
 * Validates:
 *   1. Custom Doc Lifecycle: draft -> in_review -> approved -> published -> deprecated
 *   2. Team-based Authorization Policy: tech_writer vs doc_lead
 *   3. Multi-entity ChangeSet planning & folding (DocArticle + ApiDoc)
 *   4. Two-Phase Publish with SHA-256 Confirmation Fingerprint
 *   5. Search Privacy Assertion: private/review docs rejected from static search index
 */

import { describe, expect, it, vi } from 'vitest';
import {
  type AuthorizationBundle,
  type AuthorizationContext,
  type AuthorizationPolicy,
  assertStaticIndexIsPublic,
  type ChangeSet,
  type CommitResult,
  calculateAssessmentFingerprint,
  commitOk,
  createChangeSet,
  createExecutionPlan,
  createLifecycleEngine,
  type EntityRef,
  type EntitySnapshot,
  entityRef,
  executePublish,
  type LifecycleDefinition,
  type PreviewState,
  type Principal,
  type PublicImpactAssessment,
  type PublishConfirmation,
  type PublishDeps,
  type Transaction,
  type TransactionalCommitEngine,
} from '../index';

describe('Phase 16 — Demo Docs Consumer Validation', () => {
  // ── 1. Custom Documentation Lifecycle ─────────────────────────────

  type DocState = 'draft' | 'in_review' | 'approved' | 'published' | 'deprecated';
  type DocEvent = 'request_review' | 'approve' | 'publish' | 'deprecate' | 'reject';

  const docLifecycleDef: LifecycleDefinition<DocState, DocEvent> = {
    initial: 'draft',
    states: ['draft', 'in_review', 'approved', 'published', 'deprecated'],
    transitions: {
      request_review: ['draft', 'in_review'],
      approve: ['in_review', 'approved'],
      publish: ['approved', 'published'],
      deprecate: ['published', 'deprecated'],
      reject: ['in_review', 'draft'],
    },
  };

  const docEngine = createLifecycleEngine(docLifecycleDef);

  it('validates documentation lifecycle workflow', () => {
    expect(docEngine.canTransition('draft', 'request_review')).toBe(true);
    expect(docEngine.transition('draft', 'request_review')).toBe('in_review');
    expect(docEngine.transition('in_review', 'approve')).toBe('approved');
    expect(docEngine.transition('approved', 'publish')).toBe('published');
    expect(docEngine.transition('published', 'deprecate')).toBe('deprecated');
    // Cannot publish directly from draft
    expect(docEngine.canTransition('draft', 'publish')).toBe(false);
  });

  // ── 2. Team-based Authorization Policy ────────────────────────────

  const docPolicy: AuthorizationPolicy = {
    async decide(ctx: AuthorizationContext) {
      if (ctx.operation === 'read') return { allow: true };
      if (ctx.operation === 'publish') {
        return { allow: ctx.principal.roles.includes('doc_lead') };
      }
      return {
        allow:
          ctx.principal.roles.includes('tech_writer') || ctx.principal.roles.includes('doc_lead'),
      };
    },
  };

  const writerPrincipal: Principal = {
    userId: 'writer-alice',
    roles: ['tech_writer'],
  };

  const leadPrincipal: Principal = {
    userId: 'lead-bob',
    roles: ['doc_lead'],
  };

  it('enforces role-based publishing authorization', async () => {
    const docRef = entityRef('doc_article', 'doc-auth-guide');

    const writerDecision = await docPolicy.decide({
      principal: writerPrincipal,
      entityRef: docRef,
      operation: 'publish',
    });
    expect(writerDecision.allow).toBe(false);

    const leadDecision = await docPolicy.decide({
      principal: leadPrincipal,
      entityRef: docRef,
      operation: 'publish',
    });
    expect(leadDecision.allow).toBe(true);
  });

  // ── 3. Multi-Entity ChangeSet Planning & Two-Phase Publish ────────

  it('executes full publish protocol with SHA-256 confirmation on documentation batch', async () => {
    const guideRef = entityRef('doc_article', 'guide-getting-started');
    const apiRef = entityRef('api_doc', 'api-v2-endpoints');

    const cs: ChangeSet = createChangeSet(
      [
        {
          kind: 'create_entity',
          ref: guideRef,
          payload: {
            title: 'Getting Started Guide',
            slug: 'getting-started',
            content: '# Welcome',
          },
          targetVisibility: 'public',
        },
        {
          kind: 'create_entity',
          ref: apiRef,
          payload: { path: '/v2/users', method: 'GET', description: 'List users' },
          targetVisibility: 'public',
        },
        {
          kind: 'create_association',
          a: guideRef,
          b: apiRef,
        },
      ],
      'lead-bob',
    );

    // Verify planning
    const plan = createExecutionPlan(cs);
    expect(plan.isExecutable).toBe(true);
    expect(plan.totalSteps).toBe(3);

    const writtenOps: string[] = [];
    const lockedEntities: string[] = [];

    const commitEngine: TransactionalCommitEngine = {
      async commit<T>(
        _changeset: ChangeSet,
        work: (tx: Transaction) => Promise<T>,
      ): Promise<CommitResult<T>> {
        const tx: Transaction = {
          lockEntity: vi.fn(async (ref: EntityRef) => {
            lockedEntities.push(`${ref.type}:${ref.id}`);
          }),
          write: vi.fn(async (op) => {
            writtenOps.push('ref' in op ? `${op.kind}:${op.ref.type}:${op.ref.id}` : op.kind);
          }),
          writeSnapshotReference: vi.fn(async () => {}),
        };
        const value = await work(tx);
        return commitOk(value);
      },
    };

    const authBundle: AuthorizationBundle = {
      policy: docPolicy,
      buildQueryIntent: async () => ({ kind: 'all_allowed' }),
      compilers: {
        postgres: { compile: () => ({ sql: 'TRUE', params: [] }) },
        orama: { compile: () => ({}) },
        memory: { compile: () => () => true },
      },
    };

    const projectPreview = async (_c: ChangeSet): Promise<PreviewState> => {
      const gSnap: EntitySnapshot = {
        ref: guideRef,
        lifecycleState: 'published',
        visibility: 'public',
        ownerId: 'lead-bob',
        updatedAt: 1700000000000,
        deletedAt: null,
      };
      const aSnap: EntitySnapshot = {
        ref: apiRef,
        lifecycleState: 'published',
        visibility: 'public',
        ownerId: 'lead-bob',
        updatedAt: 1700000000000,
        deletedAt: null,
      };
      return {
        entities: [gSnap, aSnap],
        serializedState: JSON.stringify({ guide: gSnap, api: aSnap }),
      };
    };

    const assessPublicImpact = async (_preview: PreviewState): Promise<PublicImpactAssessment> => {
      return {
        becomesPublic: true,
        newlyExposedEntities: [guideRef, apiRef],
        serializedImpact: JSON.stringify({ exposed: [guideRef, apiRef] }),
      };
    };

    const deps: PublishDeps = {
      authBundle,
      entityResolver: {
        resolve: async () => null,
        resolveBatch: async () => new Map(),
      },
      commitEngine,
      projectPreview,
      assessPublicImpact,
      reprojectAfterLock: projectPreview,
    };

    // 1. Preview and Impact Assessment
    const preview = await deps.projectPreview(cs);
    const impact = await deps.assessPublicImpact(preview);

    // 2. Compute stable SHA-256 fingerprint
    const fingerprint = calculateAssessmentFingerprint(impact);
    expect(fingerprint).toHaveLength(64);

    // 3. User Confirms
    const confirmation: PublishConfirmation = {
      id: 'conf-docs-101',
      changesetId: cs.id,
      confirmedBy: 'lead-bob@company.org',
      confirmedAt: Date.now(),
      assessmentFingerprint: fingerprint,
      status: 'confirmed',
    };

    // 4. Lead publishes successfully
    const result = await executePublish(deps, cs, leadPrincipal, confirmation, async (tx) => {
      for (const op of cs.operations) {
        await tx.write(op);
      }
      return { publishedDocs: 2, batchId: cs.id };
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.publishedDocs).toBe(2);
    }

    expect(lockedEntities).toContain('doc_article:guide-getting-started');
    expect(lockedEntities).toContain('api_doc:api-v2-endpoints');
    expect(writtenOps).toHaveLength(3);
  });

  // ── 4. Search Privacy Assertion ───────────────────────────────────

  it('rejects unpublished or non-public doc articles from static search index', () => {
    const publicDoc: EntitySnapshot = {
      ref: entityRef('doc_article', 'public-guide'),
      lifecycleState: 'published',
      visibility: 'public',
      ownerId: 'author-1',
      updatedAt: Date.now(),
      deletedAt: null,
    };

    const internalDraftDoc: EntitySnapshot = {
      ref: entityRef('doc_article', 'internal-draft'),
      lifecycleState: 'in_review',
      visibility: 'private',
      ownerId: 'author-1',
      updatedAt: Date.now(),
      deletedAt: null,
    };

    // Public doc passes
    expect(() => assertStaticIndexIsPublic([publicDoc])).not.toThrow();

    // Private doc throws SearchPrivacyViolation
    expect(() => assertStaticIndexIsPublic([publicDoc, internalDraftDoc])).toThrow(
      /privacy violation/,
    );
  });
});
