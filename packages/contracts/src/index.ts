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
    return { slug: input.slug, title: 'Placeholder', body: '' };
  }),
});

export type AppRouter = typeof appRouter;

// ── Effect ──────────────────────────────────────────────────────────

export {
  DatabaseService,
  LoggerService,
  AIService,
  ConsoleLoggerLayer,
  createDatabaseLayer,
  createAILayer,
  runEffect,
  fetchArticleBySlug,
  submitExperimentEffect,
  DatabaseError,
  ValidationError,
  NotFoundError,
} from './effect';
export type { DatabaseService as DatabaseServiceT, LoggerService as LoggerServiceT, AIService as AIServiceT } from './effect';

// ── XState ──────────────────────────────────────────────────────────

export {
  experimentMachine,
  createExperimentActor,
  rendererMachine,
  createRendererActor,
} from './state-machine';
export type {
  ExperimentStatus,
  ExperimentContext,
  ExperimentEvent,
  RendererStatus,
  RendererContext,
  RendererEvent,
} from './state-machine';

// ── Zustand stores ──────────────────────────────────────────────────

export { uiStore, latticeStore, crucibleStore } from './store';
export type { UIState, LatticeState, CrucibleState, Toast } from './store';

// ── OpenAPI ──────────────────────────────────────────────────────────

export { openApiDocument } from './openapi';
export type { OpenApiDocument } from './openapi';
