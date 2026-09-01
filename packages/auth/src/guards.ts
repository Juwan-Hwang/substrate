/**
 * @substrate-platform/auth — Route Guard Primitives & Open Redirect Protection.
 *
 * Implements:
 * - `sanitizeReturnTo`: Strictly validates relative redirect paths to prevent Open Redirect attacks.
 * - `guardApi(request, options)`: Returns `{ authorized: true, identity }` or 403 Forbidden Response.
 * - `guardPage(request, options)`: Returns `{ authorized: true, identity }` or 307 Redirect Response with sanitized returnTo parameter.
 * - `assertAdmin(request, provider)`: Direct assertion helper propagating identity or throwing 403 response error.
 */

import type {
  AdminIdentity,
  AdminIdentityProvider,
  GuardApiOptions,
  GuardPageOptions,
  GuardResult,
} from './types';

/**
 * Sanitizes a candidate `returnTo` URL parameter to prevent Open Redirect vulnerabilities.
 * Strictly enforces that the target is a relative path starting with a single `/`.
 * Rejects protocol-relative URLs (`//evil.com`), backslashes (`/\evil.com`),
 * control characters, and explicit URL schemes (`javascript:`, `https:`).
 *
 * @param returnTo The candidate redirect URL/path.
 * @param fallbackPath The safe fallback path if validation fails (default: '/').
 */
export function sanitizeReturnTo(returnTo: string | null | undefined, fallbackPath = '/'): string {
  if (!returnTo || typeof returnTo !== 'string') {
    return fallbackPath;
  }

  const trimmed = returnTo.trim();

  // Must start with a single '/' and never '//' or '/\'
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return fallbackPath;
  }

  // Reject backslashes which can be normalized to forward slashes in some user agents
  if (trimmed.includes('\\')) {
    return fallbackPath;
  }

  // Reject C0 control characters and DEL (browsers normalize tabs/newlines in URLs)
  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) {
      return fallbackPath;
    }
  }

  // Reject explicit protocol schemes before queries or hash fragments
  const pathOnly = trimmed.split('?')[0]?.split('#')[0] ?? '';
  if (pathOnly.includes(':')) {
    return fallbackPath;
  }

  return trimmed;
}

/**
 * Guard primitive for JSON API routes.
 *
 * Checks credentials via the provided `AdminIdentityProvider`.
 * If authenticated, returns `{ authorized: true, identity }`.
 * If unauthenticated, returns `{ authorized: false, response }` where response is a 403 JSON error.
 */
export async function guardApi(request: Request, options: GuardApiOptions): Promise<GuardResult> {
  const identity = await options.provider.resolve(request);

  if (identity) {
    return { authorized: true, identity };
  }

  const response = Response.json(
    {
      success: false,
      error: 'Forbidden: Valid administrative credentials or session required.',
    },
    { status: 403 },
  );

  return { authorized: false, response };
}

/**
 * Guard primitive for HTML Page routes / Server Components / Middleware.
 *
 * Checks credentials via the provided `AdminIdentityProvider`.
 * If authenticated, returns `{ authorized: true, identity }`.
 * If unauthenticated, returns `{ authorized: false, response, redirectUrl }` redirecting to `loginPath`.
 */
export async function guardPage(request: Request, options: GuardPageOptions): Promise<GuardResult> {
  const identity = await options.provider.resolve(request);

  if (identity) {
    return { authorized: true, identity };
  }

  let requestPath = '/';
  let targetUrl: URL;

  try {
    const currentUrl = new URL(request.url);
    requestPath = currentUrl.pathname + currentUrl.search;
    targetUrl = new URL(options.loginPath ?? '/login', currentUrl.origin);
  } catch {
    targetUrl = new URL(options.loginPath ?? '/login', 'http://localhost');
  }

  const sanitized = sanitizeReturnTo(requestPath, '');
  if (sanitized && sanitized !== '/' && sanitized !== (options.loginPath ?? '/login')) {
    targetUrl.searchParams.set('returnTo', sanitized);
  }

  const redirectUrl = targetUrl.toString();
  const response = Response.redirect(redirectUrl, 307);

  return {
    authorized: false,
    response,
    redirectUrl,
  };
}

/**
 * Direct assertion utility for route handlers.
 * Resolves identity or throws a standard 403 Response.
 */
export async function assertAdmin(
  request: Request,
  provider: AdminIdentityProvider,
): Promise<AdminIdentity> {
  const identity = await provider.resolve(request);
  if (!identity) {
    throw new Response(
      JSON.stringify({
        success: false,
        error: 'Forbidden: Administrator credentials required.',
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    );
  }
  return identity;
}
