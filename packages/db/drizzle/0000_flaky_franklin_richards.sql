-- Migration 0000: PostgreSQL Extensions + Platform Extensions
--
-- Only PostgreSQL extensions that the platform requires.
-- Application-specific tables are defined in application migrations.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "vector";--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "pg_trgm";--> statement-breakpoint
