/**
 * Better Auth — client-side auth utilities.
 *
 * Uses better-auth/react to create a typed auth client whose `useSession`
 * is a proper React hook (the vanilla `better-auth/client` exposes it as a
 * nanostores atom, which is not callable as a hook).
 * Provides signIn, signOut, signUp, getSession, and useSession hooks.
 *
 * The server-side auth instance is configured in @substrate/contracts/auth.
 */
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
});

export const { signIn, signOut, signUp, useSession } = authClient;

export type Session = Awaited<ReturnType<typeof authClient.getSession>>;
