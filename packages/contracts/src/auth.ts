/**
 * Better Auth configuration — WebAuthn Passkeys + OAuth.
 *
 * OAuth credentials are read from environment variables, not hardcoded.
 * Set these in .env or via your deployment platform:
 *   GITHUB_OAUTH_CLIENT_ID
 *   GITHUB_OAUTH_CLIENT_SECRET
 */
import { betterAuth } from 'better-auth';

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
    database: {
      url: config.databaseUrl,
    },
    secret: config.secret,
    baseURL: config.baseUrl,
    authentication: {
      strategies: [
        {
          id: 'passkey',
          type: 'webauthn',
        },
      ],
    },
    socialProviders: {
      github: {
        clientId: githubClientId ?? '',
        clientSecret: githubClientSecret ?? '',
      },
    },
  });
}
