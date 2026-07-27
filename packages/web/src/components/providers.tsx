/**
 * Providers — React Query + tRPC provider wrapper.
 *
 * Wrap the app in this component to enable tRPC hooks throughout:
 *
 * ```tsx
 * // app/layout.tsx
 * <Providers>{children}</Providers>
 * ```
 */
'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { createQueryClient, getTrpcLink, trpc } from '../lib/trpc';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: getTrpcLink(),
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
