/**
 * @substrate-platform/contracts — Core type contracts and platform primitives.
 *
 * The single source of truth for cross-package types and Zod schemas.
 *
 * This entrypoint has **zero heavyweight runtime dependencies**. Optional
 * integration capabilities (tRPC, Effect, Zustand, OpenAPI) are available
 * via subpath exports:
 *
 *   @substrate-platform/contracts/trpc    — tRPC router builder
 *   @substrate-platform/contracts/effect  — Effect service composition
 *   @substrate-platform/contracts/store   — Zustand UI store
 *   @substrate-platform/contracts/openapi — OpenAPI document factory
 */

// ── Brand types ──────────────────────────────────────────────────────

export type Brand<T, B extends string> = T & { readonly __brand: B };
export type EntityId = Brand<string, 'EntityId'>;

export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// ── Site identity ────────────────────────────────────────────────────
//
// The platform only knows that a site has a name and a URL.
// Concrete values (e.g. "My Site", "https://example.com") are supplied
// by the application.

export interface SiteIdentity {
  name: string;
  url: string;
}

// ── v1.3 Core Primitives ─────────────────────────────────────────────

// Association primitive — depends on entity-resolver for EntityRef.
export type { Association } from './association';
export { association, isSameAssociation } from './association';
// Authorization engine — depends on entity-resolver for EntityRef.
export type {
  AuthOperation,
  AuthorizationBundle,
  AuthorizationContext,
  AuthorizationDecision,
  AuthorizationPolicy,
  AuthQueryIntent,
  ConstraintCompiler,
  MemoryPredicate,
  OramaFilter,
  PreflightResult,
  Principal,
  SqlFragment,
} from './authorization';
export {
  ANONYMOUS,
  preflight,
  principal,
  revalidate,
} from './authorization';
// ChangeSet + TransactionalCommitEngine — depends on entity-resolver + authorization.
export type {
  ChangeSet,
  CommitResult,
  DomainOperation,
  SnapshotReference,
  Transaction,
  TransactionalCommitEngine,
} from './changeset';
export {
  commitFail,
  commitOk,
  createChangeSet,
} from './changeset';
// Entity resolver — pure types, no deps.
export type { EntityRef, EntityResolver, EntitySnapshot } from './entity-resolver';
export { entityRef, entityRefKey } from './entity-resolver';
// Lifecycle primitive — pure types, no deps.
export type { LifecycleDefinition, LifecycleValidationResult } from './lifecycle';
export {
  availableTransitions,
  resolveTransition,
  validateLifecycle,
} from './lifecycle';
// Publish protocol — depends on all above.
export type {
  PreviewConfirmation,
  PreviewState,
  PublicImpactAssessment,
  PublishDeps,
  PublishError,
  PublishFailure,
  PublishResult,
  PublishSuccess,
} from './publish';
export {
  buildImpact,
  buildPreview,
  confirmPreview,
  executePublish,
  hashPreviewState,
  hashPublicImpact,
} from './publish';
// Purge safety — depends on entity-resolver for EntityRef.
export type {
  GarbageCollectionResult,
  GarbageCollector,
  PurgeContract,
} from './purge';
// Search privacy — depends on authorization.
export type {
  SearchMode,
  SearchRequest,
  SearchResponse,
  SearchResult,
  ServerSearchParams,
} from './search-privacy';
export {
  assertStaticIndexIsPublic,
  authorizedSearch,
  mustUseServer,
  SearchPrivacyViolation,
} from './search-privacy';

// Storage abstraction — pure interfaces, no deps.
export type {
  Asset,
  AssetMetadata,
  AssetStore,
  ContentAddressedStore,
  Hash,
  Representation,
  SerializedState,
  SnapshotListFilter,
  SnapshotStore,
  StoreAdapter,
  StoredSnapshot,
} from './storage';

// ── Optional integration subpaths ───────────────────────────────────
//
// The following capabilities are NOT re-exported from this root entry.
// Import them directly from their subpath to avoid pulling in heavyweight
// runtime dependencies:
//
//   @substrate-platform/contracts/trpc    — tRPC router builder + appRouter
//   @substrate-platform/contracts/effect  — Effect service composition (Context, Layer)
//   @substrate-platform/contracts/store   — Zustand vanilla UI store
//   @substrate-platform/contracts/openapi — OpenAPI 3.1 document factory
