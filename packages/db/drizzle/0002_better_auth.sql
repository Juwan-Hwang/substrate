-- Drizzle migration: better_auth tables
-- Better Auth with Passkeys — user, session, account, verification, passkey
-- Reference: https://www.better-auth.com/docs/concepts/database

-- ── experiments: add user_id column (nullable, backward compatible) ──

ALTER TABLE "experiments" ADD COLUMN IF NOT EXISTS "user_id" text;
CREATE INDEX IF NOT EXISTS "experiments_user_id_idx" ON "experiments" ("user_id");

-- ── user ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL,
  "image" text,
  "createdAt" timestamp NOT NULL,
  "updatedAt" timestamp NOT NULL
);

-- email is covered by the UNIQUE constraint above.

-- ── session ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY,
  "expiresAt" timestamp NOT NULL,
  "token" text NOT NULL UNIQUE,
  "createdAt" timestamp NOT NULL,
  "updatedAt" timestamp NOT NULL,
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);

-- token is covered by the UNIQUE constraint above.
CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("userId");

-- ── account ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamp,
  "refreshTokenExpiresAt" timestamp,
  "scope" text,
  "password" text,
  "createdAt" timestamp NOT NULL,
  "updatedAt" timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("userId");

-- ── verification ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "createdAt" timestamp NOT NULL,
  "updatedAt" timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");

-- ── passkey ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "passkey" (
  "id" text PRIMARY KEY,
  "name" text,
  "credentialID" text NOT NULL UNIQUE,
  "credentialPublicKey" text NOT NULL,
  "counter" integer NOT NULL,
  "deviceType" text NOT NULL,
  "backedUp" boolean NOT NULL,
  "transports" text NOT NULL,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "createdAt" timestamp NOT NULL,
  "updatedAt" timestamp NOT NULL
);

-- credentialID is covered by the UNIQUE constraint above.
CREATE INDEX IF NOT EXISTS "passkey_userId_idx" ON "passkey" ("userId");
