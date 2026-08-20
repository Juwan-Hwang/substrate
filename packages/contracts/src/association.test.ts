/**
 * association.test.ts — I9: Association is undirected, untyped (no kind).
 *
 * Tests:
 *  - A-B created → B-A query finds it (undirected)
 *  - Duplicate A-B → does not produce a second logical relation
 *  - Association has no kind/relationType/source/target fields
 */
import { describe, expect, it } from 'vitest';
import { association, isSameAssociation, type Association } from './association';
import { entityRef, type EntityRef } from './entity-resolver';

// ── Fixtures ─────────────────────────────────────────────────────

const writingRef: EntityRef = entityRef('writing', 'w-1');
const projectRef: EntityRef = entityRef('project', 'p-1');
const otherWritingRef: EntityRef = entityRef('writing', 'w-2');

// ── Association has no kind ──────────────────────────────────────

describe('Association (no kind/relationType)', () => {
  it('has only id, entityA, entityB, createdAt — no kind field', () => {
    const assoc = association('assoc-1', writingRef, projectRef);
    const keys = Object.keys(assoc).sort();
    expect(keys).toEqual(['createdAt', 'entityA', 'entityB', 'id']);
    expect(assoc).not.toHaveProperty('kind');
    expect(assoc).not.toHaveProperty('relationType');
    expect(assoc).not.toHaveProperty('source');
    expect(assoc).not.toHaveProperty('target');
  });
});

// ── Undirected: A-B == B-A ───────────────────────────────────────

describe('isSameAssociation (undirected)', () => {
  it('A-B created, B-A query finds it (same regardless of order)', () => {
    const ab = association('assoc-1', writingRef, projectRef);
    const ba = { entityA: projectRef, entityB: writingRef };

    expect(isSameAssociation(ab, ba)).toBe(true);
  });

  it('A-B is same as A-B', () => {
    const ab1 = { entityA: writingRef, entityB: projectRef };
    const ab2 = { entityA: writingRef, entityB: projectRef };
    expect(isSameAssociation(ab1, ab2)).toBe(true);
  });

  it('A-B is NOT same as A-C (different B)', () => {
    const ab = { entityA: writingRef, entityB: projectRef };
    const ac = { entityA: writingRef, entityB: otherWritingRef };
    expect(isSameAssociation(ab, ac)).toBe(false);
  });

  it('A-B is NOT same as C-B (different A)', () => {
    const ab = { entityA: writingRef, entityB: projectRef };
    const cb = { entityA: otherWritingRef, entityB: projectRef };
    expect(isSameAssociation(ab, cb)).toBe(false);
  });
});

// ── Deduplication: duplicate A-B does not create a second relation ─

describe('deduplication (duplicate A-B)', () => {
  it('storing the same pair twice is detected as the same association', () => {
    // Simulate a unique constraint check.
    const existing = new Set<string>();
    const assoc1 = association('assoc-1', writingRef, projectRef);

    // Build a normalized key (sorted pair) to simulate DB UNIQUE constraint.
    const key1 = [`${assoc1.entityA.type}:${assoc1.entityA.id}`, `${assoc1.entityB.type}:${assoc1.entityB.id}`]
      .sort()
      .join('|');
    existing.add(key1);

    // Attempt to store the same pair in reverse order.
    const assoc2 = { entityA: projectRef, entityB: writingRef };
    const key2 = [`${assoc2.entityA.type}:${assoc2.entityA.id}`, `${assoc2.entityB.type}:${assoc2.entityB.id}`]
      .sort()
      .join('|');

    // The normalized key is the same — so this is a duplicate.
    expect(existing.has(key2)).toBe(true);
    expect(isSameAssociation(assoc1, assoc2)).toBe(true);
  });

  it('a different pair is NOT a duplicate', () => {
    const existing = new Set<string>();
    const assoc1 = association('assoc-1', writingRef, projectRef);
    const key1 = [`${assoc1.entityA.type}:${assoc1.entityA.id}`, `${assoc1.entityB.type}:${assoc1.entityB.id}`]
      .sort()
      .join('|');
    existing.add(key1);

    const assoc2 = association('assoc-2', writingRef, otherWritingRef);
    const key2 = [`${assoc2.entityA.type}:${assoc2.entityA.id}`, `${assoc2.entityB.type}:${assoc2.entityB.id}`]
      .sort()
      .join('|');

    expect(existing.has(key2)).toBe(false);
    expect(isSameAssociation(assoc1, assoc2)).toBe(false);
  });
});

// ── association() constructor ────────────────────────────────────

describe('association() constructor', () => {
  it('creates an Association value object', () => {
    const a = association('id-1', writingRef, projectRef, 12345);
    expect(a.id).toBe('id-1');
    expect(a.entityA).toBe(writingRef);
    expect(a.entityB).toBe(projectRef);
    expect(a.createdAt).toBe(12345);
  });

  it('defaults createdAt to Date.now()', () => {
    const before = Date.now();
    const a = association('id-1', writingRef, projectRef);
    const after = Date.now();
    expect(a.createdAt).toBeGreaterThanOrEqual(before);
    expect(a.createdAt).toBeLessThanOrEqual(after);
  });
});
