/**
 * Next.js middleware — lightweight session cookie check for protected routes.
 *
 * Intercepts requests to /crucible/* and /api/crucible/* to verify
 * the user has a session cookie. Redirects to /auth if not.
 *
 * This runs on the Edge Runtime and MUST NOT make database calls.
 * `getSessionCookie()` only checks cookie existence — it does NOT
 * cryptographically validate the session. Authoritative session
 * validation happens in Node.js runtime (API routes, Server Components,
 * Server Actions) via `auth.api.getSession()`.
 *
 * See: https://better-auth.com/docs/integrations/next#auth-protection
 */
import { getSessionCookie } from 'better-auth/cookies';
import { type NextRequest, NextResponse } from 'next/server';

const PROTECTED_PATHS = ['/crucible', '/api/crucible', '/api/admin'];
const AUTH_PATH = '/auth';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));

  if (!isProtected) {
    return NextResponse.next();
  }

  // Lightweight cookie check — no DB access, Edge-safe.
  const sessionCookie = getSessionCookie(req);

  if (!sessionCookie) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL(AUTH_PATH, req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static assets, _next, and public files.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)',
  ],
};
