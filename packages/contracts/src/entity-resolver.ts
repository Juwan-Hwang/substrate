/**
 * @substrate/contracts/entity-resolver — Entity Resolution Primitive.
 *
 * The platform defines the EntityRef and EntitySnapshot interfaces.
 * The application implements the resolver that fetches entity metadata
 * from its typed tables (application-defined).
 *
 * Key design: EntityRef is polymorphic (type + id). Batch resolution
 * must match by (type, id), not id alone — different entity types may
 * have overlapping internal IDs.
 *
 * See: architecture-contract-v1.3.md §2.3.
 */

// ── EntityRef (shared with authorization.ts) ───────────────────────

/**
 * Polymorphic entity reference.
 *
 * `type` is application-defined: 'writing', 'project', etc.
 * `id` is an internal UUID.
 *
 * The platform NEVER interprets `type` — it only uses it as a
 * composite key for resolution.
 */
export interface EntityRef {
  readonly type: string;
  readonly id: string;
}

/**
 * Create an EntityRef. A convenience constructor that enforces
 * the (type, id) pair at the type level.
 */
export function entityRef(type: string, id: string): EntityRef {
  return { type, id } as const;
}

/**
 * Stable string key for an EntityRef, used as Map keys.
 * Format: `${type}:${id}`
 */
export function entityRefKey(ref: EntityRef): string {
  return `${ref.type}:${ref.id}`;
}

// ── EntitySnapshot ─────────────────────────────────────────────────

/**
 * A point-in-time snapshot of an entity's platform-level metadata.
 *
 * This is what the platform uses for permission checks in Associations
 * and publish preview verification. It does NOT contain business
 * fields (title, body, etc.) — those live in typed tables.
 */
export interface EntitySnapshot {
  readonly ref: EntityRef;
  readonly lifecycleState: string;
  readonly visibility: string;
  readonly ownerId: string | null;
  readonly updatedAt: number; // epoch ms
  readonly deletedAt: number | null; // soft-delete timestamp
}

// ── EntityResolver ─────────────────────────────────────────────────

/**
 * Application-registered entity resolver.
 *
 * The platform calls this during:
 *  - Association permission checks (resolve both endpoints)
 *  - Publish preview verification (resolve affected entities)
 *  - Authorization revalidation (resolve current state after lock)
 *
 * The platform provides the calling interface; it does not know about
 * specific typed tables (application-defined).
 */
export interface EntityResolver {
  /**
   * Fetch a snapshot for a single entity.
   * Returns `null` if the entity does not exist or is purged.
   */
  resolve(ref: EntityRef): Promise<EntitySnapshot | null>;

  /**
   * Batch variant for association loading and bulk permission checks.
   *
   * MUST match by (type, id), not id alone. Different entity types
   * may have overlapping internal IDs.
   *
   * The returned Map is keyed by `entityRefKey(ref)`.
   */
  resolveBatch(refs: readonly EntityRef[]): Promise<Map<string, EntitySnapshot>>;
}
