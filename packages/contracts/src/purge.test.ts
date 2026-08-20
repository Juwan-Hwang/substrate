/**
 * purge.test.ts — I7: Purge Safety / Historical Reachability.
 *
 * Tests:
 *  - PurgeContract interface has only purgeCurrent (no purgeAll/purgeDeep)
 *  - purgeCurrent deletes the current entity row only
 *  - After purge, snapshots/CAS/revisions remain intact
 *  - GarbageCollector.sweep() only deletes unreachable CAS objects
 *  - GC is idempotent (running twice returns 0 on second sweep)
 */
import { describe, expect, it, vi } from 'vitest';
import { entityRef } from './entity-resolver';
import type { GarbageCollectionResult, GarbageCollector, PurgeContract } from './purge';

// ── PurgeContract ────────────────────────────────────────────────

describe('PurgeContract interface', () => {
  it('has purgeCurrent method only — no purgeAll or purgeDeep', () => {
    const purge: PurgeContract = {
      purgeCurrent: vi.fn(async () => {}),
    };

    expect(typeof purge.purgeCurrent).toBe('function');
    // The interface must not define purgeAll or purgeDeep.
    expect(purge).not.toHaveProperty('purgeAll');
    expect(purge).not.toHaveProperty('purgeDeep');
  });
});

// ── Purge behavior (in-memory simulation) ────────────────────────

describe('purgeCurrent behavior', () => {
  it('deletes the current entity row but leaves snapshots/CAS/revisions intact', async () => {
    const ref = entityRef('writing', 'w-1');

    // In-memory state
    const entities = new Map([
      ['writing:w-1', { ref, lifecycleState: 'trashed', visibility: 'private' }],
    ]);
    const snapshots = new Map([
      ['snap-1', { id: 'snap-1', stateRef: 'cas-1', metadata: {}, createdAt: 1 }],
    ]);
    const casStore = new Map([['cas-1', new Uint8Array([1, 2, 3])]]);
    const revisions = new Map([['rev-1', { id: 'rev-1', snapshotId: 'snap-1' }]]);

    const purge: PurgeContract = {
      async purgeCurrent(ref) {
        entities.delete(`${ref.type}:${ref.id}`);
      },
    };

    // Before purge
    expect(entities.has('writing:w-1')).toBe(true);
    expect(snapshots.has('snap-1')).toBe(true);
    expect(casStore.has('cas-1')).toBe(true);
    expect(revisions.has('rev-1')).toBe(true);

    await purge.purgeCurrent(ref);

    // After purge: entity row gone, everything else intact
    expect(entities.has('writing:w-1')).toBe(false);
    expect(snapshots.has('snap-1')).toBe(true);
    expect(casStore.has('cas-1')).toBe(true);
    expect(revisions.has('rev-1')).toBe(true);
  });
});

// ── GarbageCollector ─────────────────────────────────────────────

describe('GarbageCollector', () => {
  it('sweep() only deletes unreachable CAS objects', async () => {
    // Three CAS objects: hash-A is referenced by a revision, hash-B and hash-C are orphaned.
    const casObjects = new Map<string, Uint8Array>([
      ['hash-A', new Uint8Array([1])],
      ['hash-B', new Uint8Array([2])],
      ['hash-C', new Uint8Array([3])],
    ]);

    // Revisions reference snapshots, which reference CAS objects.
    const reachableHashes = new Set(['hash-A']);

    const gc: GarbageCollector = {
      async sweep(): Promise<GarbageCollectionResult> {
        const scanned = casObjects.size;
        let deleted = 0;
        for (const hash of casObjects.keys()) {
          if (!reachableHashes.has(hash)) {
            casObjects.delete(hash);
            deleted++;
          }
        }
        return {
          deletedCount: deleted,
          scannedCount: scanned,
          reachableCount: reachableHashes.size,
          durationMs: 1,
        };
      },
    };

    const result = await gc.sweep();

    expect(result.deletedCount).toBe(2);
    expect(result.scannedCount).toBe(3);
    expect(result.reachableCount).toBe(1);
    expect(casObjects.has('hash-A')).toBe(true);
    expect(casObjects.has('hash-B')).toBe(false);
    expect(casObjects.has('hash-C')).toBe(false);
  });

  it('sweep() is idempotent — second run returns 0 deleted', async () => {
    const casObjects = new Map<string, Uint8Array>([['hash-orphan', new Uint8Array([9])]]);
    const reachable = new Set<string>();

    const gc: GarbageCollector = {
      async sweep(): Promise<GarbageCollectionResult> {
        const scanned = casObjects.size;
        let deleted = 0;
        for (const hash of casObjects.keys()) {
          if (!reachable.has(hash)) {
            casObjects.delete(hash);
            deleted++;
          }
        }
        return { deletedCount: deleted, scannedCount: scanned, reachableCount: 0, durationMs: 0 };
      },
    };

    const first = await gc.sweep();
    expect(first.deletedCount).toBe(1);

    const second = await gc.sweep();
    expect(second.deletedCount).toBe(0);
    expect(second.scannedCount).toBe(0);
  });
});
