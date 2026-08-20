/**
 * drizzle-zod — auto-generated Zod schemas from Drizzle table definitions.
 *
 * These schemas are used for:
 *  - Input validation in Server Actions and tRPC procedures
 *  - Type-safe form validation with @hookform/resolvers/zod
 *  - API request/response validation
 *
 * Application-specific table schemas are defined by the application,
 * not by the platform.
 *
 * ```ts
 * import { insertEntitySchema, selectEntitySchema } from '@substrate/db';
 * const parsed = insertEntitySchema.parse(formData);
 * ```
 */
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { casObjects, entities, entityIndexes, snapshots } from './tables';

// ── Insert schemas (for creating new records) ───────────────────────

export const insertEntitySchema: z.ZodType = createInsertSchema(entities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSnapshotSchema: z.ZodType = createInsertSchema(snapshots).omit({
  id: true,
  createdAt: true,
});

export const insertCasObjectSchema: z.ZodType = createInsertSchema(casObjects);

export const insertEntityIndexSchema: z.ZodType = createInsertSchema(entityIndexes);

// ── Select schemas (for API responses) ──────────────────────────────

export const selectEntitySchema: z.ZodType = createSelectSchema(entities);

export const selectSnapshotSchema: z.ZodType = createSelectSchema(snapshots);

export const selectCasObjectSchema: z.ZodType = createSelectSchema(casObjects);

export const selectEntityIndexSchema: z.ZodType = createSelectSchema(entityIndexes);

// ── Update schemas (for partial updates) ────────────────────────────

export const updateEntitySchema = z.object({
  type: z.string().optional(),
  lifecycleState: z.string().optional(),
  visibility: z.string().optional(),
  ownerId: z.string().nullable().optional(),
  deletedAt: z.date().nullable().optional(),
});

// ── Query schemas (for list endpoints) ──────────────────────────────

export const listEntitiesQuerySchema = z.object({
  type: z.string().optional(),
  lifecycleState: z.string().optional(),
  visibility: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});
