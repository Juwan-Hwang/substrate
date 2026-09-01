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
  // ...
}
```

---

## License

Apache-2.0
