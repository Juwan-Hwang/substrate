/**
 * @substrate-platform/auth — Platform Authentication & Identity Primitives.
 *
 * Provides domain-agnostic identity contracts, timing-safe static token providers,
 * dual-channel Bearer/Cookie extraction, stateless HMAC sessions, rate-limited login/logout handlers,
 * Passkey / WebAuthn ceremonies, and page/API guard primitives.
 */

// ── Cryptographic Primitives ─────────────────────────────────────────
export {
  base64UrlDecode,
  base64UrlEncode,
  hmacSha256,
  sha256Hex,
  timingSafeEqualStrings,
  verifyHmacSha256,
} from './crypto';

// ── Guard Primitives & Sanitization ──────────────────────────────────
export {
  assertAdmin,
  guardApi,
  guardPage,
  sanitizeReturnTo,
} from './guards';

// ── Route Handlers & Rate Limiter ────────────────────────────────────
export {
  createInMemoryRateLimiter,
  createLoginHandler,
  createLogoutHandler,
  extractClientIp,
  type InMemoryRateLimiterOptions,
} from './handlers';
// ── Passkey / WebAuthn Primitives ────────────────────────────────────
export {
  createInMemoryPasskeyCredentialStore,
  createPasskeyAuthenticationHandlers,
  createPasskeyRegistrationHandlers,
} from './passkey';
// ── Identity Providers ───────────────────────────────────────────────
export {
  createDevelopmentIdentityProvider,
  createStaticTokenIdentityProvider,
  parseCookies,
} from './providers';

// ── Session Issuer ───────────────────────────────────────────────────
export {
  createSessionIssuer,
  type SessionIssuerOptions,
} from './session';

// ── Contracts & Types ───────────────────────────────────────────────
export type {
  AdminIdentity,
  AdminIdentityProvider,
  ExtractClientIpOptions,
  GuardApiOptions,
  GuardPageOptions,
  GuardResult,
  LoginHandlerOptions,
  LogoutHandlerOptions,
  OperationContext,
  PasskeyAuthenticationHandlers,
  PasskeyAuthenticationOptions,
  PasskeyCredential,
  PasskeyCredentialStore,
  PasskeyRegistrationHandlers,
  PasskeyRegistrationOptions,
  RateLimiter,
  RateLimiterCheckResult,
  RelyingPartyConfig,
  SessionIssuer,
  SessionPayload,
  StaticTokenProviderOptions,
  WebAuthnUser,
} from './types';
