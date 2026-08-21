/**
 * Unit tests for @substrate/contracts/effect — Effect service composition.
 */
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { ConsoleLoggerLayer, runEffect } from '../effect';

describe('effect subpath', () => {
  it('runEffect executes a simple Effect program', async () => {
    const program = Effect.succeed(42);
    const result = await runEffect(program, { logger: ConsoleLoggerLayer });
    expect(result).toBe(42);
  });
});
