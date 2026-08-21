/**
 * Unit tests for @substrate-platform/contracts/trpc — tRPC appRouter.
 */
import { describe, expect, it } from 'vitest';
import { appRouter } from '../trpc';

// ── tRPC appRouter ────────────────────────────────────────────────────

describe('appRouter', () => {
  it('exposes a working health procedure', async () => {
    const caller = appRouter.createCaller({});
    const result = await caller.health();
    expect(result).toEqual({ status: 'ok' });
  });
});
