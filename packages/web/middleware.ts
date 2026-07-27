/**
 * Next.js middleware — auth session check for protected routes.
 *
 * Intercepts requests to /crucible/* and /api/crucible/* to verify
 * the user is authenticated. Redirects to /auth if not.
 *
 * Uses Better Auth's session cookie signature verification — not just
 * cookie existence — to prevent forged-session bypasses.
 */
import { createAuth } from '@substrate/contracts/auth';
import { type NextRequest, NextResponse } from 'next/server';

const PROTECTED_PATHS = ['/crucible', '/api/crucible', '/api/admin'];
const AUTH_PATH = '/auth';

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

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Check if the path is protected.
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));

  if (!isProtected) {
    return NextResponse.next();
  }

  // Verify the Better Auth session server-side.
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session) {
      // API routes get 401, pages get redirected.
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const loginUrl = new URL(AUTH_PATH, req.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  } catch {
    // Session verification failed — treat as unauthenticated.
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
