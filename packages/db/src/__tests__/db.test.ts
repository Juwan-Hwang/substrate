/**
 * Unit tests for @substrate/db — platform table Zod schemas.
 * No database connection required.
 */
import { describe, expect, it } from 'vitest';
import { insertEntitySchema, selectEntitySchema } from '../schemas';

// ── insertEntitySchema ──────────────────────────────────────────────

describe('insertEntitySchema', () => {
  const validInput = {
    type: 'article',
    lifecycleState: 'draft',
    visibility: 'private',
  };

  it('validates a correct entity input', () => {
    const result = insertEntitySchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('article');
      expect(result.data.lifecycleState).toBe('draft');
      expect(result.data.visibility).toBe('private');
    }
  });

  it('accepts optional ownerId', () => {
    const result = insertEntitySchema.safeParse({
      ...validInput,
      ownerId: 'user-123',
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional deletedAt', () => {
    const result = insertEntitySchema.safeParse({
      ...validInput,
      deletedAt: new Date(),
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing required type', () => {
    const { type: _type, ...rest } = validInput;
    const result = insertEntitySchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects missing lifecycleState', () => {
    const { lifecycleState: _ls, ...rest } = validInput;
    const result = insertEntitySchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects missing visibility', () => {
    const { visibility: _v, ...rest } = validInput;
    const result = insertEntitySchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('does not accept the omitted id/createdAt/updatedAt fields', () => {
    const result = insertEntitySchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('id');
      expect(result.data).not.toHaveProperty('createdAt');
      expect(result.data).not.toHaveProperty('updatedAt');
    }
  });
});

// ── selectEntitySchema ───────────────────────────────────────────────

describe('selectEntitySchema', () => {
  it('validates a full entity record', () => {
    const result = selectEntitySchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      type: 'article',
      lifecycleState: 'published',
      visibility: 'public',
      ownerId: 'user-123',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts null ownerId and deletedAt', () => {
    const result = selectEntitySchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      type: 'article',
      lifecycleState: 'draft',
      visibility: 'private',
      ownerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    expect(result.success).toBe(true);
  });
});
