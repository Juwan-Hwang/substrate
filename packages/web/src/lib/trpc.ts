/**
 * tRPC client — type-safe API client for the web app.
 *
 * Uses @trpc/react-query to bind the tRPC client to React Query,
 * providing automatic caching, refetching, and optimistic updates.
 *
 * The server router is defined in @substrate/contracts and served at /api/trpc.
 */
import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink, loggerLink } from '@trpc/client';
import type { AppRouter } from '@substrate/contracts';
import { QueryClient } from '@tanstack/react-query';

/**
 * tRPC React hook — use throughout the app:
 *
 * ```tsx
 * const utils = trpc.useUtils();
 * const { data } = trpc.health.useQuery();
 * const mutation = trpc.articles.get.useMutation();
 * ```
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Create a tRPC client link configuration.
 * Uses batch HTTP requests to /api/trpc with optional logging in dev.
 */
export function getTrpcLink() {
  return [
    loggerLink({
      enabled: (opts) =>
        process.env.NODE_ENV === 'development' ||
        (opts.direction === 'down' && opts.result instanceof Error),
    }),
    httpBatchLink({
      url: '/api/trpc',
      async headers() {
        return {
          'x-trpc-source': 'nextjs-react',
        };
      },
    }),
  ];
}

/**
 * Create a new QueryClient with sensible defaults.
 * Called per-request on the server, once on the client.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        gcTime: 5 * 60 * 1000, // 5 minutes
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
