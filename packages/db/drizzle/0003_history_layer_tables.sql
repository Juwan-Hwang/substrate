-- Migration 0003: History Layer Tables — Platform Primitives Only
--
-- snapshots + cas_objects ONLY.
-- NO revisions table — Revision is an application entity.
-- The application creates revisions in its own migration.
--
-- See: architecture-contract-v1.3.md §2.5 + §14.3

-- snapshots: Site-level State Snapshot
-- Immutable point-in-time copy of the entire application state at publish time.
-- state_ref: when cas=true → Manifest hash → CAS objects
--            when cas=false → direct serialized state blob identifier
-- NO entity_type, NO entity_id — one Snapshot = entire application state.
CREATE TABLE IF NOT EXISTS "snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "state_ref" text NOT NULL,
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- cas_objects: Content-Addressed Storage objects
-- Immutable, content-addressed blobs. Orphans are GC-safe.
CREATE TABLE IF NOT EXISTS "cas_objects" (
  "hash" text PRIMARY KEY,
  "size" integer NOT NULL,
  "storage_backend" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- *** NO revisions table in Substrate ***
-- *** Revision is an application entity (see §2.5 Layer Ownership) ***
-- *** The application creates revisions in its own migration ***
