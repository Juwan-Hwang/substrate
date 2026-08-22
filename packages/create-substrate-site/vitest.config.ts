/**
 * Vitest configuration for the create-substrate-site CLI package.
 *
 * Tests only src/ — the templates/ directory contains the embedded
 * northstar template whose tests are meant to run in the generated
 * site context, not inside the CLI package.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['templates/**', 'dist/**', 'node_modules/**'],
  },
});
