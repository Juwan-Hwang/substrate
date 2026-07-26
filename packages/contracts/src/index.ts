/**
 * @substrate/contracts — Shared type contracts & schemas.
 *
 * The single source of truth for cross-package types, Zod schemas,
 * and API boundaries. Every other @substrate/* package may depend on this.
 */

export type Brand<T, B extends string> = T & { readonly __brand: B };

export type EntityId = Brand<string, 'EntityId'>;

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export type SubsystemName = 'Lattice' | 'Crucible' | 'Archive';

export type SiteConfig = {
  brand: 'Aevum';
  domain: string;
  subsystems: readonly SubsystemName[];
};
