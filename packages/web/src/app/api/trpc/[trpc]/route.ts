/**
 * tRPC server route handler — serves the tRPC API at /api/trpc.
 *
 * Uses fetchRequestHandler to bridge Next.js Route Handlers to tRPC.
 * The router is defined in @substrate/contracts.
 */
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@substrate/contracts';
import type { NextRequest } from 'next/server';

const createContext = async (req: NextRequest) => {
  return {
    req,
    // Add auth session, database client, etc. here in production.
  };
};

async function handler(req: NextRequest) {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    router: appRouter,
    req,
    createContext: () => createContext(req),
    onError:
      process.env.NODE_ENV === 'development'
        ? ({ path, error }) => console.error(`[tRPC] ${path}: ${error.message}`)
        : undefined,
  });
}

export { handler as GET, handler as POST };
