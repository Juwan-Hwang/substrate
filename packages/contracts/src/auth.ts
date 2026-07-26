/**
 * Better Auth configuration — WebAuthn Passkeys + OAuth.
 */
import { betterAuth } from 'better-auth';

export type AuthConfig = {
  databaseUrl: string;
  secret: string;
  baseUrl: string;
};

export function createAuth(config: AuthConfig) {
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
      github: { clientId: '', clientSecret: '' },
    },
  });
}
