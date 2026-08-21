-- Migration 0004: Platform Neutrality Marker
--
-- In pre-v1.3 code, the platform defined a `content_status` enum and
-- example content tables in the platform-level @substrate-platform/db package.
-- v1.3 established that the platform must NOT define application-specific
-- lifecycle values or content tables.
--
-- In this cleanup, the example tables and their enum were removed from
-- the platform package and relocated to the `ai-archive` example site
-- where they belong.
--
-- Platform tables (entities, associations, snapshots, cas_objects)
-- use TEXT columns for lifecycle_state and visibility, NOT enums.
-- This is intentional: the platform must not hardcode lifecycle/visibility
-- values (I8). The application defines its own enum types in its own
-- schema if needed.
--
-- See: architecture-contract-v1.3.md §14.3 (migration 0004).

SELECT 1;
