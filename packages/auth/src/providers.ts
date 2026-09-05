/**
 * @substrate-platform/auth — Identity Providers.
 *
 * Implements:
 * - Development Identity Provider (loopback trust, remote deny).
 * - Static Token & Dual-Channel Identity Provider (Bearer header + Cookie, SHA-256 timingSafeEqual, fail-closed).
 */

import { timingSafeEqualStrings } from './crypto';
import { createSessionIssuer } from './session';
import type { AdminIdentity, AdminIdentityProvider, StaticTokenProviderOptions } from './types';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Development-only provider: trusts loopback requests without credentials.
 * Non-loopback hosts are strictly denied — development mode must not be remotely mutable.
 */
export function createDevelopmentIdentityProvider(): AdminIdentityProvider {
  return {
    resolve(request: Request): AdminIdentity | null {
      let hostname: string;
      try {
        hostname = new URL(request.url).hostname;
      } catch {
        const hostHeader = request.headers.get('host') || request.headers.get('x-forwarded-host');
        if (!hostHeader) return null;
        hostname = hostHeader.split(':')[0] ?? '';
      }

      if (!LOOPBACK_HOSTS.has(hostname)) {
        return null;
      }

      return { subject: 'development', mechanism: 'dev-trust' };
    },
  };
}

/**
 * Parses the `Cookie` header into key-value pairs.
 */
export function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const cookies: Record<string, string> = {};
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx !== -1) {
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      if (key) {
        try {
          cookies[key] = decodeURIComponent(val);
        } catch {
          cookies[key] = val;
        }
      }
    }
  }
  return cookies;
}

/**
 * Dual-channel Static Token & Session Identity Provider.
 *
 * Checks:
 * 1. `Authorization: Bearer <token>` (or configured header)
 * 2. `Cookie: <cookieName>=<token>`
 *
 * Evaluation:
 * - Constant-time SHA-256 comparison (`timingSafeEqualStrings`) against static `secret`.
 * - Stateless HMAC verification if session issuer is provided or token is signed session.
 * - Fail-closed: when `secret` is undefined or empty string, ALL requests are denied.
 */
export function createStaticTokenIdentityProvider(
  secret: string | undefined,
  options: StaticTokenProviderOptions = {},
): AdminIdentityProvider {
  const cookieName = options.cookieName ?? 'substrate_session';
  const headerName = options.headerName ?? 'authorization';
  const sessionIssuer = options.sessionIssuer ?? (secret ? createSessionIssuer(secret) : null);

  return {
    async resolve(request: Request): Promise<AdminIdentity | null> {
      if (!secret && !sessionIssuer) {
        return null;
      }

      // ── Channel 1: Authorization Header ──────────────────────────────
      const authHeader = request.headers.get(headerName);
      if (authHeader) {
        let bearerToken: string | null = null;
        if (authHeader.toLowerCase().startsWith('bearer ')) {
          bearerToken = authHeader.slice('bearer '.length).trim();
        } else if (headerName.toLowerCase() !== 'authorization') {
          // Custom header (e.g. X-Admin-Token)
          bearerToken = authHeader.trim();
        }

        if (bearerToken) {
          if (secret && timingSafeEqualStrings(bearerToken, secret)) {
            return { subject: 'admin', mechanism: 'static-token' };
          }

          if (sessionIssuer) {
            const session = await sessionIssuer.verify(bearerToken);
            if (session) {
              return {
                subject: session.subject,
                mechanism: 'bearer-session',
                ...(session.amr ? { amr: session.amr } : {}),
              };
            }
          }
        }
      }

      // ── Channel 2: Cookie ───────────────────────────────────────────
      const cookieHeader = request.headers.get('cookie');
      if (cookieHeader) {
        const cookies = parseCookies(cookieHeader);
        const cookieToken = cookies[cookieName];

        if (cookieToken) {
          if (secret && timingSafeEqualStrings(cookieToken, secret)) {
            return { subject: 'admin', mechanism: 'cookie-static' };
          }

          if (sessionIssuer) {
            const session = await sessionIssuer.verify(cookieToken);
            if (session) {
              return {
                subject: session.subject,
                mechanism: 'cookie-session',
                ...(session.amr ? { amr: session.amr } : {}),
              };
            }
          }
        }
      }

      return null;
    },
  };
}
