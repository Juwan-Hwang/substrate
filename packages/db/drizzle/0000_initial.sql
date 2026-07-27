-- Drizzle migration: initial schema
-- Generated from packages/db/src/index.ts
-- Run with: bun --filter @substrate/db migrate

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Enums
DO $$ BEGIN
  CREATE TYPE "subsystem" AS ENUM('lattice', 'crucible', 'archive');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "content_status" AS ENUM('draft', 'published', 'archived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Tables
CREATE TABLE IF NOT EXISTS "articles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" text NOT NULL UNIQUE,
  "title" text NOT NULL,
  "excerpt" text,
  "body" text NOT NULL,
  "tags" text[] DEFAULT '{}'::text[],
  "status" "content_status" DEFAULT 'draft',
  "embedding" vector(1536),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "url" text,
  "repo" text,
  "status" text DEFAULT 'active',
  "tags" text[] DEFAULT '{}'::text[],
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" text NOT NULL UNIQUE,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "tags" text[] DEFAULT '{}'::text[],
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "experiments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "subsystem" "subsystem" NOT NULL,
  "parameters" jsonb NOT NULL,
  "result" jsonb,
  "duration_ms" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "graph_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "subsystem" "subsystem" DEFAULT 'lattice',
  "snapshot" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS "articles_status_idx" ON "articles" ("status");
CREATE INDEX IF NOT EXISTS "articles_created_at_idx" ON "articles" ("created_at" DESC);

CREATE INDEX IF NOT EXISTS "articles_fts_idx"
  ON "articles"
  USING gin(
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'C')
  );

CREATE INDEX IF NOT EXISTS "articles_tags_idx" ON "articles" USING gin("tags");

CREATE INDEX IF NOT EXISTS "articles_embedding_idx"
  ON "articles" USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS "projects_status_idx" ON "projects" ("status");
CREATE INDEX IF NOT EXISTS "projects_tags_idx" ON "projects" USING gin("tags");

CREATE INDEX IF NOT EXISTS "experiments_subsystem_idx" ON "experiments" ("subsystem");
CREATE INDEX IF NOT EXISTS "experiments_created_at_idx" ON "experiments" ("created_at" DESC);

CREATE INDEX IF NOT EXISTS "graph_snapshots_subsystem_idx" ON "graph_snapshots" ("subsystem");

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER articles_updated_at BEFORE UPDATE ON "articles"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER projects_updated_at BEFORE UPDATE ON "projects"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER notes_updated_at BEFORE UPDATE ON "notes"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
