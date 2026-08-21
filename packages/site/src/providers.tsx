/**
 * SubstrateProviders — React Query provider wrapper with optional outer provider.
 *
 * The platform provides the shell; the application provides the
 * configured providers. This keeps the platform free of any knowledge
 * about API endpoints, auth, or transport.
 *
 * ## With tRPC
 *
 * ```tsx
 * import { SubstrateProviders } from '@substrate-platform/site/providers';
 * import { trpc, getTrpcLink, createQueryClient } from './lib/trpc';
 *
 * <SubstrateProviders
 *   queryClient={queryClient}
 *   outerProvider={trpc.Provider}
 *   outerProps={{ client: trpcClient }}
 * >
 *   {children}
 * </SubstrateProviders>
 * ```
 *
 * ## Without tRPC (static site)
 *
 * ```tsx
 * <SubstrateProviders queryClient={queryClient}>
 *   {children}
 * </SubstrateProviders>
 * ```
 */
'use client';

import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ComponentType, ReactNode } from 'react';

export type SubstrateProvidersProps = {
  children: ReactNode;
  queryClient: QueryClient;
  /**
   * Optional outer provider component (e.g. `trpc.Provider`).
   * Receives `outerProps` plus `children`.
   * Omit for static sites that only need React Query.
   */
  outerProvider?: ComponentType<Record<string, unknown> & { children: ReactNode }>;
  /** Props to pass to `outerProvider` (excluding children). */
  outerProps?: Record<string, unknown>;
};

export function SubstrateProviders({
  children,
  queryClient,
  outerProvider,
  outerProps,
}: SubstrateProvidersProps) {
  const inner = <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

  if (outerProvider) {
    const Outer = outerProvider;
    return <Outer {...(outerProps ?? {})}>{inner}</Outer>;
  }

  return inner;
}
