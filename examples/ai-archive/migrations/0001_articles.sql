-- AI Archive example: Application-level schema
--
-- This migration creates the `articles` table for the AI Archive example.
-- The platform (@substrate/db) does NOT define content tables —
-- each application defines its own.

CREATE TYPE "content_status" AS ENUM('draft', 'published', 'archived');

CREATE TABLE IF NOT EXISTS "articles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "excerpt" text,
  "body" text NOT NULL,
  "tags" text[] DEFAULT '{}',
  "status" "content_status" DEFAULT 'draft',
  "embedding" vector(1536),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "articles_slug_unique" UNIQUE("slug")
);

-- FTS index on articles (title || excerpt || body)
CREATE INDEX IF NOT EXISTS "articles_fts_idx"
  ON "articles"
  USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(excerpt, '') || ' ' || coalesce(body, '')));

-- GIN index on tags arrays
CREATE INDEX IF NOT EXISTS "articles_tags_idx" ON "articles" USING gin("tags");

-- ivfflat index for vector similarity search
CREATE INDEX IF NOT EXISTS "articles_embedding_idx"
  ON "articles" USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 100);

-- Additional btree indexes
CREATE INDEX IF NOT EXISTS "articles_status_idx" ON "articles" ("status");
CREATE INDEX IF NOT EXISTS "articles_created_at_idx" ON "articles" ("created_at" DESC);

-- Triggers for auto-updating updated_at (uses platform-level function)
CREATE TRIGGER articles_updated_at BEFORE UPDATE ON "articles"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
