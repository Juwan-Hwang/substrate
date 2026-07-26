/**
 * nuqs — URL-based state management for search, filters, and pagination.
 *
 * Keeps state in the URL query string so it's shareable, bookmarkable,
 * and survives page refreshes. Uses Next.js searchParams under the hood.
 *
 * ```tsx
 * const [query, setQuery] = useSearchQuery();
 * const [subsystem, setSubsystem] = useSubsystemFilter();
 * const [page, setPage] = usePage();
 * ```
 */
'use client';

import { useQueryState, useQueryStates, parseAsInteger, parseAsString } from 'nuqs';

/** Search query string — ?q=... */
export function useSearchQuery() {
  return useQueryState('q', parseAsString.withDefault(''));
}

/** Subsystem filter — ?subsystem=lattice|crucible|archive */
export function useSubsystemFilter() {
  return useQueryState('subsystem', parseAsString.withDefault('all'));
}

/** Tag filter — ?tag=... */
export function useTagFilter() {
  return useQueryState('tag', parseAsString.withDefault(''));
}

/** Page number — ?page=1 */
export function usePage() {
  return useQueryState('page', parseAsInteger.withDefault(1));
}

/** Combined search params for the Archive listing. */
export function useArchiveParams() {
  return useQueryStates({
    q: parseAsString.withDefault(''),
    tag: parseAsString.withDefault(''),
    page: parseAsInteger.withDefault(1),
  });
}

/** Lattice view config — ?tier=webgpu&labels=true */
export function useLatticeParams() {
  return useQueryStates({
    tier: parseAsString.withDefault('webgpu'),
    labels: parseAsString.withDefault('true'),
    iterations: parseAsInteger.withDefault(500),
  });
}

/** Crucible experiment filter — ?subsystem=...&status=... */
export function useCrucibleParams() {
  return useQueryStates({
    subsystem: parseAsString.withDefault('all'),
    status: parseAsString.withDefault('all'),
  });
}
