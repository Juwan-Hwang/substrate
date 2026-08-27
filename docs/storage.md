# Substrate Storage & History Architecture

> Substrate provides a content-addressed storage (CAS) layer and immutable point-in-time state snapshots for revision histories, recovery, and auditability.

---

## 1. Storage Primitives

1. **State Snapshot (`SnapshotStore`)**:
   - Represents an immutable, site-wide or revision-level snapshot of state at publish time.
   - Associated with metadata, timestamps, and CAS references (`stateRef`).

2. **Content-Addressed Storage (`ContentAddressedStore`)**:
   - Blobs (content bodies, media payloads, search indexes) are addressed by cryptographic hash (e.g. SHA-256).
   - Idempotent writes: writing the same payload twice returns the same hash and produces no duplicate storage.

---

## 2. Safe Garbage Collection

If a publication transaction fails after CAS pre-writing, the uncommitted CAS blobs are marked as orphan objects. Because CAS objects are immutable and content-addressed, orphans can be safely collected asynchronously without affecting live database rows:

```ts
export interface GarbageCollector {
  collectOrphans(thresholdMs: number): Promise<GarbageCollectionResult>;
}
```
