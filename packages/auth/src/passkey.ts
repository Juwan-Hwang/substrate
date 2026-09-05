/**
 * @substrate-platform/auth — Passkey / WebAuthn Handlers & Ceremonies.
 *
 * Implements:
 * - In-memory `PasskeyCredentialStore` for testing and development.
 * - Server-side signed challenge cookies with cryptographic timestamps (zero Redis / serverless compatible).
 * - `createPasskeyRegistrationHandlers` (fail-closed registration ceremony requiring admin authentication).
 * - `createPasskeyAuthenticationHandlers` (authentication ceremony emitting unified session cookies).
 */

import {
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  type RegistrationResponseJSON,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { hmacSha256, verifyHmacSha256 } from './crypto';
import { createInMemoryRateLimiter, extractClientIp } from './handlers';
import { parseCookies } from './providers';
import type {
  PasskeyAuthenticationHandlers,
  PasskeyAuthenticationOptions,
  PasskeyCredential,
  PasskeyCredentialStore,
  PasskeyRegistrationHandlers,
  PasskeyRegistrationOptions,
  WebAuthnUser,
} from './types';

/**
 * Creates an in-memory Passkey credential store.
 * Useful for development and automated testing.
 */
export function createInMemoryPasskeyCredentialStore(): PasskeyCredentialStore {
  const credentials = new Map<string, PasskeyCredential>();

  return {
    async create(cred: PasskeyCredential): Promise<void> {
      credentials.set(cred.credentialId, cred);
    },
    async findByCredentialId(credentialId: string): Promise<PasskeyCredential | null> {
      return credentials.get(credentialId) ?? null;
    },
    async listByUser(userHandle: string): Promise<readonly PasskeyCredential[]> {
      const results: PasskeyCredential[] = [];
      for (const cred of credentials.values()) {
        if (cred.userHandle === userHandle) {
          results.push(cred);
        }
      }
      return results;
    },
    async updateCounter(credentialId: string, counter: number): Promise<void> {
      const existing = credentials.get(credentialId);
      if (existing) {
        credentials.set(credentialId, { ...existing, counter });
      }
    },
    async delete(credentialId: string): Promise<void> {
      credentials.delete(credentialId);
    },
  };
}

/**
 * Builds a Set-Cookie header value for a short-lived, optionally HMAC-signed challenge cookie.
 */
async function buildChallengeCookie(
  name: string,
  challenge: string,
  ttlSeconds: number,
  options: { secure?: boolean; path?: string; secret?: string } = {},
): Promise<string> {
  let cookieValue = challenge;

  if (options.secret) {
    const iat = Math.floor(Date.now() / 1000);
    const payload = `${challenge}.${iat}`;
    const sig = await hmacSha256(options.secret, payload);
    cookieValue = `${payload}.${sig}`;
  }

  const parts = [
    `${name}=${encodeURIComponent(cookieValue)}`,
    `Path=${options.path ?? '/'}`,
    `Max-Age=${ttlSeconds}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (options.secure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

/**
 * Builds a Set-Cookie header value to clear a challenge cookie immediately.
 */
function buildClearChallengeCookie(
  name: string,
  options: { secure?: boolean; path?: string } = {},
): string {
  const parts = [
    `${name}=`,
    `Path=${options.path ?? '/'}`,
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (options.secure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

/**
 * Parses and verifies challenge cookie, validating HMAC signature and server-side TTL.
 */
async function verifyAndExtractChallenge(
  rawCookieValue: string | undefined,
  ttlSeconds: number,
  secret?: string,
): Promise<{ valid: true; challenge: string } | { valid: false; error: string }> {
  if (!rawCookieValue) {
    return { valid: false, error: 'Challenge missing or expired.' };
  }

  const decoded = decodeURIComponent(rawCookieValue);

  if (secret) {
    const parts = decoded.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid challenge signature envelope.' };
    }
    const [challenge, iatStr, sig] = parts;
    const iat = Number(iatStr);
    const now = Math.floor(Date.now() / 1000);

    if (!challenge || !sig || Number.isNaN(iat)) {
      return { valid: false, error: 'Malformed challenge format.' };
    }

    if (now - iat > ttlSeconds || iat > now + 60) {
      return { valid: false, error: 'Challenge has expired.' };
    }

    const isValidSig = await verifyHmacSha256(secret, `${challenge}.${iatStr}`, sig);
    if (!isValidSig) {
      return { valid: false, error: 'Challenge signature verification failed.' };
    }

    return { valid: true, challenge };
  }

  return { valid: true, challenge: decoded };
}

/**
 * Creates route handlers for the Passkey registration ceremony.
 *
 * Registration Ceremony:
 * 1. Client calls `options(request)` -> Server verifies admin identity, generates WebAuthn options,
 *    and sets an HMAC-signed stateless challenge cookie with server timestamp.
 * 2. Client calls navigator.credentials.create() and posts attestation to `verify(request)`.
 * 3. Server verifies admin identity, verifies challenge envelope, verifies attestation,
 *    ensures credential uniqueness, persists credential in store, and clears challenge cookie.
 */
export function createPasskeyRegistrationHandlers(
  options: PasskeyRegistrationOptions & {
    _generateRegistrationOptions?: typeof generateRegistrationOptions;
    _verifyRegistrationResponse?: typeof verifyRegistrationResponse;
  },
): PasskeyRegistrationHandlers {
  const adminProvider = options.adminProvider;
  if (!adminProvider) {
    throw new Error(
      'createPasskeyRegistrationHandlers: adminProvider is required. ' +
        'Registration endpoints must be guarded to prevent unauthorized credential registration.',
    );
  }

  const secret = options.challengeSecret ?? options.secret;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error(
      'createPasskeyRegistrationHandlers: challengeSecret or secret is required in production ' +
        'to prevent unsigned challenge replay and forgery.',
    );
  }

  const store = options.store;
  const rp = options.rp;
  const challengeCookieName = options.challengeCookieName ?? 'substrate_wa_reg_challenge';
  const challengeTtlSeconds = options.challengeTtlSeconds ?? 300;
  const secureCookie = options.secureCookie ?? process.env.NODE_ENV === 'production';
  const path = options.path ?? '/';
  const rateLimiter = options.rateLimiter ?? createInMemoryRateLimiter();
  const generateOpts = options._generateRegistrationOptions ?? generateRegistrationOptions;
  const verifyResp = options._verifyRegistrationResponse ?? verifyRegistrationResponse;

  return {
    async options(request: Request): Promise<Response> {
      if (request.method !== 'POST') {
        return Response.json(
          { success: false, error: 'Method not allowed. Use POST.' },
          { status: 405, headers: { Allow: 'POST' } },
        );
      }

      // ── Enforce admin authentication (Fail-Closed) ────────────────
      const identity = await adminProvider.resolve(request);
      if (!identity) {
        return Response.json(
          {
            success: false,
            error: 'Unauthorized: Valid admin credentials required to register passkeys.',
          },
          { status: 401 },
        );
      }

      const clientIp = extractClientIp(request, {
        trustProxy: options.trustProxy,
        proxyHeader: options.proxyHeader,
      });
      const rateCheck = await rateLimiter.check(clientIp);
      if (!rateCheck.allowed) {
        return Response.json(
          { success: false, error: 'Too many requests. Please try again later.' },
          { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfterSeconds ?? 60) } },
        );
      }

      const user: WebAuthnUser =
        typeof options.user === 'function' ? await options.user() : options.user;
      const existing = await store.listByUser(user.id);

      const registrationOptions = await generateOpts({
        rpName: rp.rpName,
        rpID: rp.rpID,
        userID: new TextEncoder().encode(user.id),
        userName: user.name,
        userDisplayName: user.displayName,
        authenticatorSelection: {
          authenticatorAttachment: options.authenticatorSelection?.attachment,
          residentKey: options.authenticatorSelection?.residentKey ?? 'preferred',
          userVerification: options.authenticatorSelection?.userVerification ?? 'preferred',
        },
        excludeCredentials: existing.map((c) => ({
          id: c.credentialId,
          type: 'public-key' as const,
          transports: c.transports as AuthenticatorTransportFuture[] | undefined,
        })),
      });

      const setChallengeHeader = await buildChallengeCookie(
        challengeCookieName,
        registrationOptions.challenge,
        challengeTtlSeconds,
        { secure: secureCookie, path, secret },
      );

      return Response.json(registrationOptions, {
        status: 200,
        headers: {
          'Set-Cookie': setChallengeHeader,
        },
      });
    },

    async verify(request: Request): Promise<Response> {
      if (request.method !== 'POST') {
        return Response.json(
          { success: false, error: 'Method not allowed. Use POST.' },
          { status: 405, headers: { Allow: 'POST' } },
        );
      }

      // ── Enforce admin authentication on verify (Fail-Closed) ───────
      const identity = await adminProvider.resolve(request);
      if (!identity) {
        return Response.json(
          { success: false, error: 'Unauthorized: Valid admin credentials required.' },
          { status: 401 },
        );
      }

      const clientIp = extractClientIp(request, {
        trustProxy: options.trustProxy,
        proxyHeader: options.proxyHeader,
      });
      const rateCheck = await rateLimiter.check(clientIp);
      if (!rateCheck.allowed) {
        return Response.json(
          { success: false, error: 'Too many requests. Please try again later.' },
          { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfterSeconds ?? 60) } },
        );
      }

      const clearChallengeHeader = buildClearChallengeCookie(challengeCookieName, {
        secure: secureCookie,
        path,
      });

      const cookies = parseCookies(request.headers.get('cookie'));
      const rawChallengeCookie = cookies[challengeCookieName];
      const challengeVerification = await verifyAndExtractChallenge(
        rawChallengeCookie,
        challengeTtlSeconds,
        secret,
      );

      if (!challengeVerification.valid) {
        await rateLimiter.recordFailure(clientIp);
        return Response.json(
          { success: false, error: challengeVerification.error },
          { status: 400, headers: { 'Set-Cookie': clearChallengeHeader } },
        );
      }

      const expectedChallenge = challengeVerification.challenge;

      let payload:
        | { credential?: RegistrationResponseJSON; nickname?: string }
        | RegistrationResponseJSON;
      try {
        payload = (await request.json()) as typeof payload;
      } catch {
        await rateLimiter.recordFailure(clientIp);
        return Response.json(
          { success: false, error: 'Invalid JSON body.' },
          { status: 400, headers: { 'Set-Cookie': clearChallengeHeader } },
        );
      }

      const credentialResponse: RegistrationResponseJSON =
        'credential' in payload && payload.credential
          ? payload.credential
          : (payload as RegistrationResponseJSON);

      // Nickname sanitization: trim and cap at 64 characters
      const rawNickname =
        'nickname' in payload && typeof payload.nickname === 'string'
          ? payload.nickname.trim()
          : undefined;
      const nickname = rawNickname ? rawNickname.slice(0, 64) : undefined;

      if (!credentialResponse?.id || !credentialResponse.response) {
        await rateLimiter.recordFailure(clientIp);
        return Response.json(
          { success: false, error: 'Invalid registration credential payload.' },
          { status: 400, headers: { 'Set-Cookie': clearChallengeHeader } },
        );
      }

      const user: WebAuthnUser =
        typeof options.user === 'function' ? await options.user() : options.user;

      try {
        const userVerificationSetting =
          options.authenticatorSelection?.userVerification ?? 'preferred';
        const verification = await verifyResp({
          response: credentialResponse,
          expectedChallenge,
          expectedOrigin: rp.expectedOrigins as string[],
          expectedRPID: rp.rpID,
          // W3C alignment: only enforce UV flag check when userVerification is explicitly 'required'
          requireUserVerification: userVerificationSetting === 'required',
        });

        if (!verification.verified || !verification.registrationInfo) {
          await rateLimiter.recordFailure(clientIp);
          return Response.json(
            { success: false, error: 'Registration verification failed.' },
            { status: 400, headers: { 'Set-Cookie': clearChallengeHeader } },
          );
        }

        const { registrationInfo } = verification;

        // Uniqueness check: avoid overwriting existing credential
        const existingCred = await store.findByCredentialId(registrationInfo.credential.id);
        if (existingCred) {
          await rateLimiter.recordFailure(clientIp);
          return Response.json(
            { success: false, error: 'Credential already registered.' },
            { status: 409, headers: { 'Set-Cookie': clearChallengeHeader } },
          );
        }

        const newCredential: PasskeyCredential = {
          credentialId: registrationInfo.credential.id,
          publicKey: registrationInfo.credential.publicKey,
          counter: registrationInfo.credential.counter,
          userHandle: user.id,
          transports:
            credentialResponse.response.transports ??
            (registrationInfo.credential.transports as readonly string[] | undefined),
          nickname,
          aaguid: registrationInfo.aaguid,
          createdAt: Math.floor(Date.now() / 1000),
        };

        await store.create(newCredential);
        await rateLimiter.reset?.(clientIp);

        return Response.json(
          {
            success: true,
            credentialId: newCredential.credentialId,
          },
          {
            status: 200,
            headers: {
              'Set-Cookie': clearChallengeHeader,
            },
          },
        );
      } catch {
        await rateLimiter.recordFailure(clientIp);
        // Generic safe message to avoid leaking COSE / attestation internal details
        return Response.json(
          { success: false, error: 'Registration verification failed.' },
          { status: 400, headers: { 'Set-Cookie': clearChallengeHeader } },
        );
      }
    },
  };
}

/**
 * Creates route handlers for the Passkey authentication ceremony.
 *
 * Authentication Ceremony:
 * 1. Client calls `options(request)` -> Server generates authentication options with HMAC-signed challenge cookie.
 * 2. Client calls navigator.credentials.get() and posts assertion to `verify(request)`.
 * 3. Server verifies assertion, verifies & advances signature counter, calls existing `sessionIssuer.issue()`,
 *    and sets standard admin session cookie tagged with `amr: 'fido2'`.
 */
export function createPasskeyAuthenticationHandlers(
  options: PasskeyAuthenticationOptions & {
    _generateAuthenticationOptions?: typeof generateAuthenticationOptions;
    _verifyAuthenticationResponse?: typeof verifyAuthenticationResponse;
  },
): PasskeyAuthenticationHandlers {
  const secret = options.challengeSecret ?? options.secret;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error(
      'createPasskeyAuthenticationHandlers: challengeSecret or secret is required in production ' +
        'to prevent unsigned challenge replay and forgery.',
    );
  }

  const store = options.store;
  const rp = options.rp;
  const sessionIssuer = options.sessionIssuer;
  const cookieName = options.cookieName ?? 'substrate_session';
  const maxAge = options.maxAgeSeconds ?? 60 * 60 * 24 * 7; // 7 days
  const challengeCookieName = options.challengeCookieName ?? 'substrate_wa_auth_challenge';
  const challengeTtlSeconds = options.challengeTtlSeconds ?? 300;
  const defaultUserHandle = options.userHandle ?? 'admin';
  const amr = options.amr ?? 'fido2';
  const secureCookie = options.secureCookie ?? process.env.NODE_ENV === 'production';
  const sameSite = options.sameSite ?? 'Lax';
  const path = options.path ?? '/';
  const rateLimiter = options.rateLimiter ?? createInMemoryRateLimiter();
  const generateOpts = options._generateAuthenticationOptions ?? generateAuthenticationOptions;
  const verifyResp = options._verifyAuthenticationResponse ?? verifyAuthenticationResponse;

  return {
    async options(request: Request): Promise<Response> {
      if (request.method !== 'POST') {
        return Response.json(
          { success: false, error: 'Method not allowed. Use POST.' },
          { status: 405, headers: { Allow: 'POST' } },
        );
      }

      const clientIp = extractClientIp(request, {
        trustProxy: options.trustProxy,
        proxyHeader: options.proxyHeader,
      });
      const rateCheck = await rateLimiter.check(clientIp);
      if (!rateCheck.allowed) {
        return Response.json(
          { success: false, error: 'Too many requests. Please try again later.' },
          { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfterSeconds ?? 60) } },
        );
      }

      // Check registered credentials for the user
      const existing = await store.listByUser(defaultUserHandle);
      const allowCredentials = existing.map((c) => ({
        id: c.credentialId,
        type: 'public-key' as const,
        transports: c.transports as AuthenticatorTransportFuture[] | undefined,
      }));

      const authenticationOptions = await generateOpts({
        rpID: rp.rpID,
        userVerification: options.userVerification ?? 'preferred',
        allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
      });

      const setChallengeHeader = await buildChallengeCookie(
        challengeCookieName,
        authenticationOptions.challenge,
        challengeTtlSeconds,
        { secure: secureCookie, path, secret },
      );

      return Response.json(authenticationOptions, {
        status: 200,
        headers: {
          'Set-Cookie': setChallengeHeader,
        },
      });
    },

    async verify(request: Request): Promise<Response> {
      if (request.method !== 'POST') {
        return Response.json(
          { success: false, error: 'Method not allowed. Use POST.' },
          { status: 405, headers: { Allow: 'POST' } },
        );
      }

      const clientIp = extractClientIp(request, {
        trustProxy: options.trustProxy,
        proxyHeader: options.proxyHeader,
      });
      const rateCheck = await rateLimiter.check(clientIp);
      if (!rateCheck.allowed) {
        return Response.json(
          { success: false, error: 'Too many requests. Please try again later.' },
          { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfterSeconds ?? 60) } },
        );
      }

      const clearChallengeHeader = buildClearChallengeCookie(challengeCookieName, {
        secure: secureCookie,
        path,
      });

      const cookies = parseCookies(request.headers.get('cookie'));
      const rawChallengeCookie = cookies[challengeCookieName];
      const challengeVerification = await verifyAndExtractChallenge(
        rawChallengeCookie,
        challengeTtlSeconds,
        secret,
      );

      if (!challengeVerification.valid) {
        await rateLimiter.recordFailure(clientIp);
        return Response.json(
          { success: false, error: challengeVerification.error },
          { status: 400, headers: { 'Set-Cookie': clearChallengeHeader } },
        );
      }

      const expectedChallenge = challengeVerification.challenge;

      let payload: { assertion?: AuthenticationResponseJSON } | AuthenticationResponseJSON;
      try {
        payload = (await request.json()) as typeof payload;
      } catch {
        await rateLimiter.recordFailure(clientIp);
        return Response.json(
          { success: false, error: 'Invalid JSON body.' },
          { status: 400, headers: { 'Set-Cookie': clearChallengeHeader } },
        );
      }

      const assertion: AuthenticationResponseJSON =
        'assertion' in payload && payload.assertion
          ? payload.assertion
          : (payload as AuthenticationResponseJSON);

      if (!assertion?.id || !assertion.response) {
        await rateLimiter.recordFailure(clientIp);
        return Response.json(
          { success: false, error: 'Invalid authentication assertion payload.' },
          { status: 400, headers: { 'Set-Cookie': clearChallengeHeader } },
        );
      }

      const credId = assertion.id || assertion.rawId;
      const credential = await store.findByCredentialId(credId);
      if (!credential) {
        await rateLimiter.recordFailure(clientIp);
        return Response.json(
          { success: false, error: 'Credential not recognized.' },
          { status: 401, headers: { 'Set-Cookie': clearChallengeHeader } },
        );
      }

      try {
        const userVerificationSetting = options.userVerification ?? 'preferred';
        const verification = await verifyResp({
          response: assertion,
          expectedChallenge,
          expectedOrigin: rp.expectedOrigins as string[],
          expectedRPID: rp.rpID,
          credential: {
            id: credential.credentialId,
            publicKey: credential.publicKey.slice(),
            counter: credential.counter,
            transports: credential.transports as AuthenticatorTransportFuture[] | undefined,
          },
          // W3C alignment: only enforce UV flag check when userVerification is explicitly 'required'
          requireUserVerification: userVerificationSetting === 'required',
        });

        if (!verification.verified || !verification.authenticationInfo) {
          await rateLimiter.recordFailure(clientIp);
          return Response.json(
            { success: false, error: 'Authentication verification failed.' },
            { status: 401, headers: { 'Set-Cookie': clearChallengeHeader } },
          );
        }

        const newCounter = verification.authenticationInfo.newCounter;

        // Counter monotonic check (clone detection)
        if (newCounter > credential.counter) {
          await store.updateCounter(credential.credentialId, newCounter);
        } else if (credential.counter > 0 && newCounter <= credential.counter) {
          // Counter did not advance on an authenticator with counter support -> Clone suspected
          await rateLimiter.recordFailure(clientIp);
          return Response.json(
            { success: false, error: 'Authenticator counter mismatch. Possible clone detected.' },
            { status: 403, headers: { 'Set-Cookie': clearChallengeHeader } },
          );
        }

        await rateLimiter.reset?.(clientIp);

        // ── Mint standard session via existing SessionIssuer ──────────
        const subject = credential.userHandle || defaultUserHandle;
        const sessionToken = await sessionIssuer.issue(subject, maxAge, { amr });

        const sessionCookieParts = [
          `${cookieName}=${encodeURIComponent(sessionToken)}`,
          `Path=${path}`,
          `Max-Age=${maxAge}`,
          'HttpOnly',
          `SameSite=${sameSite}`,
        ];
        if (secureCookie) {
          sessionCookieParts.push('Secure');
        }

        const headers = new Headers();
        headers.append('Set-Cookie', sessionCookieParts.join('; '));
        headers.append('Set-Cookie', clearChallengeHeader);

        return Response.json(
          {
            success: true,
            subject,
            amr,
          },
          {
            status: 200,
            headers,
          },
        );
      } catch {
        await rateLimiter.recordFailure(clientIp);
        // Generic safe message to avoid leaking internal error details
        return Response.json(
          { success: false, error: 'Authentication verification failed.' },
          { status: 401, headers: { 'Set-Cookie': clearChallengeHeader } },
        );
      }
    },
  };
}
