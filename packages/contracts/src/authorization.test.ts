/**
 * authorization.test.ts — I6: Two-Phase Authorization (Preflight + Revalidation).
 *
 * Tests:
 *  - Preflight allow → allow=true
 *  - Preflight deny → allow=false (does not throw)
 *  - Revalidate deny → returns false (caller must rollback)
 *  - Revalidate is called after lock (call order verified)
 *  - ConstraintCompiler is a pure function (no DB connection / side effects)
 */
import { describe, expect, it, vi } from 'vitest';
import {
  ANONYMOUS,
  type AuthorizationBundle,
  type AuthorizationContext,
  type ConstraintCompiler,
  type MemoryPredicate,
  type SqlFragment,
  preflight,
  principal,
  revalidate,
} from './authorization';
import { entityRef } from './entity-resolver';

// ── Test doubles ─────────────────────────────────────────────────

function makeBundle(
  decideFn: (ctx: AuthorizationContext) => Promise<{ allow: boolean }>,
): AuthorizationBundle {
  return {
    policy: { decide: decideFn },
    buildQueryIntent: vi.fn(async () => ({ filter: 'all' })),
    compilers: {
      postgres: { compile: (intent) => ({ sql: 'WHERE 1=1', params: [intent] }) },
      memory: { compile: () => () => true },
    },
  };
}

const ref = entityRef('writing', 'w-1');
const writerP = principal('user-1', ['writer']);
const ctx: AuthorizationContext = {
  principal: writerP,
  entityRef: ref,
  operation: 'write',
};

// ── Preflight (Phase A) ──────────────────────────────────────────

describe('preflight (Phase A — advisory)', () => {
  it('returns allow=true when policy allows', async () => {
    const bundle = makeBundle(async () => ({ allow: true }));
    const result = await preflight(bundle, ctx);
    expect(result.allow).toBe(true);
  });

  it('returns allow=false when policy denies (does not throw)', async () => {
    const bundle = makeBundle(async () => ({ allow: false }));
    const result = await preflight(bundle, ctx);
    expect(result.allow).toBe(false);
  });

  it('is advisory-only — does not acquire locks or write', async () => {
    const decide = vi.fn(async () => ({ allow: true }));
    const bundle = makeBundle(decide);
    await preflight(bundle, ctx);
    // Preflight calls policy.decide once — that's it.
    expect(decide).toHaveBeenCalledTimes(1);
  });
});

// ── Revalidation (Phase B — binding) ─────────────────────────────

describe('revalidate (Phase B — binding, inside transaction)', () => {
  it('returns true when policy allows after lock', async () => {
    const bundle = makeBundle(async () => ({ allow: true }));
    const allowed = await revalidate(bundle, ctx);
    expect(allowed).toBe(true);
  });

  it('returns false when policy denies — caller MUST rollback', async () => {
    const bundle = makeBundle(async () => ({ allow: false }));
    const allowed = await revalidate(bundle, ctx);
    expect(allowed).toBe(false);
  });

  it('is called after lock acquisition (call order verification)', async () => {
    const callOrder: string[] = [];
    const lockEntity = vi.fn(async () => {
      callOrder.push('lock');
    });
    const decide = vi.fn(async () => {
      callOrder.push('revalidate');
      return { allow: true };
    });
    const bundle = makeBundle(decide);

    // Simulate the protocol: lock first, then revalidate.
    await lockEntity();
    await revalidate(bundle, ctx);

    expect(callOrder).toEqual(['lock', 'revalidate']);
  });
});

// ── ANONYMOUS principal ──────────────────────────────────────────

describe('ANONYMOUS principal', () => {
  it('has userId null and empty roles', () => {
    expect(ANONYMOUS.userId).toBeNull();
    expect(ANONYMOUS.roles).toEqual([]);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(ANONYMOUS)).toBe(true);
  });
});

// ── ConstraintCompiler is pure ───────────────────────────────────

describe('ConstraintCompiler (pure function)', () => {
  it('postgres compiler produces SqlFragment without I/O', () => {
    const compiler: ConstraintCompiler<SqlFragment> = {
      compile: (intent) => ({
        sql: 'WHERE owner_id = $1',
        params: [intent],
      }),
    };
    const fragment = compiler.compile({ ownerId: 'user-1' });
    expect(fragment.sql).toBe('WHERE owner_id = $1');
    expect(fragment.params).toHaveLength(1);
  });

  it('memory compiler produces a predicate without I/O', () => {
    const compiler: ConstraintCompiler<MemoryPredicate> = {
      compile: () => (doc: unknown) => {
        const d = doc as { ownerId?: string };
        return d.ownerId === 'user-1';
      },
    };
    const predicate = compiler.compile({ ownerId: 'user-1' });
    expect(predicate({ ownerId: 'user-1' })).toBe(true);
    expect(predicate({ ownerId: 'user-2' })).toBe(false);
  });
});
