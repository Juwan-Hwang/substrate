# @substrate-platform/auth

Platform-level authentication and administrative identity primitives for the Substrate platform and consumer applications.

Provides domain-agnostic identity contracts (elevated to `@substrate-platform/contracts`), constant-time token verification, dual-channel extraction (HTTP Header & Cookie), stateless HMAC signed sessions, brute-force rate limiting, and route guards.

---

## Features

- 🔐 **Dual-Channel Extraction**: Seamlessly verifies identity via `Authorization: Bearer <token>` and `Cookie: <cookieName>=<token>`.
- ⚡ **Zero-VPS / Stateless Sessions**: Signed Web Crypto HMAC-SHA256 tokens with embedded cryptographically random nonces and expiration (`exp`). Requires no Redis or database session store.
- 🛡️ **Timing-Safe Evaluation**: SHA-256 digest hashing + constant-time comparison prevents side-channel timing attacks.
- 🛑 **Fail-Closed by Design**: Automatically denies all requests if the secret is unset or empty, returning generic error messages without leaking server configuration state.
- 💻 **Loopback Development Trust**: `createDevelopmentIdentityProvider()` automatically trusts `localhost` / `127.0.0.1` / `::1` while strictly denying remote requests.
- ⏱️ **Brute-Force Rate Limiting**: Built-in in-memory IP cooldown rate limiter with pluggable interface and reverse proxy header awareness.
- 🚦 **Route Guards & Open Redirect Defense**: Framework-agnostic `guardApi` (403 JSON), `guardPage` (307 redirect with `returnTo`), and `sanitizeReturnTo` path sanitization.

---

## Installation

```bash
bun add @substrate-platform/auth @substrate-platform/contracts
```

---

## Runtime Environment & Edge Compatibility

- **Node.js / Bun Runtime**: `timingSafeEqualStrings` and `createStaticTokenIdentityProvider` utilize `node:crypto` for length-safe constant-time string comparisons. Next.js 16 Route Handlers (`app/api/**/route.ts`) and Server Actions run in the Node.js runtime by default.
- **Edge Runtime / Browser**: The stateless session issuer (`createSessionIssuer`) is built entirely on the standard **Web Crypto API** (`crypto.subtle`), making session issuance and verification fully compatible with Edge runtimes (Cloudflare Workers, Vercel Edge).
- **Edge Middleware Notice**: If deploying identity guards inside Next.js Edge Middleware (`middleware.ts`), ensure `node:crypto` is supported in your target edge environment or use the Web Crypto session issuer channel.

---

## Serverless Rate Limiting Architecture

The default `createInMemoryRateLimiter()` stores attempt counters in process memory. On ephemeral serverless platforms (e.g. Vercel Serverless Functions, AWS Lambda), memory is isolated per concurrent worker instance.

For distributed production deployments across multi-region serverless instances, inject a custom `RateLimiter` implementation (e.g. backed by Upstash Redis or PostgreSQL):

```ts
import type { RateLimiter, RateLimiterCheckResult } from '@substrate-platform/auth';

export class RedisRateLimiter implements RateLimiter {
  async check(key: string): Promise<RateLimiterCheckResult> {
    // Query Redis key attempt count & TTL
    return { allowed: true };
  }
  async recordFailure(key: string): Promise<void> {
    // INCR and set EXPIRE in Redis
  }
  async reset(key: string): Promise<void> {
    // DEL key in Redis
  }
}
```

---

## Consumer Integration Guide

### 1. Configure Secrets in Environment

```env
# Shared secret for static tokens and session signing
AUTH_SECRET="your-high-entropy-random-secret"
```

### 2. Configure Identity Provider

In your application's identity boundary:

```ts
import {
  createDevelopmentIdentityProvider,
  createStaticTokenIdentityProvider,
  type AdminIdentityProvider,
} from '@substrate-platform/auth';

export function getAdminIdentityProvider(): AdminIdentityProvider {
  if (process.env.NODE_ENV === 'production') {
    return createStaticTokenIdentityProvider(process.env.AUTH_SECRET);
  }
  return createDevelopmentIdentityProvider();
}
```

### 3. Mount Route Handlers (Next.js App Router)

**`src/app/api/auth/login/route.ts`**:
```ts
import { createLoginHandler } from '@substrate-platform/auth';

export const POST = createLoginHandler({
  secret: process.env.AUTH_SECRET,
  cookieName: 'substrate_session',
  trustProxy: true, // Prioritizes CF-Connecting-IP, X-Real-IP, and X-Forwarded-For
});
```

**`src/app/api/auth/logout/route.ts`**:
```ts
import { createLogoutHandler } from '@substrate-platform/auth';

// Restricted to POST to prevent Cross-Site GET logout attacks
export const POST = createLogoutHandler({
  cookieName: 'substrate_session',
});
```

### 4. Protect APIs & Pages with Open Redirect Defense

**Protecting API Routes**:
```ts
import { guardApi } from '@substrate-platform/auth';
import { getAdminIdentityProvider } from '@/lib/auth';

export async function POST(request: Request) {
  const guard = await guardApi(request, {
    provider: getAdminIdentityProvider(),
  });

  if (!guard.authorized) {
    return guard.response; // Returns 403 Forbidden JSON
  }

  const { identity } = guard;
  console.log(`Action performed by ${identity.subject} via ${identity.mechanism}`);

  return Response.json({ success: true });
}
```

**Protecting Pages & Handling Login Redirection Safely**:
```tsx
import { guardPage, sanitizeReturnTo } from '@substrate-platform/auth';
import { redirect } from 'next/navigation';
import { getAdminIdentityProvider } from '@/lib/auth';

export default async function AdminDashboardPage() {
  const guard = await guardPage(new Request(headers().get('x-url') ?? '...'), {
    provider: getAdminIdentityProvider(),
    loginPath: '/login',
  });

  if (!guard.authorized) {
    redirect(guard.redirectUrl);
  }

  return <div>Welcome to Admin Console, {guard.identity.subject}</div>;
}
```

**Consumer Login Page Handling `returnTo`**:
```tsx
'use client';
import { sanitizeReturnTo } from '@substrate-platform/auth';
import { useSearchParams, useRouter } from 'next/navigation';

export function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  async function handleLoginSuccess() {
    // ALWAYS sanitize returnTo before navigating to prevent Open Redirect vulnerabilities
    const returnTo = sanitizeReturnTo(searchParams.get('returnTo'), '/console');
    router.push(returnTo);
  }
}
```

### 5. Passkey / WebAuthn Ceremony Integration

Passkey provides hardware-bound authentication (Windows Hello, Touch ID, YubiKey) emitting standard signed session cookies tagged with `amr: 'fido2'`.

#### 1. Implement `PasskeyCredentialStore`
The auth package is 100% database-agnostic. Implement the seam with Postgres, Drizzle, or Upstash KV:

```ts
import type { PasskeyCredential, PasskeyCredentialStore } from '@substrate-platform/auth';
import { db, passkeyCredentialsTable, eq } from '@/lib/db';

export const passkeyStore: PasskeyCredentialStore = {
  async create(cred) {
    await db.insert(passkeyCredentialsTable).values(cred);
  },
  async findByCredentialId(id) {
    const [found] = await db.select().from(passkeyCredentialsTable).where(eq(passkeyCredentialsTable.credentialId, id));
    return found ?? null;
  },
  async listByUser(userHandle) {
    return db.select().from(passkeyCredentialsTable).where(eq(passkeyCredentialsTable.userHandle, userHandle));
  },
  async updateCounter(credentialId, counter) {
    await db.update(passkeyCredentialsTable).set({ counter }).where(eq(passkeyCredentialsTable.credentialId, credentialId));
  },
  async delete(credentialId) {
    await db.delete(passkeyCredentialsTable).where(eq(passkeyCredentialsTable.credentialId, credentialId));
  },
};
```

#### 2. Mount Registration & Authentication Handlers
```ts
import {
  createPasskeyRegistrationHandlers,
  createPasskeyAuthenticationHandlers,
  createSessionIssuer,
  getAdminIdentityProvider,
} from '@substrate-platform/auth';

const rp = {
  rpID: process.env.NEXT_PUBLIC_RP_ID ?? 'localhost',
  rpName: 'Aevum Platform',
  expectedOrigins: [process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'],
};

const sessionIssuer = createSessionIssuer(process.env.AUTH_SECRET);

// Registration (Requires Admin Session, fail-closed)
export const regHandlers = createPasskeyRegistrationHandlers({
  store: passkeyStore,
  rp,
  secret: process.env.AUTH_SECRET, // Signs challenge cookies with server-side expiration
  user: { id: 'admin', name: 'admin', displayName: 'Administrator' },
  adminProvider: getAdminIdentityProvider(), // REQUIRED: Guards registration endpoints
  path: '/api/auth/passkey/register', // Optional: scopes challenge cookie
});

// Authentication (Emits standard aevum_admin_token session cookie)
export const authHandlers = createPasskeyAuthenticationHandlers({
  store: passkeyStore,
  rp,
  secret: process.env.AUTH_SECRET, // Signs challenge cookies with server-side expiration
  sessionIssuer,
  cookieName: 'aevum_admin_token',
  path: '/api/auth/passkey/login', // Optional: scopes challenge cookie
});
```

Mount Next.js Route Handlers:
- `src/app/api/auth/passkey/register/options/route.ts` ➔ `export const POST = regHandlers.options;`
- `src/app/api/auth/passkey/register/verify/route.ts` ➔ `export const POST = regHandlers.verify;`
- `src/app/api/auth/passkey/login/options/route.ts` ➔ `export const POST = authHandlers.options;`
- `src/app/api/auth/passkey/login/verify/route.ts` ➔ `export const POST = authHandlers.verify;`

#### Security Guarantees:
- **Fail-Closed Registration**: `adminProvider` is mandatory; unauthenticated callers cannot trigger registration options or verify.
- **Signed Challenge Envelope & Production Secret Guard**: Challenges are HMAC-signed with server-side cryptographic timestamps, preventing replay attacks and challenge forging. In production (`NODE_ENV=production`), missing secret throws on initialization.
- **W3C Standard User Verification**: `userVerification` defaults to `'preferred'` (requesting biometric/PIN prompt while accepting User Presence touch from hardware keys without false rejections). Setting `userVerification: 'required'` strictly enforces UV at both options and verification stages.
- **Credential Uniqueness & Nickname Sanitization**: Rejects duplicate credential IDs with 409 Conflict before persistence and caps nickname length at 64 characters.
- **Clone Detection**: Signature counters are verified against the stored credential counter; counter rewinds or freezes trigger 403 Forbidden.
- **Default Rate Limiting & Proxy Configuration**: Built-in in-memory rate limiting defends registration and authentication ceremonies against brute-force attacks, with full `trustProxy` and `proxyHeader` support.
- **Information Leak Defense**: Route handlers return generic safe error messages on verification failures to avoid leaking internal parser or COSE structure details.

---

## License

Apache-2.0
