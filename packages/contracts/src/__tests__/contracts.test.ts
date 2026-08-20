/**
 * Unit tests for @substrate/contracts — Result helpers.
 *
 * tRPC and Zustand tests are in separate files because those capabilities
 * are available via subpath exports, not the root entrypoint.
 */
import { describe, expect, it } from 'vitest';
import { err, ok } from '../index';

// ── Result helpers ────────────────────────────────────────────────────

describe('ok / err', () => {
  it('ok wraps a value', () => {
    const result = ok(42);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(42);
    }
  });

  it('err wraps an error', () => {
    const result = err('something broke');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('something broke');
    }
  });
});
