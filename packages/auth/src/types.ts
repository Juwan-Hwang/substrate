/**
 * @substrate-platform/auth — Type definitions and contracts.
 *
 * Provides domain-agnostic identity contracts, session contracts,
 * WebAuthn/Passkey types, rate limiter contracts, and guard parameter interfaces.
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
  readonly nonce: string;
  /** Authentication Methods References (e.g. 'pwd', 'fido2', 'hwk'). */
  readonly amr?: string;
}

/**
 * Stateless session issuer interface.
 */
export interface SessionIssuer {
  /**
   * Issues a signed stateless session token for the given subject.
   * @param subject The subject to encode in the session.
   * @param ttlSeconds Optional time-to-live in seconds (defaults to issuer config).
   * @param meta Optional metadata, e.g. AMR (Authentication Method Reference).
   */
  issue(subject: string, ttlSeconds?: number, meta?: { amr?: string }): Promise<string>;

  /**
   * Verifies and decodes a signed stateless session token.
   * Returns null if signature is invalid or token has expired.
   */
  verify(token: string): Promise<SessionPayload | null>;
}

/**
 * WebAuthn Relying Party configuration.
 */
export interface RelyingPartyConfig {
  /** RP ID (e.g. "juwanh.com" for production or "localhost" for dev). */
  readonly rpID: string;
  /** Human-readable RP name (e.g. "Aevum"). */
  readonly rpName: string;
  /** Valid origins permitted to interact with this RP (e.g. ["https://juwanh.com", "http://localhost:3000"]). */
  readonly expectedOrigins: readonly string[];
}

/**
 * Stored Passkey credential model.
 * Multiple credentials can belong to one administrator (e.g. YubiKey + Windows Hello + iPhone).
 */
export interface PasskeyCredential {
  /** Base64URL-encoded credential ID. */
  readonly credentialId: string;
  /** COSE public key bytes. */
  readonly publicKey: Uint8Array;
  /** Monotonically increasing signature counter (prevents cloning attacks). */
  readonly counter: number;
  /** Associated stable user identifier (e.g. "admin"). */
  readonly userHandle: string;
  /** Transport types supported (e.g. ["usb", "nfc", "internal", "ble"]). */
  readonly transports?: readonly string[];
  /** Optional user-facing label (e.g. "YubiKey 5C", "MacBook Touch ID"). */
  readonly nickname?: string;
  /** Authenticator Attestation GUID identifying device model (optional). */
  readonly aaguid?: string;
  /** Creation timestamp in epoch seconds. */
  readonly createdAt: number;
}

/**
 * Storage interface seam for Passkey credentials.
 * Implemented by consumers (Postgres, Drizzle, Upstash KV, etc.) to keep auth package zero-DB.
 */
export interface PasskeyCredentialStore {
  create(cred: PasskeyCredential): Promise<void>;
  findByCredentialId(credentialId: string): Promise<PasskeyCredential | null>;
  listByUser(userHandle: string): Promise<readonly PasskeyCredential[]>;
  updateCounter(credentialId: string, counter: number): Promise<void>;
  delete(credentialId: string): Promise<void>;
}

/**
 * WebAuthn user entity representation.
 */
export interface WebAuthnUser {
  /** User handle: stable, non-PII identifier. */
  readonly id: string;
  /** Account name for display (e.g. "admin"). */
  readonly name: string;
  /** User display name (e.g. "Administrator"). */
  readonly displayName: string;
}

/**
 * Options for `createPasskeyRegistrationHandlers`.
 */
export interface PasskeyRegistrationOptions extends ExtractClientIpOptions {
  /** Passkey credential persistence store. */
  readonly store: PasskeyCredentialStore;
  /** Relying Party configuration. */
  readonly rp: RelyingPartyConfig;
  /** Target user or user getter. */
  readonly user: WebAuthnUser | (() => WebAuthnUser | Promise<WebAuthnUser>);
  /**
   * Required identity provider to guard registration endpoints.
   * Registration must always be an authenticated operation to prevent
   * unauthorized actors from registering passkeys to administrative accounts.
   */
  readonly adminProvider: AdminIdentityProvider;
  /** Secret used to HMAC-sign challenge cookies with server-side timestamp validation. */
  readonly challengeSecret?: string;
  /** Alias for challengeSecret or shared auth secret. */
  readonly secret?: string;
  /** Authenticator selection criteria. */
  readonly authenticatorSelection?: {
    readonly attachment?: 'platform' | 'cross-platform';
    readonly residentKey?: 'preferred' | 'required' | 'discouraged';
    readonly userVerification?: 'required' | 'preferred' | 'discouraged';
  };
  /** Challenge cookie name (defaults to 'substrate_wa_reg_challenge'). */
  readonly challengeCookieName?: string;
  /** Challenge time-to-live in seconds (defaults to 300). */
  readonly challengeTtlSeconds?: number;
  /** Rate limiter for registration attempts. */
  readonly rateLimiter?: RateLimiter;
  /** Whether challenge cookie has Secure flag (defaults to true in production / https). */
  readonly secureCookie?: boolean;
  /** Scope path for challenge cookie (defaults to '/'). */
  readonly path?: string;
}

/**
 * Route handlers for Passkey registration ceremony.
 */
export interface PasskeyRegistrationHandlers {
  options(request: Request): Promise<Response>;
  verify(request: Request): Promise<Response>;
}

/**
 * Options for `createPasskeyAuthenticationHandlers`.
 */
export interface PasskeyAuthenticationOptions extends ExtractClientIpOptions {
  /** Passkey credential persistence store. */
  readonly store: PasskeyCredentialStore;
  /** Relying Party configuration. */
  readonly rp: RelyingPartyConfig;
  /** Session issuer used to mint standard admin session cookie upon success. */
  readonly sessionIssuer: SessionIssuer;
  /** Cookie name for session (defaults to 'substrate_session'). */
  readonly cookieName?: string;
  /** Session lifetime in seconds (defaults to 7 days). */
  readonly maxAgeSeconds?: number;
  /** Challenge cookie name (defaults to 'substrate_wa_auth_challenge'). */
  readonly challengeCookieName?: string;
  /** Challenge time-to-live in seconds (defaults to 300). */
  readonly challengeTtlSeconds?: number;
  /** Secret used to HMAC-sign challenge cookies with server-side timestamp validation. */
  readonly challengeSecret?: string;
  /** Alias for challengeSecret or shared auth secret. */
  readonly secret?: string;
  /** User verification requirement (defaults to 'preferred'). */
  readonly userVerification?: 'required' | 'preferred' | 'discouraged';
  /** Expected administrator userHandle (defaults to 'admin'). */
  readonly userHandle?: string;
  /** AMR stamped into the minted session (defaults to 'fido2'). */
  readonly amr?: string;
  /** Rate limiter for authentication attempts. */
  readonly rateLimiter?: RateLimiter;
  /** Whether cookies should have the Secure flag (defaults to true in production). */
  readonly secureCookie?: boolean;
  /** SameSite attribute for session cookie (defaults to 'Lax'). */
  readonly sameSite?: 'Lax' | 'Strict' | 'None';
  /** Path for session cookie (defaults to '/'). */
  readonly path?: string;
}

/**
 * Route handlers for Passkey authentication ceremony.
 */
export interface PasskeyAuthenticationHandlers {
  options(request: Request): Promise<Response>;
  verify(request: Request): Promise<Response>;
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
