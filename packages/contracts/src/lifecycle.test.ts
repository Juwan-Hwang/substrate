/**
 * lifecycle.test.ts — I8, I19: Platform never hardcodes lifecycle states.
 *
 * Tests:
 *  - Legal transition → resolved to target state
 *  - Illegal transition (wrong from-state) → null
 *  - Undefined event → null
 *  - initial state is in states
 *  - Empty states → invalid
 *  - Duplicate states → invalid
 *  - Transition with unknown from/to → invalid
 */
import { describe, expect, it } from 'vitest';
import {
  availableTransitions,
  type LifecycleDefinition,
  resolveTransition,
  validateLifecycle,
} from './lifecycle';

// ── Fixture ──────────────────────────────────────────────────────

const draftPublish: LifecycleDefinition<'draft' | 'published', 'publish' | 'unpublish'> = {
  initial: 'draft',
  states: ['draft', 'published'],
  transitions: {
    publish: ['draft', 'published'],
    unpublish: ['published', 'draft'],
  },
};

// ── resolveTransition ───────────────────────────────────────────

describe('resolveTransition', () => {
  it('resolves a legal transition to the target state', () => {
    expect(resolveTransition(draftPublish, 'draft', 'publish')).toBe('published');
  });

  it('returns null for an illegal transition (wrong from-state)', () => {
    expect(resolveTransition(draftPublish, 'published', 'publish')).toBeNull();
  });

  it('returns null for an undefined event', () => {
    // 'archive' is not a defined event — I19: archived is not a platform state
    expect(resolveTransition(draftPublish, 'draft', 'archive' as never)).toBeNull();
  });
});

// ── availableTransitions ───────────────────────────────────────

describe('availableTransitions', () => {
  it('lists events available from draft', () => {
    const events = availableTransitions(draftPublish, 'draft');
    expect(events).toEqual(['publish']);
  });

  it('lists events available from published', () => {
    const events = availableTransitions(draftPublish, 'published');
    expect(events).toEqual(['unpublish']);
  });

  it('returns empty for a state with no outgoing transitions', () => {
    const single: LifecycleDefinition<'start', never> = {
      initial: 'start',
      states: ['start'],
      transitions: {},
    };
    expect(availableTransitions(single, 'start')).toEqual([]);
  });
});

// ── validateLifecycle ──────────────────────────────────────────

describe('validateLifecycle', () => {
  it('validates a correct definition', () => {
    const result = validateLifecycle(draftPublish);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects an initial state not in states', () => {
    const result = validateLifecycle({
      initial: 'trashed',
      states: ['draft', 'published'],
      transitions: {},
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('trashed'))).toBe(true);
  });

  it('rejects empty states', () => {
    const result = validateLifecycle({
      initial: 'x',
      states: [],
      transitions: {},
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('at least one'))).toBe(true);
  });

  it('rejects duplicate states', () => {
    const result = validateLifecycle({
      initial: 'a',
      states: ['a', 'a'],
      transitions: {},
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('duplicate'))).toBe(true);
  });

  it('rejects transition with unknown from-state', () => {
    const result = validateLifecycle({
      initial: 'a',
      states: ['a'],
      transitions: { go: ['b', 'a'] },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('"b"'))).toBe(true);
  });

  it('rejects transition with unknown to-state', () => {
    const result = validateLifecycle({
      initial: 'a',
      states: ['a'],
      transitions: { go: ['a', 'z'] },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('"z"'))).toBe(true);
  });
});
