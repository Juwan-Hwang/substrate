-- Drizzle migration: newsletter_subscribers table
-- Generated from packages/db/src/index.ts

CREATE TABLE IF NOT EXISTS "newsletter_subscribers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" text NOT NULL UNIQUE,
  "confirmed" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "newsletter_subscribers_email_idx"
  ON "newsletter_subscribers" ("email");

CREATE INDEX IF NOT EXISTS "newsletter_subscribers_confirmed_idx"
  ON "newsletter_subscribers" ("confirmed");

CREATE INDEX IF NOT EXISTS "newsletter_subscribers_created_at_idx"
  ON "newsletter_subscribers" ("created_at" DESC);
