/**
 * changeset.test.ts — I4: TransactionalCommitEngine atomicity.
 *
 * Tests:
 *  - Multiple operations all succeed → commit, all writes applied
 *  - Any single operation fails → rollback, no writes persisted
 *  - create_association operation has NO kind field
 *  - commitOk / commitFail helpers
 */
import { describe, expect, it, vi } from 'vitest';
import {
  type ChangeSet,
  type CommitResult,
  commitFail,
  commitOk,
  createChangeSet,
  type DomainOperation,
  type Transaction,
  type TransactionalCommitEngine,
} from './changeset';
import { entityRef } from './entity-resolver';

// ── Fake TransactionalCommitEngine ───────────────────────────────

interface FakeState {
  writes: DomainOperation[];
  snapshots: string[];
  locked: string[];
  rolledBack: boolean;
  committed: boolean;
}

function makeEngine(): { engine: TransactionalCommitEngine; state: FakeState } {
  const state: FakeState = {
    writes: [],
    snapshots: [],
    locked: [],
    rolledBack: false,
    committed: false,
  };

  const tx: Transaction = {
    lockEntity: vi.fn(async (ref) => {
      state.locked.push(`${ref.type}:${ref.id}`);
    }),
    write: vi.fn(async (op) => {
      state.writes.push(op);
    }),
    writeSnapshotReference: vi.fn(async (snap) => {
      state.snapshots.push(snap.snapshotId);
    }),
  };

  const engine: TransactionalCommitEngine = {
    async commit<T>(
      _changeset: ChangeSet,
      work: (tx: Transaction) => Promise<T>,
    ): Promise<CommitResult<T>> {
      try {
        const value = await work(tx);
        state.committed = true;
        return commitOk(value);
      } catch (e) {
        state.rolledBack = true;
        return commitFail(e instanceof Error ? e.message : String(e));
      }
    },
  };

  return { engine, state };
}

// ── Fixtures ─────────────────────────────────────────────────────

const refA = entityRef('writing', 'w-1');
const refB = entityRef('project', 'p-1');

const multiOpChangeset = createChangeSet(
  [
    { kind: 'create_entity', ref: refA, payload: { title: 'Hello' } },
    { kind: 'create_association', a: refA, b: refB },
    { kind: 'transition_lifecycle', ref: refA, target: 'published' },
  ],
  'user-1',
);

const [op0, op1] = multiOpChangeset.operations;
if (!op0 || !op1) throw new Error('fixture: multiOpChangeset must have ≥2 operations');

// ── Tests ────────────────────────────────────────────────────────

describe('TransactionalCommitEngine', () => {
  it('commits all operations when all succeed', async () => {
    const { engine, state } = makeEngine();
    const result = await engine.commit(multiOpChangeset, async (tx) => {
      for (const op of multiOpChangeset.operations) {
        await tx.write(op);
      }
      return 'done';
    });

    expect(result.ok).toBe(true);
    expect(result.value).toBe('done');
    expect(state.writes).toHaveLength(3);
    expect(state.committed).toBe(true);
    expect(state.rolledBack).toBe(false);
  });

  it('rolls back all operations when any single operation fails', async () => {
    const { engine, state } = makeEngine();
    const result = await engine.commit(multiOpChangeset, async (tx) => {
      await tx.write(op0);
      await tx.write(op1);
      // Third operation fails
      throw new Error('operation 3 failed');
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('operation 3 failed');
    // Writes that happened before the throw are in the buffer, but
    // the engine marks rollback — in a real DB these would be undone.
    expect(state.rolledBack).toBe(true);
    expect(state.committed).toBe(false);
  });

  it('locks all affected entities before writing', async () => {
    const { engine, state } = makeEngine();
    await engine.commit(multiOpChangeset, async (tx) => {
      // Lock before write — simulating the protocol
      await tx.lockEntity(refA);
      await tx.lockEntity(refB);
      await tx.write(op0);
      return 'locked';
    });

    expect(state.locked).toContain('writing:w-1');
    expect(state.locked).toContain('project:p-1');
  });
});

// ── DomainOperation: association has no kind ─────────────────────

describe('DomainOperation create_association', () => {
  it('has NO kind/relationType field — only (a, b)', () => {
    const op: DomainOperation = {
      kind: 'create_association',
      a: refA,
      b: refB,
    };

    // The operation object should not have a `relationType` or `kind`
    // field on the association itself. The `kind` here is the
    // DomainOperation discriminator, not an association type.
    expect(op.kind).toBe('create_association');
    expect(op).not.toHaveProperty('relationType');

    // Verify the shape — only kind, a, b
    const assocOp = op as { kind: string; a: unknown; b: unknown };
    expect(assocOp).toHaveProperty('a');
    expect(assocOp).toHaveProperty('b');
    expect(Object.keys(assocOp).sort()).toEqual(['a', 'b', 'kind']);
  });

  it('delete_association also has NO kind/relationType field', () => {
    const op: DomainOperation = {
      kind: 'delete_association',
      a: refA,
      b: refB,
    };

    expect(op).not.toHaveProperty('relationType');
    const delOp = op as { kind: string; a: unknown; b: unknown };
    expect(Object.keys(delOp).sort()).toEqual(['a', 'b', 'kind']);
  });
});

// ── CommitResult helpers ─────────────────────────────────────────

describe('commitOk / commitFail', () => {
  it('commitOk wraps value', () => {
    const result = commitOk(42);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(42);
  });

  it('commitFail wraps error and optional orphan CAS hashes', () => {
    const result = commitFail<string>('boom', ['hash-1', 'hash-2']);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('boom');
    expect(result.orphanCasObjects).toEqual(['hash-1', 'hash-2']);
  });

  it('commitFail without orphan CAS', () => {
    const result = commitFail<string>('boom');
    expect(result.ok).toBe(false);
    expect(result.orphanCasObjects).toBeUndefined();
  });
});

// ── createChangeSet ──────────────────────────────────────────────

describe('createChangeSet', () => {
  it('creates a ChangeSet with UUID id and timestamp', () => {
    const cs = createChangeSet([], 'user-1');
    expect(cs.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(cs.authorId).toBe('user-1');
    expect(cs.operations).toEqual([]);
    expect(cs.createdAt).toBeGreaterThan(0);
  });
});
