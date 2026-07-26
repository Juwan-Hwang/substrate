/**
 * Better Auth — client-side auth utilities.
 *
 * Uses better-auth/client to create a typed auth client.
 * Provides signIn, signOut, getSession, and useSession hooks.
 *
 * The server-side auth instance is configured in @substrate/contracts/auth.
 */
import { createAuthClient } from 'better-auth/client';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
});

export const {
  signIn,
  signOut,
  signUp,
  useSession,
  useListSessions,
  passkey: {
    addPasskey,
    listPasskeys,
    deletePasskey,
  },
} = authClient;

export type Session = Awaited<ReturnType<typeof authClient.getSession>>;
