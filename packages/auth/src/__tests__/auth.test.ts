import { describe, expect, it } from 'vitest';
import {
  assertAdmin,
  createDevelopmentIdentityProvider,
  createInMemoryRateLimiter,
  createLoginHandler,
  createLogoutHandler,
  createSessionIssuer,
  createStaticTokenIdentityProvider,
  extractClientIp,
  guardApi,
  guardPage,
  parseCookies,
  sanitizeReturnTo,
  timingSafeEqualStrings,
} from '../index';

describe('@substrate-platform/auth', () => {
  describe('1. Timing-safe Cryptography & Secret Handling', () => {
    it('accurately verifies strings in constant time', () => {
      expect(timingSafeEqualStrings('supersecret', 'supersecret')).toBe(true);
      expect(timingSafeEqualStrings('supersecret', 'wrongsecret')).toBe(false);
      expect(timingSafeEqualStrings('supersecret', 'short')).toBe(false);
      expect(timingSafeEqualStrings('', '')).toBe(true);
    });

    it('handles non-string types safely', () => {
      // @ts-expect-error testing invalid inputs
      expect(timingSafeEqualStrings(null, 'secret')).toBe(false);
      // @ts-expect-error testing invalid inputs
      expect(timingSafeEqualStrings(undefined, 'secret')).toBe(false);
    });
  });

  describe('2. Development Identity Provider (Loopback Trust)', () => {
    const devProvider = createDevelopmentIdentityProvider();

    it('trusts localhost loopback requests', async () => {
      const req = new Request('http://localhost:3000/api/console');
      const identity = await devProvider.resolve(req);
      expect(identity).toEqual({ subject: 'development', mechanism: 'dev-trust' });
    });

    it('trusts 127.0.0.1 loopback requests', async () => {
      const req = new Request('http://127.0.0.1:3000/api/console');
      const identity = await devProvider.resolve(req);
      expect(identity).toEqual({ subject: 'development', mechanism: 'dev-trust' });
    });

    it('trusts IPv6 [::1] loopback requests', async () => {
      const req = new Request('http://[::1]:3000/api/console');
      const identity = await devProvider.resolve(req);
      expect(identity).toEqual({ subject: 'development', mechanism: 'dev-trust' });
    });

    it('strictly denies remote host requests even in dev mode', async () => {
      const req = new Request('https://aevum.dev/api/console');
      const identity = await devProvider.resolve(req);
      expect(identity).toBeNull();
    });

    it('strictly denies internal LAN non-loopback host requests', async () => {
      const req = new Request('http://192.168.1.50:3000/api/console');
      const identity = await devProvider.resolve(req);
      expect(identity).toBeNull();
    });
  });

  describe('3. Stateless Signed Session Issuer (HMAC-SHA256)', () => {
    const secret = 'test-session-secret-key-1234567890';
    const issuer = createSessionIssuer(secret, { defaultTtlSeconds: 60 });

    it('issues and verifies a valid signed session token', async () => {
      const token = await issuer.issue('admin-user', 120);
      expect(token).toContain('.');

      const payload = await issuer.verify(token);
      expect(payload).not.toBeNull();
      expect(payload?.subject).toBe('admin-user');
      expect(payload?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
      expect(payload?.nonce).toBeDefined();
    });

    it('rejects tampered signatures', async () => {
      const token = await issuer.issue('admin-user');
      const [payload, sig] = token.split('.');
      const tampered = `${payload}.${(sig ?? '').slice(0, -4)}aaaa`;

      const result = await issuer.verify(tampered);
      expect(result).toBeNull();
    });

    it('rejects tampered payloads', async () => {
      const token = await issuer.issue('admin-user');
      const parts = token.split('.');
      const tamperedPayload = Buffer.from(
        JSON.stringify({ subject: 'hacker', exp: 9999999999 }),
      ).toString('base64url');
      const tampered = `${tamperedPayload}.${parts[1]}`;

      const result = await issuer.verify(tampered);
      expect(result).toBeNull();
    });

    it('rejects expired tokens', async () => {
      const expiredIssuer = createSessionIssuer(secret, { defaultTtlSeconds: -10 });
      const token = await expiredIssuer.issue('admin-user');

      const result = await expiredIssuer.verify(token);
      expect(result).toBeNull();
    });

    it('throws when issuing without secret', async () => {
      const noSecretIssuer = createSessionIssuer(undefined);
      await expect(noSecretIssuer.issue('admin')).rejects.toThrow('auth secret is not configured');
    });

    it('returns null when verifying with unconfigured secret', async () => {
      const noSecretIssuer = createSessionIssuer(undefined);
      expect(await noSecretIssuer.verify('some.token')).toBeNull();
    });
  });

  describe('4. Dual-Channel Static Token Provider (Header + Cookie)', () => {
    const secret = 'production-secret-token-abcdef';
    const sessionIssuer = createSessionIssuer(secret);
    const provider = createStaticTokenIdentityProvider(secret, { sessionIssuer });

    it('authenticates via Authorization: Bearer <token>', async () => {
      const req = new Request('https://example.com/api', {
        headers: {
          Authorization: `Bearer ${secret}`,
        },
      });

      const identity = await provider.resolve(req);
      expect(identity).toEqual({ subject: 'admin', mechanism: 'static-token' });
    });

    it('authenticates via signed session token in Authorization Bearer', async () => {
      const sessionToken = await sessionIssuer.issue('operator');
      const req = new Request('https://example.com/api', {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      const identity = await provider.resolve(req);
      expect(identity).toEqual({ subject: 'operator', mechanism: 'bearer-session' });
    });

    it('authenticates via Cookie: substrate_session=<token>', async () => {
      const req = new Request('https://example.com/api', {
        headers: {
          Cookie: `substrate_session=${secret}`,
        },
      });

      const identity = await provider.resolve(req);
      expect(identity).toEqual({ subject: 'admin', mechanism: 'cookie-static' });
    });

    it('authenticates via signed session token in Cookie', async () => {
      const sessionToken = await sessionIssuer.issue('editor');
      const req = new Request('https://example.com/api', {
        headers: {
          Cookie: `other_cookie=123; substrate_session=${sessionToken}; analytics=true`,
        },
      });

      const identity = await provider.resolve(req);
      expect(identity).toEqual({ subject: 'editor', mechanism: 'cookie-session' });
    });

    it('supports custom cookie name', async () => {
      const customProvider = createStaticTokenIdentityProvider(secret, {
        cookieName: 'custom_admin_token',
      });

      const req = new Request('https://example.com/api', {
        headers: {
          Cookie: `custom_admin_token=${secret}`,
        },
      });

      const identity = await customProvider.resolve(req);
      expect(identity).toEqual({ subject: 'admin', mechanism: 'cookie-static' });
    });

    it('denies requests with incorrect token in both channels', async () => {
      const req = new Request('https://example.com/api', {
        headers: {
          Authorization: 'Bearer wrong-token',
          Cookie: 'substrate_session=invalid-cookie',
        },
      });

      const identity = await provider.resolve(req);
      expect(identity).toBeNull();
    });

    it('is fail-closed when secret is undefined or empty', async () => {
      const unconfiguredProvider = createStaticTokenIdentityProvider(undefined);
      const req = new Request('https://example.com/api', {
        headers: {
          Authorization: 'Bearer any-token',
          Cookie: 'substrate_session=any-token',
        },
      });

      expect(await unconfiguredProvider.resolve(req)).toBeNull();
    });
  });

  describe('5. Client IP Extraction & Reverse Proxy Trust', () => {
    it('prioritizes CF-Connecting-IP over XFF', () => {
      const req = new Request('http://localhost', {
        headers: {
          'CF-Connecting-IP': '203.0.113.195',
          'X-Forwarded-For': '198.51.100.1, 10.0.0.1',
        },
      });
      expect(extractClientIp(req)).toBe('203.0.113.195');
    });

    it('prioritizes X-Real-IP over XFF', () => {
      const req = new Request('http://localhost', {
        headers: {
          'X-Real-IP': '198.51.100.42',
          'X-Forwarded-For': '198.51.100.1',
        },
      });
      expect(extractClientIp(req)).toBe('198.51.100.42');
    });

    it('respects custom proxy header', () => {
      const req = new Request('http://localhost', {
        headers: {
          'True-Client-IP': '192.0.2.1',
          'X-Real-IP': '198.51.100.42',
        },
      });
      expect(extractClientIp(req, { proxyHeader: 'True-Client-IP' })).toBe('192.0.2.1');
    });

    it('ignores X-Forwarded-For when trustProxy is false', () => {
      const req = new Request('http://localhost', {
        headers: {
          'X-Forwarded-For': '198.51.100.1',
        },
      });
      expect(extractClientIp(req, { trustProxy: false })).toBe('127.0.0.1');
    });
  });

  describe('6. Open Redirect Protection (sanitizeReturnTo)', () => {
    it('allows valid safe local relative paths', () => {
      expect(sanitizeReturnTo('/console')).toBe('/console');
      expect(sanitizeReturnTo('/console/writing?id=1#details')).toBe(
        '/console/writing?id=1#details',
      );
      expect(sanitizeReturnTo('/')).toBe('/');
    });

    it('rejects protocol-relative URLs (//evil.com)', () => {
      expect(sanitizeReturnTo('//evil.com', '/fallback')).toBe('/fallback');
      expect(sanitizeReturnTo('//attacker.com/path', '/fallback')).toBe('/fallback');
    });

    it('rejects backslash obfuscation (/evil.com or \\evil.com)', () => {
      expect(sanitizeReturnTo('/\\evil.com', '/fallback')).toBe('/fallback');
      expect(sanitizeReturnTo('\\evil.com', '/fallback')).toBe('/fallback');
      expect(sanitizeReturnTo('/path\\sub', '/fallback')).toBe('/fallback');
    });

    it('rejects absolute URLs and explicit schemes', () => {
      expect(sanitizeReturnTo('https://evil.com', '/fallback')).toBe('/fallback');
      expect(sanitizeReturnTo('http://evil.com', '/fallback')).toBe('/fallback');
      expect(sanitizeReturnTo('javascript:alert(1)', '/fallback')).toBe('/fallback');
      expect(sanitizeReturnTo('data:text/html,attack', '/fallback')).toBe('/fallback');
    });

    it('rejects control characters, tab characters, and newlines (preventing WHATWG URL normalization bypasses)', () => {
      expect(sanitizeReturnTo('/\t/evil.com', '/fallback')).toBe('/fallback');
      expect(sanitizeReturnTo('/\n/evil.com', '/fallback')).toBe('/fallback');
      expect(sanitizeReturnTo('/\r/evil.com', '/fallback')).toBe('/fallback');
      expect(sanitizeReturnTo('/console\u0000', '/fallback')).toBe('/fallback');
      expect(sanitizeReturnTo('/console\u001f', '/fallback')).toBe('/fallback');
      expect(sanitizeReturnTo('/console\u007f', '/fallback')).toBe('/fallback');
    });

    it('safely handles empty, null or undefined values', () => {
      expect(sanitizeReturnTo(null, '/fallback')).toBe('/fallback');
      expect(sanitizeReturnTo(undefined, '/fallback')).toBe('/fallback');
      expect(sanitizeReturnTo('', '/fallback')).toBe('/fallback');
      expect(sanitizeReturnTo('   ', '/fallback')).toBe('/fallback');
    });
  });

  describe('7. Cookie Parser Utility', () => {
    it('parses cookie headers properly', () => {
      expect(parseCookies(null)).toEqual({});
      expect(parseCookies('')).toEqual({});
      expect(parseCookies('a=1; b=hello%20world; c=true')).toEqual({
        a: '1',
        b: 'hello world',
        c: 'true',
      });
    });
  });

  describe('8. Rate Limiter (Brute-force Protection)', () => {
    it('allows requests up to max attempts then triggers cooldown', async () => {
      const limiter = createInMemoryRateLimiter({ maxAttempts: 3, windowSeconds: 10 });
      const ip = '1.2.3.4';

      expect(await limiter.check(ip)).toEqual({ allowed: true });
      await limiter.recordFailure(ip);
      expect(await limiter.check(ip)).toEqual({ allowed: true });
      await limiter.recordFailure(ip);
      expect(await limiter.check(ip)).toEqual({ allowed: true });
      await limiter.recordFailure(ip);

      const checkAfter = await limiter.check(ip);
      expect(checkAfter.allowed).toBe(false);
      expect(checkAfter.retryAfterSeconds).toBeGreaterThan(0);

      // Reset
      await limiter.reset?.(ip);
      expect(await limiter.check(ip)).toEqual({ allowed: true });
    });
  });

  describe('9. Route Handlers (Login & Logout)', () => {
    const secret = 'login-pass-1234';
    const loginHandler = createLoginHandler({ secret, secureCookie: true });
    const logoutHandler = createLogoutHandler();

    it('rejects non-POST methods for login', async () => {
      const req = new Request('http://localhost/api/auth/login', { method: 'GET' });
      const res = await loginHandler(req);
      expect(res.status).toBe(405);
    });

    it('rejects non-POST methods for logout (prevents Cross-Site GET logout attacks)', async () => {
      const req = new Request('http://localhost/api/auth/logout', { method: 'GET' });
      const res = await logoutHandler(req);
      expect(res.status).toBe(405);
    });

    it('returns generic error when secret is unconfigured without leaking internals', async () => {
      const unconfigured = createLoginHandler({ secret: undefined });
      const req = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'test' }),
      });
      const res = await unconfigured(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('Authentication service unavailable.');
    });

    it('rejects incorrect password credentials', async () => {
      const req = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'wrong' }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('successfully logs in with valid JSON password and sets secure cookie', async () => {
      const req = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: secret }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);

      const cookie = res.headers.get('Set-Cookie');
      expect(cookie).toContain('substrate_session=');
      expect(cookie).toContain('Path=/');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Secure');
    });

    it('successfully logs in with valid form-urlencoded password', async () => {
      const formData = new FormData();
      formData.set('password', secret);

      const req = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        body: formData,
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it('enforces rate limiting on repeated failed login attempts', async () => {
      const limiter = createInMemoryRateLimiter({ maxAttempts: 2, windowSeconds: 30 });
      const handler = createLoginHandler({ secret, rateLimiter: limiter });

      const req = () =>
        new Request('http://localhost/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.0.1' },
          body: JSON.stringify({ password: 'bad' }),
        });

      await handler(req());
      await handler(req());
      const rateLimitedRes = await handler(req());

      expect(rateLimitedRes.status).toBe(429);
      expect(rateLimitedRes.headers.get('Retry-After')).toBeDefined();
    });

    it('successfully logs out and clears cookie via POST', async () => {
      const req = new Request('http://localhost/api/auth/logout', { method: 'POST' });
      const res = await logoutHandler(req);
      expect(res.status).toBe(200);

      const cookie = res.headers.get('Set-Cookie');
      expect(cookie).toContain('substrate_session=;');
      expect(cookie).toContain('Max-Age=0');
      expect(cookie).toContain('Path=/');
    });
  });

  describe('10. Guard Primitives (API & Page & Assert)', () => {
    const secret = 'guard-secret-xyz';
    const provider = createStaticTokenIdentityProvider(secret);

    it('guardApi allows authenticated requests', async () => {
      const req = new Request('http://localhost/api/resource', {
        headers: { Authorization: `Bearer ${secret}` },
      });

      const result = await guardApi(req, { provider });
      expect(result.authorized).toBe(true);
      if (result.authorized) {
        expect(result.identity.subject).toBe('admin');
      }
    });

    it('guardApi returns 403 Response for unauthenticated requests', async () => {
      const req = new Request('http://localhost/api/resource');
      const result = await guardApi(req, { provider });

      expect(result.authorized).toBe(false);
      if (!result.authorized) {
        expect(result.response.status).toBe(403);
        const json = await result.response.json();
        expect(json.success).toBe(false);
      }
    });

    it('guardPage allows authenticated requests', async () => {
      const req = new Request('https://aevum.dev/console/writing', {
        headers: { Cookie: `substrate_session=${secret}` },
      });

      const result = await guardPage(req, { provider });
      expect(result.authorized).toBe(true);
      if (result.authorized) {
        expect(result.identity.subject).toBe('admin');
      }
    });

    it('guardPage redirects unauthenticated requests with sanitized returnTo', async () => {
      const req = new Request('https://aevum.dev/console/writing');
      const result = await guardPage(req, { provider, loginPath: '/console/login' });

      expect(result.authorized).toBe(false);
      if (!result.authorized) {
        expect(result.response.status).toBe(307);
        expect(result.redirectUrl).toBe(
          'https://aevum.dev/console/login?returnTo=%2Fconsole%2Fwriting',
        );
      }
    });

    it('assertAdmin returns identity or throws 403 response', async () => {
      const validReq = new Request('http://localhost/api', {
        headers: { Authorization: `Bearer ${secret}` },
      });
      const identity = await assertAdmin(validReq, provider);
      expect(identity.subject).toBe('admin');

      const invalidReq = new Request('http://localhost/api');
      await expect(assertAdmin(invalidReq, provider)).rejects.toBeInstanceOf(Response);
    });
  });
});
