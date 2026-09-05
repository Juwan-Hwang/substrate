import { describe, expect, it } from 'vitest';
import {
  createInMemoryPasskeyCredentialStore,
  createInMemoryRateLimiter,
  createPasskeyAuthenticationHandlers,
  createPasskeyRegistrationHandlers,
  createSessionIssuer,
  createStaticTokenIdentityProvider,
  guardApi,
  guardPage,
  type PasskeyCredential,
  type RelyingPartyConfig,
  type WebAuthnUser,
} from '../index';

describe('Passkey / WebAuthn Implementation', () => {
  const rp: RelyingPartyConfig = {
    rpID: 'localhost',
    rpName: 'Test Platform',
    expectedOrigins: ['http://localhost:3000'],
  };

  const testUser: WebAuthnUser = {
    id: 'admin',
    name: 'admin@platform.local',
    displayName: 'Super Admin',
  };

  const secret = 'session-signing-secret-passkey-123456';
  const sessionIssuer = createSessionIssuer(secret);

  const authHeader = { Authorization: 'Bearer test-admin-token' };
  const mockAdminProvider = {
    resolve: (req: Request) => {
      const auth = req.headers.get('authorization');
      if (auth === 'Bearer test-admin-token') {
        return { subject: 'admin', mechanism: 'test-auth' };
      }
      return null;
    },
  };

  describe('1. In-Memory Passkey Credential Store', () => {
    it('creates, retrieves, updates counter, and deletes credentials', async () => {
      const store = createInMemoryPasskeyCredentialStore();
      const cred: PasskeyCredential = {
        credentialId: 'cred_abc123',
        publicKey: new Uint8Array([1, 2, 3, 4]),
        counter: 0,
        userHandle: 'admin',
        nickname: 'YubiKey 5C',
        createdAt: 1700000000,
      };

      await store.create(cred);

      const found = await store.findByCredentialId('cred_abc123');
      expect(found).toEqual(cred);

      const userCreds = await store.listByUser('admin');
      expect(userCreds).toHaveLength(1);
      expect(userCreds[0]?.nickname).toBe('YubiKey 5C');

      await store.updateCounter('cred_abc123', 5);
      const updated = await store.findByCredentialId('cred_abc123');
      expect(updated?.counter).toBe(5);

      await store.delete('cred_abc123');
      expect(await store.findByCredentialId('cred_abc123')).toBeNull();
    });
  });

  describe('2. Registration Ceremony Handlers (Fail-Closed Security)', () => {
    it('throws error on creation if adminProvider is missing (fail-closed compile & runtime)', () => {
      const store = createInMemoryPasskeyCredentialStore();
      expect(() => {
        // @ts-expect-error testing missing adminProvider runtime throw
        createPasskeyRegistrationHandlers({ store, rp, user: testUser });
      }).toThrow('adminProvider is required');
    });

    it('rejects non-POST requests with 405 Method Not Allowed', async () => {
      const store = createInMemoryPasskeyCredentialStore();
      const handlers = createPasskeyRegistrationHandlers({
        store,
        rp,
        user: testUser,
        adminProvider: mockAdminProvider,
      });

      const getOpts = await handlers.options(
        new Request('http://localhost/register/options', { method: 'GET' }),
      );
      expect(getOpts.status).toBe(405);

      const getVerify = await handlers.verify(
        new Request('http://localhost/register/verify', { method: 'GET' }),
      );
      expect(getVerify.status).toBe(405);
    });

    it('rejects options request with 401 when unauthenticated', async () => {
      const store = createInMemoryPasskeyCredentialStore();
      const handlers = createPasskeyRegistrationHandlers({
        store,
        rp,
        user: testUser,
        adminProvider: mockAdminProvider,
      });

      const unauthReq = new Request('http://localhost/register/options', { method: 'POST' });
      const res = await handlers.options(unauthReq);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain('Valid admin credentials required');
    });

    it('rejects verify request with 401 when unauthenticated', async () => {
      const store = createInMemoryPasskeyCredentialStore();
      const handlers = createPasskeyRegistrationHandlers({
        store,
        rp,
        user: testUser,
        adminProvider: mockAdminProvider,
      });

      const unauthReq = new Request('http://localhost/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: { id: 'abc' } }),
      });
      const res = await handlers.verify(unauthReq);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain('Valid admin credentials required');
    });

    it('generates registration options and injects challenge cookie with valid admin auth', async () => {
      const store = createInMemoryPasskeyCredentialStore();
      const handlers = createPasskeyRegistrationHandlers({
        store,
        rp,
        user: testUser,
        adminProvider: mockAdminProvider,
        challengeCookieName: 'test_reg_challenge',
        _generateRegistrationOptions: async (opts) => ({
          challenge: 'test-challenge-base64url',
          rp: { name: opts.rpName, id: opts.rpID },
          user: {
            id: 'admin',
            name: opts.userName,
            displayName: opts.userDisplayName ?? opts.userName,
          },
          pubKeyCredParams: [],
        }),
      });

      const req = new Request('http://localhost/register/options', {
        method: 'POST',
        headers: authHeader,
      });
      const res = await handlers.options(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.challenge).toBe('test-challenge-base64url');

      const setCookie = res.headers.get('Set-Cookie');
      expect(setCookie).toContain('test_reg_challenge=test-challenge-base64url');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Lax');
    });

    it('generates real WebAuthn registration options using @simplewebauthn/server without mocks', async () => {
      const store = createInMemoryPasskeyCredentialStore();
      const handlers = createPasskeyRegistrationHandlers({
        store,
        rp,
        user: testUser,
        adminProvider: mockAdminProvider,
      });

      const req = new Request('http://localhost/register/options', {
        method: 'POST',
        headers: authHeader,
      });
      const res = await handlers.options(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(typeof json.challenge).toBe('string');
      expect(json.challenge.length).toBeGreaterThan(10);
      expect(json.rp.id).toBe('localhost');
      expect(json.user.name).toBe('admin@platform.local');
      expect(json.pubKeyCredParams.length).toBeGreaterThan(0);

      const setCookie = res.headers.get('Set-Cookie');
      expect(setCookie).toContain('substrate_wa_reg_challenge=');
    });

    it('verifies registration attestation, saves credential, and clears challenge cookie', async () => {
      const store = createInMemoryPasskeyCredentialStore();
      const handlers = createPasskeyRegistrationHandlers({
        store,
        rp,
        user: testUser,
        adminProvider: mockAdminProvider,
        challengeCookieName: 'test_reg_challenge',
        _verifyRegistrationResponse: async () => ({
          verified: true,
          registrationInfo: {
            fmt: 'none',
            aaguid: '00000000-0000-0000-0000-000000000000',
            credential: {
              id: 'new_cred_999',
              publicKey: new Uint8Array([10, 20, 30]),
              counter: 0,
            },
            credentialType: 'public-key',
            attestationObject: new Uint8Array(),
            userVerified: true,
            credentialDeviceType: 'singleDevice',
            credentialBackedUp: false,
            origin: 'http://localhost:3000',
          },
        }),
      });

      const verifyReq = new Request('http://localhost/register/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'test_reg_challenge=test-challenge-base64url',
          ...authHeader,
        },
        body: JSON.stringify({
          credential: {
            id: 'new_cred_999',
            rawId: 'new_cred_999',
            type: 'public-key',
            response: { clientDataJSON: '', attestationObject: '' },
            clientExtensionResults: {},
          },
          nickname: 'Personal YubiKey',
        }),
      });

      const res = await handlers.verify(verifyReq);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.credentialId).toBe('new_cred_999');

      // Verify saved in store
      const saved = await store.findByCredentialId('new_cred_999');
      expect(saved).not.toBeNull();
      expect(saved?.nickname).toBe('Personal YubiKey');
      expect(saved?.userHandle).toBe('admin');

      // Verify challenge cookie cleared
      const setCookie = res.headers.get('Set-Cookie');
      expect(setCookie).toContain('test_reg_challenge=;');
      expect(setCookie).toContain('Max-Age=0');
    });

    it('rejects registration verification if challenge cookie is missing', async () => {
      const store = createInMemoryPasskeyCredentialStore();
      const handlers = createPasskeyRegistrationHandlers({
        store,
        rp,
        user: testUser,
        adminProvider: mockAdminProvider,
      });

      const req = new Request('http://localhost/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ credential: { id: 'test' } }),
      });

      const res = await handlers.verify(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('missing or expired');
    });

    it('rejects registration of already registered credential with 409 Conflict', async () => {
      const store = createInMemoryPasskeyCredentialStore();
      await store.create({
        credentialId: 'existing_cred_123',
        publicKey: new Uint8Array([1, 2, 3]),
        counter: 0,
        userHandle: 'admin',
        createdAt: 1700000000,
      });

      const handlers = createPasskeyRegistrationHandlers({
        store,
        rp,
        user: testUser,
        adminProvider: mockAdminProvider,
        challengeCookieName: 'test_reg_challenge',
        _verifyRegistrationResponse: async () => ({
          verified: true,
          registrationInfo: {
            fmt: 'none',
            aaguid: '00000000-0000-0000-0000-000000000000',
            credential: {
              id: 'existing_cred_123', // duplicate!
              publicKey: new Uint8Array([1, 2, 3]),
              counter: 0,
            },
            credentialType: 'public-key',
            attestationObject: new Uint8Array(),
            userVerified: true,
            credentialDeviceType: 'singleDevice',
            credentialBackedUp: false,
            origin: 'http://localhost:3000',
          },
        }),
      });

      const verifyReq = new Request('http://localhost/register/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'test_reg_challenge=valid-challenge',
          ...authHeader,
        },
        body: JSON.stringify({
          credential: {
            id: 'existing_cred_123',
            rawId: 'existing_cred_123',
            type: 'public-key',
            response: { clientDataJSON: '', attestationObject: '' },
            clientExtensionResults: {},
          },
        }),
      });

      const res = await handlers.verify(verifyReq);
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toContain('already registered');
    });

    it('sanitizes and caps nickname at 64 characters', async () => {
      const store = createInMemoryPasskeyCredentialStore();
      const handlers = createPasskeyRegistrationHandlers({
        store,
        rp,
        user: testUser,
        adminProvider: mockAdminProvider,
        challengeCookieName: 'test_reg_challenge',
        _verifyRegistrationResponse: async () => ({
          verified: true,
          registrationInfo: {
            fmt: 'none',
            aaguid: '00000000-0000-0000-0000-000000000000',
            credential: {
              id: 'cred_long_nick',
              publicKey: new Uint8Array([1]),
              counter: 0,
            },
            credentialType: 'public-key',
            attestationObject: new Uint8Array(),
            userVerified: true,
            credentialDeviceType: 'singleDevice',
            credentialBackedUp: false,
            origin: 'http://localhost:3000',
          },
        }),
      });

      const longNickname = `  ${'a'.repeat(100)}  `;
      const verifyReq = new Request('http://localhost/register/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'test_reg_challenge=valid-challenge',
          ...authHeader,
        },
        body: JSON.stringify({
          credential: { id: 'cred_long_nick', response: {} },
          nickname: longNickname,
        }),
      });

      const res = await handlers.verify(verifyReq);
      expect(res.status).toBe(200);

      const saved = await store.findByCredentialId('cred_long_nick');
      expect(saved?.nickname).toHaveLength(64);
      expect(saved?.nickname).toBe('a'.repeat(64));
    });

    it('throws in production when challenge secret is not configured', () => {
      const prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const store = createInMemoryPasskeyCredentialStore();
        expect(() => {
          createPasskeyRegistrationHandlers({
            store,
            rp,
            user: testUser,
            adminProvider: mockAdminProvider,
          });
        }).toThrow('challengeSecret or secret is required in production');

        expect(() => {
          createPasskeyAuthenticationHandlers({
            store,
            rp,
            sessionIssuer,
          });
        }).toThrow('challengeSecret or secret is required in production');
      } finally {
        process.env.NODE_ENV = prevEnv;
      }
    });

    it('rate limits registration endpoints when limit exceeded and supports custom proxyHeader', async () => {
      const store = createInMemoryPasskeyCredentialStore();
      const rateLimiter = createInMemoryRateLimiter({ maxAttempts: 2, windowSeconds: 60 });
      const handlers = createPasskeyRegistrationHandlers({
        store,
        rp,
        user: testUser,
        adminProvider: mockAdminProvider,
        rateLimiter,
        proxyHeader: 'x-custom-ip',
      });

      // Exhaust limit for custom IP
      await rateLimiter.recordFailure('10.0.0.99');
      await rateLimiter.recordFailure('10.0.0.99');

      const req = new Request('http://localhost/register/options', {
        method: 'POST',
        headers: { ...authHeader, 'x-custom-ip': '10.0.0.99' },
      });
      const res = await handlers.options(req);
      expect(res.status).toBe(429);
    });
  });

  describe('3. HMAC Signed Challenge & Server-side Expiration', () => {
    it('generates signed challenge cookie and verifies server-side expiration', async () => {
      const store = createInMemoryPasskeyCredentialStore();
      const handlers = createPasskeyAuthenticationHandlers({
        store,
        rp,
        sessionIssuer,
        secret: 'challenge-signing-secret-1234',
        challengeCookieName: 'signed_challenge',
        challengeTtlSeconds: 10,
      });

      const optRes = await handlers.options(
        new Request('http://localhost/login/options', { method: 'POST' }),
      );
      expect(optRes.status).toBe(200);

      const cookieHeader = optRes.headers.get('Set-Cookie') ?? '';
      expect(cookieHeader).toContain('signed_challenge=');

      // Extract raw cookie
      const match = cookieHeader.match(/signed_challenge=([^;]+)/);
      const rawCookieVal = match?.[1] ?? '';

      // 1. Valid verification with correct signature and unexpired timestamp
      let verifiedChallengePassed = false;
      const validHandlers = createPasskeyAuthenticationHandlers({
        store,
        rp,
        sessionIssuer,
        secret: 'challenge-signing-secret-1234',
        challengeCookieName: 'signed_challenge',
        _verifyAuthenticationResponse: async (opts) => {
          verifiedChallengePassed =
            typeof opts.expectedChallenge === 'string' && opts.expectedChallenge.length > 0;
          return {
            verified: true,
            authenticationInfo: {
              credentialID: 'c1',
              newCounter: 1,
              userVerified: true,
              credentialDeviceType: 'singleDevice',
              credentialBackedUp: false,
              origin: 'http://localhost:3000',
              rpID: 'localhost',
            },
          };
        },
      });

      await store.create({
        credentialId: 'c1',
        publicKey: new Uint8Array([1, 2, 3]),
        counter: 0,
        userHandle: 'admin',
        createdAt: 1700000000,
      });

      const verifyReq = new Request('http://localhost/login/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `signed_challenge=${rawCookieVal}`,
        },
        body: JSON.stringify({
          assertion: {
            id: 'c1',
            rawId: 'c1',
            type: 'public-key',
            response: { clientDataJSON: '', authenticatorData: '', signature: '' },
            clientExtensionResults: {},
          },
        }),
      });

      const res = await validHandlers.verify(verifyReq);
      expect(res.status).toBe(200);
      expect(verifiedChallengePassed).toBe(true);

      // 2. Tampered signature is rejected
      const tamperedCookie = `${rawCookieVal.slice(0, -5)}bad99`;
      const tamperedReq = new Request('http://localhost/login/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `signed_challenge=${tamperedCookie}`,
        },
        body: JSON.stringify({ assertion: { id: 'c1', response: {} } }),
      });
      const tamperedRes = await validHandlers.verify(tamperedReq);
      expect(tamperedRes.status).toBe(400);
      const tamperedJson = await tamperedRes.json();
      expect(tamperedJson.error).toContain('signature verification failed');

      // 3. Expired timestamp is rejected
      const expiredIat = Math.floor(Date.now() / 1000) - 1000;
      const expiredPayload = `fakechal.${expiredIat}`;
      const expiredHandlers = createPasskeyAuthenticationHandlers({
        store,
        rp,
        sessionIssuer,
        secret: 'challenge-signing-secret-1234',
        challengeCookieName: 'signed_challenge',
        challengeTtlSeconds: 10,
      });
      const expiredReq = new Request('http://localhost/login/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `signed_challenge=${expiredPayload}.fakesig`,
        },
        body: JSON.stringify({ assertion: { id: 'c1', response: {} } }),
      });
      const expiredRes = await expiredHandlers.verify(expiredReq);
      expect(expiredRes.status).toBe(400);
    });
  });

  describe('4. Authentication Ceremony Handlers & Session Issuance', () => {
    it('generates authentication options with challenge cookie', async () => {
      const store = createInMemoryPasskeyCredentialStore();
      await store.create({
        credentialId: 'existing_cred',
        publicKey: new Uint8Array([1, 2, 3]),
        counter: 1,
        userHandle: 'admin',
        createdAt: 1700000000,
      });

      const handlers = createPasskeyAuthenticationHandlers({
        store,
        rp,
        sessionIssuer,
        challengeCookieName: 'test_auth_challenge',
        _generateAuthenticationOptions: async (opts) => ({
          challenge: 'auth-challenge-123',
          rpId: opts.rpID,
          allowCredentials: opts.allowCredentials?.map((c) => ({
            id: c.id,
            type: 'public-key' as const,
            transports: c.transports,
          })),
        }),
      });

      const req = new Request('http://localhost/login/options', { method: 'POST' });
      const res = await handlers.options(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.challenge).toBe('auth-challenge-123');
      expect(json.allowCredentials).toHaveLength(1);

      const setCookie = res.headers.get('Set-Cookie');
      expect(setCookie).toContain('test_auth_challenge=auth-challenge-123');
    });

    it('generates real WebAuthn authentication options using @simplewebauthn/server without mocks', async () => {
      const store = createInMemoryPasskeyCredentialStore();
      await store.create({
        credentialId: 'real_cred_abc',
        publicKey: new Uint8Array([1, 2, 3]),
        counter: 1,
        userHandle: 'admin',
        createdAt: 1700000000,
      });

      const handlers = createPasskeyAuthenticationHandlers({
        store,
        rp,
        sessionIssuer,
      });

      const req = new Request('http://localhost/login/options', { method: 'POST' });
      const res = await handlers.options(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(typeof json.challenge).toBe('string');
      expect(json.challenge.length).toBeGreaterThan(10);
      expect(json.rpId).toBe('localhost');
      expect(json.allowCredentials).toBeDefined();
      expect(json.allowCredentials.length).toBe(1);
      expect(json.allowCredentials[0].id).toBe('real_cred_abc');

      const setCookie = res.headers.get('Set-Cookie');
      expect(setCookie).toContain('substrate_wa_auth_challenge=');
    });

    it('verifies assertion, detects counter advance, issues session cookie with amr: fido2', async () => {
      const store = createInMemoryPasskeyCredentialStore();
      await store.create({
        credentialId: 'cred_win_hello',
        publicKey: new Uint8Array([5, 6, 7]),
        counter: 10,
        userHandle: 'admin',
        createdAt: 1700000000,
      });

      let requireUserVerificationChecked = false;
      const handlers = createPasskeyAuthenticationHandlers({
        store,
        rp,
        sessionIssuer,
        cookieName: 'aevum_admin_token',
        challengeCookieName: 'test_auth_challenge',
        _verifyAuthenticationResponse: async (opts) => {
          requireUserVerificationChecked = opts.requireUserVerification === true;
          return {
            verified: true,
            authenticationInfo: {
              credentialID: 'cred_win_hello',
              newCounter: 11,
              userVerified: true,
              credentialDeviceType: 'singleDevice',
              credentialBackedUp: false,
              origin: 'http://localhost:3000',
              rpID: 'localhost',
            },
          };
        },
      });

      const req = new Request('http://localhost/login/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'test_auth_challenge=auth-challenge-123',
        },
        body: JSON.stringify({
          assertion: {
            id: 'cred_win_hello',
            rawId: 'cred_win_hello',
            type: 'public-key',
            response: {
              clientDataJSON: '',
              authenticatorData: '',
              signature: '',
            },
            clientExtensionResults: {},
          },
        }),
      });

      const res = await handlers.verify(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.subject).toBe('admin');
      expect(json.amr).toBe('fido2');
      expect(requireUserVerificationChecked).toBe(false); // Default 'preferred' allows UP without rejecting authenticators

      // Verify counter was updated in store
      const updated = await store.findByCredentialId('cred_win_hello');
      expect(updated?.counter).toBe(11);

      // Verify session cookie was set
      const cookies = res.headers.getSetCookie
        ? res.headers.getSetCookie()
        : [res.headers.get('Set-Cookie') ?? ''];
      const sessionCookie = cookies.find((c) => c.includes('aevum_admin_token='));
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toContain('Path=/');
      expect(sessionCookie).toContain('HttpOnly');

      // Verify challenge cookie was cleared
      const clearCookie = cookies.find((c) => c.includes('test_auth_challenge=;'));
      expect(clearCookie).toBeDefined();
      expect(clearCookie).toContain('Max-Age=0');
    });

    it('enforces requireUserVerification = true when userVerification is set to required', async () => {
      const store = createInMemoryPasskeyCredentialStore();
      await store.create({
        credentialId: 'cred_req_uv',
        publicKey: new Uint8Array([1, 2, 3]),
        counter: 0,
        userHandle: 'admin',
        createdAt: 1700000000,
      });

      let requireUserVerificationChecked = false;
      const handlers = createPasskeyAuthenticationHandlers({
        store,
        rp,
        sessionIssuer,
        userVerification: 'required',
        challengeCookieName: 'test_auth_challenge',
        _verifyAuthenticationResponse: async (opts) => {
          requireUserVerificationChecked = opts.requireUserVerification === true;
          return {
            verified: true,
            authenticationInfo: {
              credentialID: 'cred_req_uv',
              newCounter: 1,
              userVerified: true,
              credentialDeviceType: 'singleDevice',
              credentialBackedUp: false,
              origin: 'http://localhost:3000',
              rpID: 'localhost',
            },
          };
        },
      });

      const req = new Request('http://localhost/login/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'test_auth_challenge=auth-challenge-123',
        },
        body: JSON.stringify({
          assertion: {
            id: 'cred_req_uv',
            rawId: 'cred_req_uv',
            type: 'public-key',
            response: { clientDataJSON: '', authenticatorData: '', signature: '' },
            clientExtensionResults: {},
          },
        }),
      });

      const res = await handlers.verify(req);
      expect(res.status).toBe(200);
      expect(requireUserVerificationChecked).toBe(true);
    });

    it('detects cloned authenticators when counter fails to advance (clone detection)', async () => {
      const store = createInMemoryPasskeyCredentialStore();
      await store.create({
        credentialId: 'cred_cloned',
        publicKey: new Uint8Array([5, 6, 7]),
        counter: 10,
        userHandle: 'admin',
        createdAt: 1700000000,
      });

      const handlers = createPasskeyAuthenticationHandlers({
        store,
        rp,
        sessionIssuer,
        challengeCookieName: 'test_auth_challenge',
        _verifyAuthenticationResponse: async () => ({
          verified: true,
          authenticationInfo: {
            credentialID: 'cred_cloned',
            newCounter: 8, // Counter went backwards!
            userVerified: true,
            credentialDeviceType: 'singleDevice',
            credentialBackedUp: false,
            origin: 'http://localhost:3000',
            rpID: 'localhost',
          },
        }),
      });

      const req = new Request('http://localhost/login/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'test_auth_challenge=auth-challenge-123',
        },
        body: JSON.stringify({
          assertion: {
            id: 'cred_cloned',
            rawId: 'cred_cloned',
            type: 'public-key',
            response: { clientDataJSON: '', authenticatorData: '', signature: '' },
            clientExtensionResults: {},
          },
        }),
      });

      const res = await handlers.verify(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain('Possible clone detected');
    });

    it('rejects authentication verification when expectedOrigin does not match', async () => {
      const store = createInMemoryPasskeyCredentialStore();
      await store.create({
        credentialId: 'cred_origin_test',
        publicKey: new Uint8Array([1, 2, 3]),
        counter: 0,
        userHandle: 'admin',
        createdAt: 1700000000,
      });

      const handlers = createPasskeyAuthenticationHandlers({
        store,
        rp,
        sessionIssuer,
        challengeCookieName: 'test_auth_challenge',
        _verifyAuthenticationResponse: async () => {
          throw new Error('Unexpected origin "https://evil.com"');
        },
      });

      const req = new Request('http://localhost/login/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'test_auth_challenge=auth-challenge-123',
        },
        body: JSON.stringify({
          assertion: {
            id: 'cred_origin_test',
            response: {},
          },
        }),
      });

      const res = await handlers.verify(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Authentication verification failed.');
    });
  });

  describe('5. Full End-to-End Integration with StaticTokenProvider & Guards', () => {
    it('session cookie minted by passkey is accepted by existing provider & propagates amr: fido2', async () => {
      // 1. Mint a passkey session token directly using SessionIssuer
      const passkeySessionToken = await sessionIssuer.issue('admin', 3600, { amr: 'fido2' });

      // 2. Existing static token provider with same sessionIssuer
      const provider = createStaticTokenIdentityProvider(secret, {
        cookieName: 'aevum_admin_token',
        sessionIssuer,
      });

      // 3. Test API Guard
      const apiReq = new Request('https://aevum.dev/api/admin/writing', {
        headers: {
          Cookie: `aevum_admin_token=${passkeySessionToken}`,
        },
      });
      const apiGuard = await guardApi(apiReq, { provider });
      expect(apiGuard.authorized).toBe(true);
      if (apiGuard.authorized) {
        expect(apiGuard.identity.subject).toBe('admin');
        expect(apiGuard.identity.mechanism).toBe('cookie-session');
        expect(apiGuard.identity.amr).toBe('fido2');
      }

      // 4. Test Page Guard
      const pageReq = new Request('https://aevum.dev/console/writing', {
        headers: {
          Cookie: `aevum_admin_token=${passkeySessionToken}`,
        },
      });
      const pageGuard = await guardPage(pageReq, { provider });
      expect(pageGuard.authorized).toBe(true);
      if (pageGuard.authorized) {
        expect(pageGuard.identity.subject).toBe('admin');
        expect(pageGuard.identity.mechanism).toBe('cookie-session');
        expect(pageGuard.identity.amr).toBe('fido2');
      }
    });
  });
});
