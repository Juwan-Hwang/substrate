/**
 * @substrate/db — Database access layer.
 *
 * Abstracts persistence for Archive content, Crucible experiment results,
 * and Lattice graph snapshots. Driver-agnostic: concrete implementations
 * are injected at the edge.
 */
import type { EntityId, Result } from '@substrate/contracts';

export type DatabaseConfig = {
  url: string;
  maxConnections?: number;
};

export interface Repository<T> {
  findById(id: EntityId): Promise<Result<T | null>>;
  findAll(): Promise<Result<T[]>>;
  insert(entity: T): Promise<Result<EntityId>>;
  update(id: EntityId, patch: Partial<T>): Promise<Result<void>>;
  delete(id: EntityId): Promise<Result<void>>;
}

export type { EntityId, Result } from '@substrate/contracts';
