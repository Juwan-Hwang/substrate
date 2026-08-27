/**
 * @substrate-platform/db — Generic Transaction Manager.
 *
 * Provides re-entrant, context-propagating transaction management using
 * Node.js `AsyncLocalStorage`. Enables nested operations to participate in
 * the ambient outer transaction without deadlocking or splitting atomicity.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

export interface GenericTransactionManager<Client = unknown> {
  /**
   * Execute callback within a database transaction.
   * If already inside an active transaction, participates in the outer transaction (re-entrant).
   */
  transaction<T>(callback: (client: Client) => Promise<T>): Promise<T>;
}

export interface PoolLike<Client> {
  connect(): Promise<Client & { release(): void }>;
}

export interface ClientLike {
  query(sql: string, params?: unknown[]): Promise<unknown>;
}

/**
 * AsyncLocalStorage holding the active transactional client for the current async call-chain.
 */
export const transactionContext = new AsyncLocalStorage<unknown>();

/**
 * Get the active transaction client for the current async execution context, if one exists.
 */
export function getTransactionClient<T = unknown>(): T | undefined {
  return transactionContext.getStore() as T | undefined;
}

/**
 * Create a transaction manager for a PostgreSQL client pool.
 */
export function createPgTransactionManager<Client extends ClientLike & { release(): void }>(
  pool: PoolLike<Client>,
): GenericTransactionManager<Client> {
  return {
    async transaction<T>(callback: (client: Client) => Promise<T>): Promise<T> {
      const existingClient = transactionContext.getStore() as Client | undefined;
      if (existingClient) {
        // Re-entrant: participate in outer transaction
        return callback(existingClient);
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await transactionContext.run(client, () => callback(client));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // Swallow rollback error to surface original failure
        }
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

/**
 * Create a no-op transaction manager (useful for in-memory stores and testing).
 */
export function createNoopTransactionManager<Client = void>(): GenericTransactionManager<Client> {
  return {
    async transaction<T>(callback: (client: Client) => Promise<T>): Promise<T> {
      return callback(undefined as unknown as Client);
    },
  };
}
