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

// ── Site config ──────────────────────────────────────────────────────

export type SubsystemName = 'Lattice' | 'Crucible' | 'Archive';
export type SiteConfig = {
  brand: 'Aevum';
  domain: string;
  subsystems: readonly SubsystemName[];
};

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
  subsystem: z.enum(['lattice', 'crucible', 'archive']),
  parameters: z.record(z.string()),
  result: z.record(z.unknown()).optional(),
  durationMs: z.number().int().positive().optional(),
});

// ── tRPC ─────────────────────────────────────────────────────────────

const t = initTRPC.create();
export const router = t.router;
export const publicProcedure = t.procedure;

export const appRouter = t.router({
  health: publicProcedure.query(() => ({ status: 'ok', brand: 'Aevum' as const })),
  articles: publicProcedure.input(z.object({ slug: z.string() })).query(({ input }) => {
    // Article data is fetched via Server Actions (@substrate/web/actions/search)
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

// ── Zustand stores ──────────────────────────────────────────────────

export type { CrucibleState, LatticeState, Toast, UIState } from './store';
export { crucibleStore, latticeStore, uiStore } from './store';

// ── OpenAPI ──────────────────────────────────────────────────────────
//
// openApiDocument is intentionally NOT re-exported here to avoid a circular
// dependency: openapi.ts imports articleSchema/experimentSchema from this
// module, and re-exporting openApiDocument would pull openapi.ts in during
// index.ts evaluation — before the schemas are defined.
//
// Import directly from '@substrate/contracts/openapi' instead.
