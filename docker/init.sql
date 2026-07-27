-- Initialize PostgreSQL extensions for the Aevum platform.
-- Mirrors the extensions declared in packages/db/drizzle/0000_initial.sql
-- and must exist before Drizzle migrations run.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "vector";      -- pgvector — semantic search embeddings
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- trigram fuzzy text search
