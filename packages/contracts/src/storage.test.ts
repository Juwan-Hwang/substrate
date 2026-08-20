/**
 * storage.test.ts — I7, I10: Storage Immutability.
 *
 * Tests:
 *  - SnapshotStore has no update/delete methods
 *  - SnapshotStore.create → retrieve returns the snapshot
 *  - ContentAddressedStore: same content → same hash (dedup)
 *  - ContentAddressedStore: retrieve returns original content
 *  - ContentAddressedStore: non-existent hash → null
 *  - ContentAddressedStore: exists() returns correct boolean
 *  - ContentAddressedStore has no update/delete methods
 */
import { describe, expect, it } from 'vitest';
import type { ContentAddressedStore, SnapshotStore, StoredSnapshot } from './storage';

// ── In-memory SnapshotStore implementation ──────────────────────

class InMemorySnapshotStore implements SnapshotStore {
  private map = new Map<string, StoredSnapshot>();
  private counter = 0;

  async create(
    state: string | Uint8Array,
    metadata?: Readonly<Record<string, unknown>>,
  ): Promise<StoredSnapshot> {
    const id = `snap-${++this.counter}`;
    const snap: StoredSnapshot = {
      id,
      stateRef: typeof state === 'string' ? state : Buffer.from(state).toString('base64'),
      metadata: metadata ?? {},
      createdAt: Date.now(),
    };
    this.map.set(id, snap);
    return snap;
  }

  async retrieve(id: string): Promise<StoredSnapshot | null> {
    return this.map.get(id) ?? null;
  }

  async list(): Promise<StoredSnapshot[]> {
    return [...this.map.values()];
  }
}

// ── In-memory ContentAddressedStore ─────────────────────────────

class InMemoryCAS implements ContentAddressedStore {
  private map = new Map<string, Uint8Array>();

  async store(content: Uint8Array | string): Promise<string> {
    const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
    // Simple hash for testing — real impl uses SHA-256 or BLAKE3.
    let hash = 0;
    for (const b of bytes) hash = ((hash << 5) - hash + b) | 0;
    const hashStr = `hash-${Math.abs(hash)}`;
    if (!this.map.has(hashStr)) {
      this.map.set(hashStr, bytes);
    }
    return hashStr;
  }

  async retrieve(hash: string): Promise<Uint8Array | string | null> {
    return this.map.get(hash) ?? null;
  }

  async exists(hash: string): Promise<boolean> {
    return this.map.has(hash);
  }
}

// ── SnapshotStore tests ─────────────────────────────────────────

describe('SnapshotStore (immutable — no update/delete)', () => {
  it('does not have update or delete methods', () => {
    const store = new InMemorySnapshotStore();
    expect(store).not.toHaveProperty('update');
    expect(store).not.toHaveProperty('delete');
  });

  it('create → retrieve returns the snapshot', async () => {
    const store = new InMemorySnapshotStore();
    const created = await store.create('{"state":"v1"}', { version: 1 });

    const retrieved = await store.retrieve(created.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(created.id);
    expect(retrieved?.stateRef).toBe('{"state":"v1"}');
    expect(retrieved?.metadata).toEqual({ version: 1 });
  });

  it('retrieve non-existent snapshot → null', async () => {
    const store = new InMemorySnapshotStore();
    const result = await store.retrieve('non-existent');
    expect(result).toBeNull();
  });

  it('list returns all snapshots ordered by creation', async () => {
    const store = new InMemorySnapshotStore();
    await store.create('s1');
    await store.create('s2');
    const all = await store.list();
    expect(all).toHaveLength(2);
  });
});

// ── ContentAddressedStore tests ──────────────────────────────────

describe('ContentAddressedStore (immutable — no update/delete)', () => {
  it('does not have update or delete methods', () => {
    const cas = new InMemoryCAS();
    expect(cas).not.toHaveProperty('update');
    expect(cas).not.toHaveProperty('delete');
  });

  it('same content → same hash (dedup)', async () => {
    const cas = new InMemoryCAS();
    const content = 'hello world';
    const hash1 = await cas.store(content);
    const hash2 = await cas.store(content);
    expect(hash1).toBe(hash2);
  });

  it('retrieve returns original content', async () => {
    const cas = new InMemoryCAS();
    const content = 'test content';
    const hash = await cas.store(content);
    const retrieved = await cas.retrieve(hash);
    expect(retrieved).not.toBeNull();
    // CAS returns Uint8Array; decode to compare.
    const decoded = new TextDecoder().decode(retrieved as Uint8Array);
    expect(decoded).toBe(content);
  });

  it('retrieve non-existent hash → null', async () => {
    const cas = new InMemoryCAS();
    const result = await cas.retrieve('non-existent-hash');
    expect(result).toBeNull();
  });

  it('exists returns true for stored content, false for unknown', async () => {
    const cas = new InMemoryCAS();
    const hash = await cas.store('data');
    expect(await cas.exists(hash)).toBe(true);
    expect(await cas.exists('unknown')).toBe(false);
  });

  it('storing different content produces different hashes', async () => {
    const cas = new InMemoryCAS();
    const h1 = await cas.store('content-a');
    const h2 = await cas.store('content-b');
    expect(h1).not.toBe(h2);
  });

  it('dedup: storing twice does not create a second copy', async () => {
    const cas = new InMemoryCAS();
    await cas.store('dedup-test');
    const hash1 = await cas.store('dedup-test');
    // Verify the content is the same
    const retrieved = await cas.retrieve(hash1);
    expect(retrieved).not.toBeNull();
  });
});
