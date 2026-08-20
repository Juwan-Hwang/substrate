/**
 * @substrate/contracts — Shared type contracts, schemas, tRPC, auth.
 *
 * The single source of truth for cross-package types, Zod schemas,
 * tRPC router definitions, Better Auth config, and Effect services.
 */
import { initTRPC } from '@trpc/server';
import { z } from 'zod';

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

// ── Zod schemas ──────────────────────────────────────────────────────

export const articleSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string().max(120),
  excerpt: z.string().optional(),
  tags: z.array(z.string()).default([]),
  date: z.string().datetime(),
});

export const experimentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  subsystem: z.string(),
  parameters: z.record(z.string()),
  result: z.record(z.unknown()).optional(),
  durationMs: z.number().int().positive().optional(),
});

// ── tRPC ─────────────────────────────────────────────────────────────

const t = initTRPC.create();
export const router = t.router;
export const publicProcedure = t.procedure;

export const appRouter = t.router({
  health: publicProcedure.query(() => ({ status: 'ok' as const })),
  articles: publicProcedure.input(z.object({ slug: z.string() })).query(({ input }) => {
    // Article data is fetched via application Server Actions.
    // and the edge API (/api/archive/search). This procedure provides the
    // type contract for tRPC clients. Override in the web app's tRPC
    // server handler to inject database access via the context.
    return { slug: input.slug, title: '', body: '' };
  }),
});

export type AppRouter = typeof appRouter;

// ── Effect ──────────────────────────────────────────────────────────

export type {
  AIService as AIServiceT,
  DatabaseService as DatabaseServiceT,
  LoggerService as LoggerServiceT,
} from './effect';
export {
  AIService,
  ConsoleLoggerLayer,
  createAILayer,
  createDatabaseLayer,
  DatabaseError,
  DatabaseService,
  fetchArticleBySlug,
  LoggerService,
  NotFoundError,
  runEffect,
  submitExperimentEffect,
  ValidationError,
} from './effect';

// ── XState ──────────────────────────────────────────────────────────

export type {
  ExperimentContext,
  ExperimentEvent,
  ExperimentStatus,
  RendererContext,
  RendererEvent,
  RendererStatus,
} from './state-machine';
export {
  createExperimentActor,
  createRendererActor,
  experimentMachine,
  rendererMachine,
} from './state-machine';

// ── v1.3 Core Primitives ─────────────────────────────────────────────

// Lifecycle primitive — pure types, no deps.
export type { LifecycleDefinition, LifecycleValidationResult } from './lifecycle';
export {
  validateLifecycle,
  resolveTransition,
  availableTransitions,
} from './lifecycle';

// Entity resolver — pure types, no deps.
export type { EntityRef, EntitySnapshot, EntityResolver } from './entity-resolver';
export { entityRef, entityRefKey } from './entity-resolver';

// Authorization engine — depends on entity-resolver for EntityRef.
export type {
  Principal,
  AuthOperation,
  AuthorizationContext,
  AuthorizationDecision,
  AuthorizationPolicy,
  AuthQueryIntent,
  SqlFragment,
  OramaFilter,
  MemoryPredicate,
  ConstraintCompiler,
  AuthorizationBundle,
  PreflightResult,
} from './authorization';
export {
  principal,
  ANONYMOUS,
  preflight,
  revalidate,
} from './authorization';

// ChangeSet + TransactionalCommitEngine — depends on entity-resolver + authorization.
export type {
  DomainOperation,
  ChangeSet,
  SnapshotReference,
  Transaction,
  CommitResult,
  TransactionalCommitEngine,
} from './changeset';
export {
  createChangeSet,
  commitOk,
  commitFail,
} from './changeset';

// Publish protocol — depends on all above.
export type {
  PreviewState,
  PublicImpactAssessment,
  PreviewConfirmation,
  PublishDeps,
  PublishError,
  PublishSuccess,
  PublishFailure,
  PublishResult,
} from './publish';
export {
  executePublish,
  buildPreview,
  buildImpact,
  confirmPreview,
  hashPreviewState,
  hashPublicImpact,
} from './publish';

// Search privacy — depends on authorization.
export type {
  SearchMode,
  SearchRequest,
  SearchResult,
  SearchResponse,
  ServerSearchParams,
} from './search-privacy';
export {
  mustUseServer,
  assertStaticIndexIsPublic,
  authorizedSearch,
  SearchPrivacyViolation,
} from './search-privacy';

// Association primitive — depends on entity-resolver for EntityRef.
export type { Association } from './association';
export { association, isSameAssociation } from './association';

// Purge safety — depends on entity-resolver for EntityRef.
export type {
  PurgeContract,
  GarbageCollector,
  GarbageCollectionResult,
} from './purge';

// Storage abstraction — pure interfaces, no deps.
export type {
  Hash,
  SerializedState,
  AssetMetadata,
  Asset,
  Representation,
  SnapshotStore,
  StoredSnapshot,
  SnapshotListFilter,
  ContentAddressedStore,
  AssetStore,
  StoreAdapter,
} from './storage';

// ── Zustand stores ──────────────────────────────────────────────────

export type { CrucibleState, LatticeState, Toast, UIState } from './store';
export { crucibleStore, latticeStore, uiStore } from './store';

// ── OpenAPI ──────────────────────────────────────────────────────────
//
// openApiDocument is intentionally NOT re-exported here. The platform
// provides a factory (`createOpenApiDocument`) and reusable schemas in
// `./openapi`. The application calls the factory with its own config.
//
// Import directly from '@substrate/contracts/openapi' instead.
