/**
 * tRPC server route handler — serves the tRPC API at /api/trpc.
 *
 * Uses fetchRequestHandler to bridge Next.js Route Handlers to tRPC.
 * The router is defined in @substrate/contracts.
 *
 * The createContext function injects the authenticated Better Auth
 * session into every tRPC procedure, enabling per-request authorization.
 */

import * as Sentry from '@sentry/nextjs';
import { type AppRouter, appRouter } from '@substrate/contracts';
import { createAuth } from '@substrate/contracts/auth';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import type { NextRequest } from 'next/server';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is required. Set it in your environment or .env file. ` +
        'See .env.example for all required variables.',
    );
  }
  return value;
}

const auth = createAuth({
  databaseUrl: requireEnv('DATABASE_URL'),
  secret: requireEnv('AUTH_SECRET'),
  baseUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
});

type Session = Awaited<ReturnType<typeof auth.api.getSession>>;

export type Context = {
  req: NextRequest;
  session: Session;
};

async function createContext(req: NextRequest): Promise<Context> {
  let session: Session = null;
  try {
    session = await auth.api.getSession({ headers: req.headers });
  } catch {
    // Session verification failed — proceed without session.
    // Protected procedures will reject the request.
  }
  return { req, session };
}

async function handler(req: NextRequest) {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    router: appRouter as AppRouter,
    req,
    createContext: () => createContext(req),
    onError: ({ path, error }) => {
      if (process.env.NODE_ENV === 'development') {
        console.error(`[tRPC] ${path}: ${error.message}`);
      }
      if (process.env.NODE_ENV === 'production') {
        Sentry.captureException(error, { tags: { trpc_path: path ?? 'unknown' } });
      }
    },
  });
}

export { handler as GET, handler as POST };
