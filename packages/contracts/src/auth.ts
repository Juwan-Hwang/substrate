/**
 * Better Auth configuration — Email/Password + OAuth.
 *
 * OAuth credentials are read from environment variables, not hardcoded.
 * Set these in .env or via your deployment platform:
 *   GITHUB_OAUTH_CLIENT_ID
 *   GITHUB_OAUTH_CLIENT_SECRET
 *
 * Passkey support requires the `@better-auth/passkey` package:
 *   npm add @better-auth/passkey
 * Then add `passkey()` to the plugins array.
 */
import { betterAuth } from 'better-auth';
import { Pool } from 'pg';

export type AuthConfig = {
  databaseUrl: string;
  secret: string;
  baseUrl: string;
  githubClientId?: string;
  githubClientSecret?: string;
};

export function createAuth(config: AuthConfig) {
  const githubClientId = config.githubClientId ?? process.env.GITHUB_OAUTH_CLIENT_ID;
  const githubClientSecret = config.githubClientSecret ?? process.env.GITHUB_OAUTH_CLIENT_SECRET;

  return betterAuth({
    // Better Auth's Kysely adapter requires a pg.Pool instance,
    // not a plain { url } object. Passing { url } silently produces
    // a null adapter and "Failed to initialize database adapter".
    database: new Pool({ connectionString: config.databaseUrl }),
    secret: config.secret,
    baseURL: config.baseUrl,
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      github: {
        clientId: githubClientId ?? '',
        clientSecret: githubClientSecret ?? '',
      },
    },
  });
}
