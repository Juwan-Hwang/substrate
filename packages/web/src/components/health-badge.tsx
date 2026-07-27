/**
 * HealthBadge — the first real consumer of the tRPC client.
 *
 * Calls `trpc.health.useQuery()` so the mounted tRPC provider actually
 * drives a query. Renders a small status dot + label; stays quiet while
 * loading so first paint isn't blocked by the API round-trip.
 */
'use client';

import { trpc } from '../lib/trpc';

export function HealthBadge() {
  const { data, isLoading, isError } = trpc.health.useQuery();

  if (isLoading) return null;
  if (isError) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-text-tertiary">
        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
        API offline
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-text-tertiary">
      <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
      {data?.brand ?? 'API'} online
    </span>
  );
}
