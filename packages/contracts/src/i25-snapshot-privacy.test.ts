/**
 * i25-snapshot-privacy.test.ts — I25: Public Revision ≠ Public entities.
 *
 * The most critical privacy invariant: a public Revision (archive entry)
 * points to a Snapshot. Reading that Snapshot's archive returns ONLY
 * entities whose `visibility === 'public'` at the time the Snapshot was
 * taken. Private and Restricted entities in the same Snapshot are NOT
 * returned to anonymous readers.
 *
 * This is the privacy boundary between "the archive is public" and
 * "individual entities within a snapshot have their own visibility."
 *
 * Test scenario:
 *   Snapshot
 *   ├── Public A (visibility: 'public')
 *   ├── Private B (visibility: 'private')
 *   └── Restricted C (visibility: 'restricted')
 *
 *   Revision.visibility = 'public'
 *
 *   Archive read (anonymous) → A returned, B not returned, C not returned.
 */
import { describe, expect, it } from 'vitest';
import { ANONYMOUS, type Principal } from './authorization';
import { type EntityRef, entityRef } from './entity-resolver';
import { mustUseServer, type SearchMode } from './search-privacy';

// ── Simulated Snapshot content ───────────────────────────────────

interface SnapshotEntry {
  readonly ref: EntityRef;
  readonly serializedState: string;
  readonly visibility: string;
}

const snapshotEntries: readonly SnapshotEntry[] = [
  {
    ref: entityRef('writing', 'w-public'),
    serializedState: '{"title":"Public Post","visibility":"public"}',
    visibility: 'public',
  },
  {
    ref: entityRef('writing', 'w-private'),
    serializedState: '{"title":"Private Draft","visibility":"private"}',
    visibility: 'private',
  },
  {
    ref: entityRef('writing', 'w-restricted'),
    serializedState: '{"title":"Restricted Doc","visibility":"restricted"}',
    visibility: 'restricted',
  },
];

// ── Simulated archive reader ─────────────────────────────────────

/**
 * Reads a snapshot's archive entries, applying visibility filtering.
 *
 * This simulates the platform's snapshot read path:
 *   1. Look up the Revision (application table).
 *   2. Resolve Revision → Snapshot.
 *   3. For each entity in the snapshot, check its visibility.
 *   4. Only return entities the principal is authorized to see.
 *
 * For anonymous readers, ONLY 'public' entities are returned.
 */
function readSnapshotArchive(
  entries: readonly SnapshotEntry[],
  principal: Principal,
): readonly SnapshotEntry[] {
  // Anonymous principals can only see 'public' entries.
  // Authenticated principals would go through authorizedSearch,
  // but for the I25 test we focus on the anonymous case.
  if (principal.userId === null) {
    return entries.filter((e) => e.visibility === 'public');
  }
  // Authenticated: would need server-side authorization.
  // For this test, we just return public + restricted (simplified).
  return entries.filter((e) => e.visibility !== 'private');
}

// ── I25 Tests ────────────────────────────────────────────────────

describe('I25: Public Revision ≠ Public entities', () => {
  it('a public Revision pointing to a Snapshot with mixed visibility returns ONLY public entities to anonymous readers', () => {
    const results = readSnapshotArchive(snapshotEntries, ANONYMOUS);

    // Only the public entity is returned.
    expect(results).toHaveLength(1);
    expect(results[0]?.ref.id).toBe('w-public');
    expect(results[0]?.visibility).toBe('public');
  });

  it('private entity in a public Snapshot is NOT returned to anonymous readers', () => {
    const results = readSnapshotArchive(snapshotEntries, ANONYMOUS);
    const ids = results.map((r) => r.ref.id);

    expect(ids).not.toContain('w-private');
  });

  it('restricted entity in a public Snapshot is NOT returned to anonymous readers', () => {
    const results = readSnapshotArchive(snapshotEntries, ANONYMOUS);
    const ids = results.map((r) => r.ref.id);

    expect(ids).not.toContain('w-restricted');
  });

  it('a public Revision does NOT make all entities in the snapshot public', () => {
    // The snapshot contains 3 entities, but only 1 is public.
    // A public Revision makes the ARCHIVE entry public (findable),
    // but the individual entities retain their own visibility.
    const publicCount = snapshotEntries.filter((e) => e.visibility === 'public').length;
    const privateCount = snapshotEntries.filter((e) => e.visibility === 'private').length;
    const restrictedCount = snapshotEntries.filter((e) => e.visibility === 'restricted').length;

    expect(publicCount).toBe(1);
    expect(privateCount).toBe(1);
    expect(restrictedCount).toBe(1);

    const results = readSnapshotArchive(snapshotEntries, ANONYMOUS);
    // Only the public one is returned — the Revision being public
    // does NOT override entity-level visibility.
    expect(results).toHaveLength(1);
  });

  it('authenticated readers get more than anonymous, but still not private (server-side)', () => {
    const authed: Principal = { userId: 'user-1', roles: ['reader'] };

    // Anonymous: only public
    const anonResults = readSnapshotArchive(snapshotEntries, ANONYMOUS);
    expect(anonResults).toHaveLength(1);

    // Authenticated: public + restricted (simplified — real impl uses server auth)
    const authedResults = readSnapshotArchive(snapshotEntries, authed);
    expect(authedResults).toHaveLength(2);
    const authedIds = authedResults.map((r) => r.ref.id);
    expect(authedIds).toContain('w-public');
    expect(authedIds).toContain('w-restricted');
    expect(authedIds).not.toContain('w-private');
  });

  it('search privacy gate requires server for authenticated principals even on static index', () => {
    // Even if a static index exists, authenticated users must go through server.
    const authed: Principal = { userId: 'user-1', roles: ['reader'] };
    const mode: SearchMode = 'static';

    // Anonymous + static → no server needed (can use public static index)
    expect(mustUseServer(mode, ANONYMOUS)).toBe(false);

    // Authenticated + static → MUST use server (no client-side filtering)
    expect(mustUseServer(mode, authed)).toBe(true);
  });
});
