/**
 * @substrate-platform/auth — Route Handler Factories & Rate Limiter.
 *
 * Implements:
 * - In-memory IP rate limiter for brute-force defense.
 * - Framework-agnostic `createLoginHandler` (password verification, timingSafeEqual, Set-Cookie).
 * - Framework-agnostic `createLogoutHandler` (session clearing, POST-only).
 */

import { timingSafeEqualStrings } from './crypto';
import { createSessionIssuer } from './session';
import type {
  ExtractClientIpOptions,
  LoginHandlerOptions,
  LogoutHandlerOptions,
  RateLimiter,
  RateLimiterCheckResult,
} from './types';

/**
 * Options for `createInMemoryRateLimiter`.
 */
export interface InMemoryRateLimiterOptions {
  /** Maximum allowed consecutive failures before cooldown (default: 5). */
  readonly maxAttempts?: number;
  /** Cooldown window in seconds (default: 60). */
  readonly windowSeconds?: number;
}

/**
 * Creates an in-memory IP rate limiter.
 */
export function createInMemoryRateLimiter(options: InMemoryRateLimiterOptions = {}): RateLimiter {
  const maxAttempts = options.maxAttempts ?? 5;
  const windowMs = (options.windowSeconds ?? 60) * 1000;

  const storage = new Map<string, { count: number; resetAt: number }>();

  return {
    check(key: string): RateLimiterCheckResult {
      const now = Date.now();
      const entry = storage.get(key);

      if (!entry) {
        return { allowed: true };
      }

      if (entry.resetAt <= now) {
        storage.delete(key);
        return { allowed: true };
      }

      if (entry.count >= maxAttempts) {
        const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
        return { allowed: false, retryAfterSeconds };
      }

      return { allowed: true };
    },

    recordFailure(key: string): void {
      const now = Date.now();
      const entry = storage.get(key);

      if (!entry || entry.resetAt <= now) {
        storage.set(key, { count: 1, resetAt: now + windowMs });
      } else {
        entry.count += 1;
      }
    },

    reset(key: string): void {
      storage.delete(key);
    },
  };
}

/**
 * Extracts client IP from request headers with priority given to managed proxy headers.
 * Precedence:
 * 1. Explicit `options.proxyHeader`
 * 2. Cloudflare `CF-Connecting-IP`
 * 3. Nginx / reverse proxy `X-Real-IP`
 * 4. `X-Forwarded-For` (when `trustProxy` is not explicitly false)
 * 5. Loopback fallback (`127.0.0.1`)
 */
export function extractClientIp(request: Request, options: ExtractClientIpOptions = {}): string {
  if (options.proxyHeader) {
    const custom = request.headers.get(options.proxyHeader);
    if (custom?.trim()) return custom.trim();
  }

  // 1. Cloudflare edge header (sanitized by Cloudflare edge)
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp?.trim()) return cfConnectingIp.trim();

  // 2. Nginx / Caddy upstream header
  const xRealIp = request.headers.get('x-real-ip');
  if (xRealIp?.trim()) return xRealIp.trim();

  // 3. X-Forwarded-For
  if (options.trustProxy !== false) {
    const xForwardedFor = request.headers.get('x-forwarded-for');
    if (xForwardedFor) {
      const first = xForwardedFor.split(',')[0]?.trim();
      if (first) return first;
    }
  }

  return '127.0.0.1';
}

/**
 * Framework-agnostic route handler factory for admin login.
 *
 * Accepts POST requests containing `{ password: "..." }` or form data,
 * compares credentials in constant time against `secret`, and issues
 * a signed session cookie with strict security flags:
 * `HttpOnly; Secure; SameSite=Lax; Path=/`
 */
export function createLoginHandler(
  options: LoginHandlerOptions = {},
): (request: Request) => Promise<Response> {
  const secret = options.secret;
  const cookieName = options.cookieName ?? 'substrate_session';
  const maxAge = options.maxAgeSeconds ?? 60 * 60 * 24 * 7; // 7 days
  const rateLimiter = options.rateLimiter ?? createInMemoryRateLimiter();
  const sessionIssuer =
    options.sessionIssuer ??
    (secret ? createSessionIssuer(secret, { defaultTtlSeconds: maxAge }) : null);
  const path = options.path ?? '/';
  const sameSite = options.sameSite ?? 'Lax';
  const secureCookie = options.secureCookie ?? process.env.NODE_ENV === 'production';

  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') {
      return Response.json(
        { success: false, error: 'Method not allowed. Use POST for login.' },
        { status: 405, headers: { Allow: 'POST' } },
      );
    }

    const clientIp = extractClientIp(request, options);

    // ── Rate Limiting ──────────────────────────────────────────────
    const rateCheck = await rateLimiter.check(clientIp);
    if (!rateCheck.allowed) {
      const retryAfter = rateCheck.retryAfterSeconds ?? 60;
      return Response.json(
        { success: false, error: 'Too many failed login attempts. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
          },
        },
      );
    }

    // ── Fail-closed when secret is unconfigured ────────────────────
    if (!secret || !sessionIssuer) {
      await rateLimiter.recordFailure(clientIp);
      return Response.json(
        { success: false, error: 'Authentication service unavailable.' },
        { status: 500 },
      );
    }

    // ── Body Extraction ────────────────────────────────────────────
    let candidatePassword = '';
    const contentType = request.headers.get('content-type') || '';

    try {
      if (contentType.includes('application/json')) {
        const body = (await request.json()) as { password?: unknown };
        candidatePassword = typeof body.password === 'string' ? body.password : '';
      } else if (
        contentType.includes('application/x-www-form-urlencoded') ||
        contentType.includes('multipart/form-data')
      ) {
        const formData = await request.formData();
        const pw = formData.get('password');
        candidatePassword = typeof pw === 'string' ? pw : '';
      }
    } catch {
      await rateLimiter.recordFailure(clientIp);
      return Response.json(
        { success: false, error: 'Invalid request body format.' },
        { status: 400 },
      );
    }

    // ── Constant-Time Verification ─────────────────────────────────
    const isMatch = timingSafeEqualStrings(candidatePassword, secret);
    if (!isMatch) {
      await rateLimiter.recordFailure(clientIp);
      return Response.json(
        { success: false, error: 'Invalid password credentials.' },
        { status: 401 },
      );
    }

    // Reset rate limiter on successful authentication
    await rateLimiter.reset?.(clientIp);

    // ── Issue Session & Set Cookie ─────────────────────────────────
    const sessionToken = await sessionIssuer.issue('admin', maxAge);

    const cookieParts = [
      `${cookieName}=${encodeURIComponent(sessionToken)}`,
      `Path=${path}`,
      `Max-Age=${maxAge}`,
      'HttpOnly',
      `SameSite=${sameSite}`,
    ];

    if (secureCookie) {
      cookieParts.push('Secure');
    }

    const setCookieHeader = cookieParts.join('; ');

    return Response.json(
      { success: true, subject: 'admin' },
      {
        status: 200,
        headers: {
          'Set-Cookie': setCookieHeader,
        },
      },
    );
  };
}

/**
 * Framework-agnostic route handler factory for admin logout.
 * Restricts to POST method, clears the session cookie and returns a JSON confirmation.
 */
export function createLogoutHandler(
  options: LogoutHandlerOptions = {},
): (request: Request) => Promise<Response> {
  const cookieName = options.cookieName ?? 'substrate_session';
  const path = options.path ?? '/';

  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') {
      return Response.json(
        { success: false, error: 'Method not allowed. Use POST for logout.' },
        { status: 405, headers: { Allow: 'POST' } },
      );
    }

    const cookieParts = [`${cookieName}=`, `Path=${path}`, 'Max-Age=0', 'HttpOnly', 'SameSite=Lax'];

    const setCookieHeader = cookieParts.join('; ');

    return Response.json(
      { success: true, message: 'Logged out successfully.' },
      {
        status: 200,
        headers: {
          'Set-Cookie': setCookieHeader,
        },
      },
    );
  };
}
