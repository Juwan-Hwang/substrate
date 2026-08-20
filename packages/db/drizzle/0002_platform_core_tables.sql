-- Migration 0002: Platform Core Tables
--
-- These tables are the platform's generic metadata authority.
-- Application typed tables store ONLY business/extension fields.
--
-- See: architecture-contract-v1.3.md §11 + §14.3

-- entities: Generic Entity Registry
-- Sole authority for lifecycle, visibility, owner, timestamps, deletion.
-- type / lifecycle_state / visibility are all app-defined TEXT —
-- the platform never hardcodes their values.
CREATE TABLE IF NOT EXISTS "entities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "type" text NOT NULL,
  "lifecycle_state" text NOT NULL,
  "visibility" text NOT NULL,
  "owner_id" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "entities_type_id_idx" ON "entities" ("type", "id");
CREATE INDEX IF NOT EXISTS "entities_lifecycle_idx" ON "entities" ("lifecycle_state");
CREATE INDEX IF NOT EXISTS "entities_visibility_idx" ON "entities" ("visibility");

-- associations: Undirected, untyped entity relations
-- NO kind column. NO relation_type column.
-- Association only expresses "A and B are related."
CREATE TABLE IF NOT EXISTS "associations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_a_type" text NOT NULL,
  "entity_a_id" text NOT NULL,
  "entity_b_type" text NOT NULL,
  "entity_b_id" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  UNIQUE("entity_a_type", "entity_a_id", "entity_b_type", "entity_b_id")
);

CREATE INDEX IF NOT EXISTS "associations_a_idx" ON "associations" ("entity_a_type", "entity_a_id");
CREATE INDEX IF NOT EXISTS "associations_b_idx" ON "associations" ("entity_b_type", "entity_b_id");

-- entity_indexes: Query optimization table
-- Separate from entities to allow index additions without altering main table.
CREATE TABLE IF NOT EXISTS "entity_indexes" (
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "lifecycle_state" text NOT NULL,
  "visibility" text NOT NULL
);

CREATE INDEX IF NOT EXISTS "entity_indexes_type_id_idx" ON "entity_indexes" ("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "entity_indexes_lifecycle_visibility_idx" ON "entity_indexes" ("lifecycle_state", "visibility");
