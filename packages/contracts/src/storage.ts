/**
 * @substrate/contracts/storage — Storage Abstraction Interfaces.
 *
 * The platform provides three storage interfaces:
 *
 *   1. `SnapshotStore` — immutable point-in-time state snapshots.
 *      No update, no delete — append-only.
 *
 *   2. `ContentAddressedStore` — content-addressed blobs.
 *      No update, no delete — content-addressed = immutable.
 *
 *   3. `AssetStore` — binary asset storage (media, attachments).
 *      Supports variants and representations.
 *
 * Default implementations: PostgreSQL, R2, In-memory (test).
 * The application selects the adapter via configuration; the platform does not
 * hardcode a backend.
 *
 * See: architecture-contract-v1.3.md §8.
 */

// ── Shared Types ───────────────────────────────────────────────────

/**
 * A content hash — the address of a CAS object.
 * Format depends on the backend (e.g. SHA-256, BLAKE3).
 */
export type Hash = string;

/**
 * Serialized application state — the content of a Snapshot.
 * When CAS is disabled, this is stored directly in the `snapshots` table.
 * When CAS is enabled, this is broken into CAS objects via a Manifest.
 */
export type SerializedState = string | Uint8Array;

/**
 * Metadata for an asset (content type, dimensions, etc.).
 * Application-defined — the platform treats it as opaque.
 */
export interface AssetMetadata {
  readonly contentType: string;
  readonly size: number;
  readonly [key: string]: unknown;
}

/**
 * An asset — a binary blob with metadata and representations.
 */
export interface Asset {
  readonly id: string;
  readonly originalHash: Hash;
  readonly metadata: AssetMetadata;
  readonly createdAt: number; // epoch ms
}

/**
 * A derived representation of an asset (thumbnail, optimized variant, etc.).
 */
export interface Representation {
  readonly assetId: string;
  readonly variant: string;
  readonly hash: Hash;
  readonly accessLevel: string;
  readonly createdAt: number; // epoch ms
}

// ── SnapshotStore ───────────────────────────────────────────────────

/**
 * Immutable snapshot store — point-in-time state copies.
 *
 * No update, no delete. Once written, a snapshot is permanent.
 * This enforces historical immutability (I7).
 *
 * When CAS is disabled: `create()` persists the full serialized state
 * directly (e.g. in PostgreSQL bytea or R2 object).
 * When CAS is enabled: `create()` persists a Manifest hash that
 * references CAS objects for dedup/incremental.
 */
export interface SnapshotStore {
  /**
   * Create a new immutable snapshot.
   * Returns the stored snapshot with its assigned ID.
   */
  create(
    state: SerializedState,
    metadata?: Readonly<Record<string, unknown>>,
  ): Promise<StoredSnapshot>;

  /**
   * Retrieve a snapshot by ID.
   * Returns `null` if not found.
   */
  retrieve(id: string): Promise<StoredSnapshot | null>;

  /**
   * List snapshots, optionally filtered.
   * Results are ordered by creation time descending.
   */
  list(filter?: SnapshotListFilter): Promise<StoredSnapshot[]>;

  // NO update(). NO delete(). Immutable.
}

/**
 * A stored snapshot — the platform's persisted record.
 */
export interface StoredSnapshot {
  readonly id: string;
  readonly stateRef: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: number; // epoch ms
}

/**
 * Filter for listing snapshots.
 */
export interface SnapshotListFilter {
  /** Only snapshots created after this date. */
  readonly since?: Date;
  /** Maximum number of results. */
  readonly limit?: number;
}

// ── ContentAddressedStore ──────────────────────────────────────────

/**
 * Content-addressed storage — immutable blobs.
 *
 * No update, no delete. Content-addressed = immutable.
 * The same content always produces the same hash, so writes are
 * idempotent (re-writing existing content is a no-op).
 *
 * Orphaned CAS objects are GC-safe (§4.4, §7.3).
 */
export interface ContentAddressedStore {
  /**
   * Store content. Returns the content hash.
   * Idempotent: storing the same content twice returns the same hash.
   */
  store(content: Uint8Array | string): Promise<Hash>;

  /**
   * Retrieve content by hash.
   * Returns `null` if not found.
   */
  retrieve(hash: Hash): Promise<Uint8Array | string | null>;

  /**
   * Check if content exists by hash.
   */
  exists(hash: Hash): Promise<boolean>;

  // NO update(). NO delete(). Immutable.
}

// ── AssetStore ─────────────────────────────────────────────────────

/**
 * Binary asset storage — media, attachments.
 *
 * Supports:
 *   - Storing original content
 *   - Storing derived representations (thumbnails, optimized variants)
 *   - Retrieving originals and representations
 *   - Accessing metadata
 *
 * Access levels are application-defined ('public', 'restricted', etc.).
 * The platform does not interpret access levels — it only stores them.
 */
export interface AssetStore {
  /**
   * Store original asset content.
   * Returns the created asset record.
   */
  storeOriginal(content: Uint8Array, metadata?: AssetMetadata): Promise<Asset>;

  /**
   * Store a derived representation of an asset.
   * (e.g. a thumbnail, a WebP variant, a compressed version)
   */
  storeRepresentation(
    assetId: string,
    variant: string,
    content: Uint8Array,
    accessLevel: string,
  ): Promise<Representation>;

  /**
   * Retrieve the original content of an asset.
   * Returns `null` if not found.
   */
  retrieveOriginal(assetId: string): Promise<Uint8Array | null>;

  /**
   * Retrieve a specific representation of an asset.
   * Returns `null` if not found.
   */
  retrieveRepresentation(assetId: string, variant: string): Promise<Uint8Array | null>;

  /**
   * Get asset metadata.
   * Returns `null` if not found.
   */
  getAssetMetadata(assetId: string): Promise<AssetMetadata | null>;
}

// ── StoreAdapter ───────────────────────────────────────────────────

/**
 * Bundle of storage adapters selected at application startup.
 * The application configures which adapters to use (PostgreSQL, R2, in-memory).
 */
export interface StoreAdapter {
  readonly snapshots: SnapshotStore;
  readonly cas?: ContentAddressedStore;
  readonly assets?: AssetStore;
}
