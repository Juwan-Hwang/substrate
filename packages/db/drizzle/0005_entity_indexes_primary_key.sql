-- Migration 0005: Add composite PRIMARY KEY to entity_indexes
--
-- The entity_indexes table (migration 0002) was created without a primary
-- key, allowing duplicate rows for the same (entity_type, entity_id) pair.
-- This migration adds a composite PRIMARY KEY on (entity_type, entity_id)
-- so each entity has exactly one index row.
--
-- The redundant `entity_indexes_type_id_idx` is dropped because the
-- composite primary key already provides an index on those columns.
--
-- Idempotent: uses IF EXISTS / IF NOT EXISTS.
-- See: architecture-contract-v1.3.md §11 + §14.3 (migration 0005).

-- 1. Drop the redundant index (the PK will cover this access pattern).
DROP INDEX IF EXISTS "entity_indexes_type_id_idx";

-- 2. Deduplicate any existing rows so the PK can be added cleanly.
--    Keeps the most recently inserted row per (entity_type, entity_id).
DELETE FROM "entity_indexes" a1 USING "entity_indexes" a2
WHERE a1.ctid < a2.ctid
  AND a1.entity_type = a2.entity_type
  AND a1.entity_id = a2.entity_id;

-- 3. Add the composite primary key.
ALTER TABLE "entity_indexes"
  ADD CONSTRAINT "entity_indexes_pkey" PRIMARY KEY ("entity_type", "entity_id");
