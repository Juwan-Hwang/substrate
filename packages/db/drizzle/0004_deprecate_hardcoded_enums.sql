-- Migration 0004: Deprecate Hardcoded Enums
--
-- The content_status enum ('draft', 'published', 'archived') was used by
-- example tables (articles) in pre-v1.3 code. v1.3 establishes that the
-- platform must NOT reference application-specific lifecycle values.
--
-- The enum is KEPT for backward compatibility with example tables,
-- but platform code MUST NOT reference it. The Boundary CI gate (13)
-- enforces this at the import-graph level.
--
-- This migration is additive and idempotent (IF NOT EXISTS).
-- It always runs -- schema migrations are version-baked (14.3 correction 5).
--
-- See: architecture-contract-v1.3.md 14.3 Migration 0004.

-- No schema changes needed. The content_status enum already exists
-- from migration 0000. This migration serves as a version marker:
-- the platform acknowledges the enum is deprecated for platform use.

-- Platform tables (entities, associations, snapshots, cas_objects)
-- use TEXT columns for lifecycle_state and visibility, NOT enums.
-- This is intentional: the platform must not hardcode lifecycle/visibility
-- values (I8). The application defines its own enum types in its own
-- schema if needed.

SELECT 1;
