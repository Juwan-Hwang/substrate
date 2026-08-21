/**
 * @substrate-platform/contracts/trpc — tRPC router builder and base router.
 *
 * This is an optional integration capability — importing it pulls in
 * `@trpc/server` as a runtime dependency. The core contracts
 * (`@substrate-platform/contracts`) have zero tRPC dependency.
 *
 * ```ts
 * import { router, publicProcedure, appRouter } from '@substrate-platform/contracts/trpc';
 * ```
 */
import { initTRPC } from '@trpc/server';

const t = initTRPC.create();
export const router = t.router;
export const publicProcedure = t.procedure;

export const appRouter = t.router({
  health: publicProcedure.query(() => ({ status: 'ok' as const })),
});

export type AppRouter = typeof appRouter;
