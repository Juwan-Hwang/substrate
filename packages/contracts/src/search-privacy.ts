/**
 * @substrate-platform/contracts/search-privacy — Search Privacy Enforcement.
 *
 * Hard rules (§6):
 *   1. Static indexes contain ONLY already-public content.
 *   2. No client-side filtering of private data — the browser must
 *      never receive Private/Restricted content that it then hides.
 *   3. Private/Restricted search goes through the server with
 *      authorization check + server-side query.
 *   4. Static indexes may be used for authenticated scopes ONLY if
 *      the index is built per-scope at the server and data is
 *      pre-authorized before inclusion.
 *
 * See: architecture-contract-v1.3.md §6.
 */

import type { AuthorizationBundle, AuthQueryIntent, Principal } from './authorization';

// ── Search Backend Types ───────────────────────────────────────────

/**
 * Backend-neutral search mode.
 * Matches the Feature Manifest `search` enum.
 */
export type SearchMode = 'off' | 'static' | 'server' | 'hybrid';

/**
 * A search request.
 */
export interface SearchRequest {
  readonly query: string;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * A search result item.
 */
export interface SearchResult {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly excerpt: string | null;
  readonly score: number;
}

/**
 * A search response.
 */
export interface SearchResponse {
  readonly results: readonly SearchResult[];
  readonly total: number;
}

// ── Search Privacy Gate ─────────────────────────────────────────────

/**
 * Determine whether a search request must go through the server.
 *
 * Rule: if the principal is authenticated (non-anonymous) OR the
 * search mode is 'server'/'hybrid', the search must go through
 * server-side authorized retrieval.
 *
 * Only 'static' mode with an anonymous principal may use a
 * pre-built public-only client-side index.
 */
export function mustUseServer(mode: SearchMode, principal: Principal): boolean {
  if (mode === 'off') return false;
  if (mode === 'server') return true;
  if (mode === 'hybrid') return true;
  // mode === 'static'
  // Anonymous principals can use the static public index.
  // Authenticated principals MUST go through the server.
  return principal.userId !== null;
}

/**
 * Verify that a static search index contains ONLY public content.
 *
 * This is a runtime assertion that the application should call when
 * building static indexes. It throws if any item is not public.
 *
 * The application defines what "public" means — the platform only
 * provides the assertion mechanism.
 */
export function assertStaticIndexIsPublic(
  items: readonly { visibility: string }[],
  isPublic: (visibility: string) => boolean,
): void {
  for (const item of items) {
    if (!isPublic(item.visibility)) {
      throw new SearchPrivacyViolation(
        `Static search index contains non-public item (visibility: ${item.visibility}). ` +
          'This is a hard privacy violation. See §6.1.',
      );
    }
  }
}

/**
 * Error thrown when search privacy is violated.
 */
export class SearchPrivacyViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SearchPrivacyViolation';
  }
}

// ── Server-Side Authorized Search ──────────────────────────────────

/**
 * Parameters for server-side authorized search.
 */
export interface ServerSearchParams extends SearchRequest {
  readonly principal: Principal;
  readonly authBundle: AuthorizationBundle;
}

/**
 * Execute a server-side authorized search.
 *
 * Flow:
 *   1. principal → authBundle.buildQueryIntent() → AuthQueryIntent
 *   2. AuthQueryIntent → compiler.compile() → backend fragment
 *   3. backend.query(fragment + search terms) → results
 *
 * The platform NEVER sends private/restricted data to the client
 * before authorization. The browser never receives data it must hide.
 */
export async function authorizedSearch(
  params: ServerSearchParams,
  executeQuery: (request: SearchRequest, intent: AuthQueryIntent | null) => Promise<SearchResponse>,
): Promise<SearchResponse> {
  const intent = await params.authBundle.buildQueryIntent(params.principal);

  if (intent === null) {
    // Principal has no access at all — return empty.
    return { results: [], total: 0 };
  }

  const base: SearchRequest = { query: params.query };
  const request: SearchRequest =
    params.limit !== undefined ? { ...base, limit: params.limit } : base;
  const finalRequest: SearchRequest =
    params.offset !== undefined ? { ...request, offset: params.offset } : request;
  return executeQuery(finalRequest, intent);
}
