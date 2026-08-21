/**
 * @substrate-platform/contracts/authorization — Authorization Engine.
 *
 * Two-layer architecture:
 *   1. Semantic Layer (AuthorizationPolicy): "can this principal
 *      perform this operation on this entity?" → boolean
 *   2. Query Enforcement Layer (ConstraintCompiler): "what can this
 *      principal see in bulk?" → backend-specific query fragment
 *
 * The platform defines the interfaces and call sequence.
 * The application implements the policy and per-backend compilers.
 *
 * See: architecture-contract-v1.3.md §2.2 + §3.
 */

import type { EntityRef } from './entity-resolver';

// Re-export EntityRef so consumers can import everything from authorization.
export type { EntityRef } from './entity-resolver';
export { entityRef, entityRefKey } from './entity-resolver';

// ── Principal ───────────────────────────────────────────────────────

/**
 * Who is making the request.
 *
 * `userId: null` means anonymous.
 * `roles` is application-defined: 'owner', 'editor', etc.
 */
export interface Principal {
  readonly userId: string | null;
  readonly roles: readonly string[];
}

/**
 * Create a Principal. Convenience constructor.
 */
export function principal(userId: string | null, roles: readonly string[] = []): Principal {
  return { userId, roles } as const;
}

/**
 * The anonymous principal.
 */
export const ANONYMOUS: Principal = Object.freeze({
  userId: null,
  roles: [],
}) as Principal;

// ── Semantic Layer ──────────────────────────────────────────────────

/** Operations the platform asks the application to authorize. */
export type AuthOperation = 'read' | 'write' | 'delete' | 'publish' | 'transition';

/** Context passed to the policy for a single-entity authorization decision. */
export interface AuthorizationContext {
  readonly principal: Principal;
  readonly entityRef: EntityRef;
  readonly operation: AuthOperation;
}

/** The policy's decision for a single-entity check. */
export interface AuthorizationDecision {
  readonly allow: boolean;
}

/**
 * Application-supplied semantic policy.
 *
 * `decide()` is a pure function (may be async for entity resolution)
 * that returns a boolean. It must NOT return SQL, Drizzle, Orama,
 * or any backend-specific type.
 */
export interface AuthorizationPolicy {
  decide(ctx: AuthorizationContext): Promise<AuthorizationDecision>;
}

// ── Query Enforcement Layer ─────────────────────────────────────────

/**
 * Platform-neutral authorization intent.
 *
 * The application produces this from its AuthorizationPolicy. It is a
 * serializable, backend-neutral description of what the principal can see.
 *
 * The platform does NOT interpret this object. The application also
 * provides per-backend compilers that translate it into concrete queries.
 */
export interface AuthQueryIntent {
  readonly [key: string]: unknown;
}

// ── Backend Fragment Types (platform-defined) ───────────────────────

/** Platform-defined: a SQL WHERE fragment + params. */
export interface SqlFragment {
  readonly sql: string;
  readonly params: readonly unknown[];
}

/** Platform-defined: an Orama where-filter object. */
export type OramaFilter = Record<string, unknown>;

/** Platform-defined: an in-memory predicate function. */
export type MemoryPredicate = (doc: unknown) => boolean;

/**
 * Per-backend constraint compiler — application implements one per backend.
 *
 * The platform defines this interface and the call sequence:
 *   1. policy.buildQueryIntent(principal) → AuthQueryIntent
 *   2. compiler.compile(intent) → backend-specific query fragment
 *   3. platform backend.query(fragment) → results
 *
 * HARD RULE: A ConstraintCompiler is a **pure function**. It must NOT:
 *   - Hold or obtain a database connection
 *   - Execute any I/O or side effect
 *   - Call the platform's query engine directly
 * It only produces a fragment that the platform's query layer executes.
 */
export interface ConstraintCompiler<TQueryFragment> {
  compile(intent: AuthQueryIntent): TQueryFragment;
}

// ── AuthorizationBundle ────────────────────────────────────────────

/**
 * Application-supplied authorization bundle.
 *
 * The application registers this with the platform at startup. It contains:
 *   - The semantic policy (decide)
 *   - The query intent builder (bulk read constraints)
 *   - Per-backend compilers (PostgreSQL, Orama, memory predicate)
 */
export interface AuthorizationBundle {
  readonly policy: AuthorizationPolicy;
  readonly buildQueryIntent: (principal: Principal) => Promise<AuthQueryIntent | null>;
  readonly compilers: {
    readonly postgres?: ConstraintCompiler<SqlFragment>;
    readonly orama?: ConstraintCompiler<OramaFilter>;
    readonly memory?: ConstraintCompiler<MemoryPredicate>;
  };
}

// ── Two-Phase Authorization ─────────────────────────────────────────

/**
 * Result of a preflight (Phase A) authorization check.
 *
 * Preflight is advisory-only (UX optimization). The binding decision
 * is the revalidation inside the transaction (Phase B).
 */
export interface PreflightResult {
  readonly allow: boolean;
  readonly reason?: string;
}

/**
 * Phase A: Preflight (outside transaction).
 *
 * Fast reject for UI feedback. Result is **advisory only** — the
 * security-critical decision is the revalidation in Phase B.
 *
 * The platform MUST NOT document preflight as the final authorization
 * decision, even for single-author deployments.
 */
export async function preflight(
  bundle: AuthorizationBundle,
  ctx: AuthorizationContext,
): Promise<PreflightResult> {
  const decision = await bundle.policy.decide(ctx);
  return { allow: decision.allow };
}

/**
 * Phase B: Revalidation (inside transaction, after lock).
 *
 * This is the **binding** security decision. It re-evaluates the
 * policy after acquiring a row lock, preventing TOCTOU races.
 *
 * If this returns `false`, the caller MUST ROLLBACK and return 403.
 */
export async function revalidate(
  bundle: AuthorizationBundle,
  ctx: AuthorizationContext,
): Promise<boolean> {
  const decision = await bundle.policy.decide(ctx);
  return decision.allow;
}
