/**
 * @substrate-platform/auth — Type definitions and contracts.
 *
 * Provides domain-agnostic identity contracts, session contracts,
 * rate limiter contracts, and guard parameter interfaces.
 */

// Re-export core identity contracts from platform contracts
export type {
  AdminIdentity,
  AdminIdentityProvider,
  OperationContext,
} from '@substrate-platform/contracts';

import type { AdminIdentity, AdminIdentityProvider } from '@substrate-platform/contracts';

/**
 * Decoded payload contained inside a stateless signed session token.
 */
export interface SessionPayload {
  /** Subject identity. */
  readonly subject: string;
  /** Issued at timestamp (epoch in seconds). */
  readonly iat: number;
  /** Expiration timestamp (epoch in seconds). */
  readonly exp: number;
  /** Cryptographically strong random nonce. */
  readonly nonce?: string;
}

/**
 * Stateless session issuer interface.
 */
export interface SessionIssuer {
  /**
   * Issues a signed stateless session token for the given subject.
   * @param subject The subject to encode in the session.
   * @param ttlSeconds Optional time-to-live in seconds (defaults to issuer config).
   */
  issue(subject: string, ttlSeconds?: number): Promise<string>;

  /**
   * Verifies and decodes a signed stateless session token.
   * Returns null if signature is invalid or token has expired.
   */
  verify(token: string): Promise<SessionPayload | null>;
}

/**
 * Result returned by a rate limiter check.
 */
export interface RateLimiterCheckResult {
  readonly allowed: boolean;
  readonly retryAfterSeconds?: number;
}

/**
 * Rate limiter interface for authentication endpoints (e.g. login brute-force mitigation).
 */
export interface RateLimiter {
  /** Check if request is allowed for the given key (e.g. client IP). */
  check(key: string): Promise<RateLimiterCheckResult> | RateLimiterCheckResult;
  /** Record a failed attempt for the given key. */
  recordFailure(key: string): Promise<void> | void;
  /** Reset attempts for the given key upon successful authentication. */
  reset?(key: string): Promise<void> | void;
}

/**
 * Configuration options for `createStaticTokenIdentityProvider`.
 */
export interface StaticTokenProviderOptions {
  /** Cookie name to inspect for signed session tokens (defaults to 'substrate_session'). */
  readonly cookieName?: string;
  /** Session issuer used to verify signed cookie tokens. */
  readonly sessionIssuer?: SessionIssuer;
  /** Header name for bearer tokens (defaults to 'authorization'). */
  readonly headerName?: string;
}

/**
 * Options for client IP extraction and reverse proxy trust.
 */
export interface ExtractClientIpOptions {
  /**
   * Whether to trust proxy headers like `X-Forwarded-For`.
   * Set to `true` when running behind managed reverse proxies / CDNs (Vercel, Cloudflare, Nginx).
   * Defaults to `true` when Cloudflare or Vercel proxy headers are detected.
   */
  readonly trustProxy?: boolean;
  /** Custom proxy header to inspect with highest priority (e.g. 'cf-connecting-ip', 'x-real-ip'). */
  readonly proxyHeader?: string;
}

/**
 * Options for `createLoginHandler`.
 */
export interface LoginHandlerOptions extends ExtractClientIpOptions {
  /** Expected admin secret password. If unset/empty, all login attempts fail (fail-closed). */
  readonly secret?: string;
  /** Session issuer instance used to sign session cookies. */
  readonly sessionIssuer?: SessionIssuer;
  /** Cookie name for session (defaults to 'substrate_session'). */
  readonly cookieName?: string;
  /** Default session TTL in seconds (defaults to 7 days = 604800). */
  readonly maxAgeSeconds?: number;
  /** Pluggable rate limiter (defaults to built-in in-memory rate limiter). */
  readonly rateLimiter?: RateLimiter;
  /** Whether the cookie should have the Secure flag (defaults to true in production / https). */
  readonly secureCookie?: boolean;
  /** SameSite attribute for cookie (defaults to 'Lax'). */
  readonly sameSite?: 'Lax' | 'Strict' | 'None';
  /** Path for cookie (defaults to '/'). */
  readonly path?: string;
}

/**
 * Options for `createLogoutHandler`.
 */
export interface LogoutHandlerOptions {
  /** Cookie name to clear (defaults to 'substrate_session'). */
  readonly cookieName?: string;
  /** Path for cookie (defaults to '/'). */
  readonly path?: string;
}

/**
 * Options for `guardPage`.
 */
export interface GuardPageOptions {
  /** Identity provider to resolve credentials. */
  readonly provider: AdminIdentityProvider;
  /** URL or path to redirect when unauthenticated (e.g. '/login'). */
  readonly loginPath?: string;
}

/**
 * Options for `guardApi`.
 */
export interface GuardApiOptions {
  /** Identity provider to resolve credentials. */
  readonly provider: AdminIdentityProvider;
}

/**
 * Result returned by guard primitives.
 */
export type GuardResult =
  | { readonly authorized: true; readonly identity: AdminIdentity }
  | { readonly authorized: false; readonly response: Response; readonly redirectUrl?: string };
