/**
 * Better Auth API route — handles all auth requests at /api/auth/*.
 *
 * Mounts the Better Auth handler, which processes:
 *  - POST /api/auth/sign-up/email
 *  - POST /api/auth/sign-in/email
 *  - POST /api/auth/sign-out
 *  - GET  /api/auth/get-session
 *  - POST /api/auth/passkey/add
 *  - GET  /api/auth/passkey/list
 *  - POST /api/auth/oauth/github  (GitHub OAuth)
 */
import { toNextJsHandler } from 'better-auth/next-js';
import { createAuth } from '@substrate/contracts/auth';

const auth = createAuth({
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/aevum',
  secret: process.env.AUTH_SECRET ?? 'dev-secret-change-in-production',
  baseUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
});

const { GET, POST } = toNextJsHandler(auth);

export { GET, POST };
