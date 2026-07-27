/**
 * Better Auth API route — handles all auth requests at /api/auth/*.
 *
 * Mounts the Better Auth handler, which processes:
 *  - POST /api/auth/sign-up/email
 *  - POST /api/auth/sign-in/email
 *  - POST /api/auth/sign-out
 *  - GET  /api/auth/get-session
 *  - POST /api/auth/oauth/github  (GitHub OAuth)
 */

import { createAuth } from '@substrate/contracts/auth';
import { toNextJsHandler } from 'better-auth/next-js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is required. Set it in your environment or .env file. ` +
        'See .env.example for all required variables.',
    );
  }
  return value;
}

const auth = createAuth({
  databaseUrl: requireEnv('DATABASE_URL'),
  secret: requireEnv('AUTH_SECRET'),
  baseUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
});

const { GET, POST } = toNextJsHandler(auth);

export { GET, POST };
