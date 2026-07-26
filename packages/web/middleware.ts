/**
 * Next.js middleware — auth session check for protected routes.
 *
 * Intercepts requests to /crucible/* and /api/crucible/* to verify
 * the user is authenticated. Redirects to /auth if not.
 */
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED_PATHS = ['/crucible', '/api/crucible', '/api/admin'];
const AUTH_PATH = '/auth';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Check if the path is protected.
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));

  if (!isProtected) {
    return NextResponse.next();
  }

  // Check for Better Auth session cookie.
  // Better Auth uses `better-auth.session_token` by default.
  const sessionToken =
    req.cookies.get('better-auth.session_token')?.value ??
    req.cookies.get('__Secure-better-auth.session_token')?.value;

  if (!sessionToken) {
    // API routes get 401, pages get redirected.
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
