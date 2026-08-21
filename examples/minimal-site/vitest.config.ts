/**
 * Vitest configuration for the minimal-site example.
 *
 * Maps the `@substrate-platform/*` workspace packages to their TypeScript source so
 * unit tests can import `@substrate-platform/content/search` without a build step.
 * String aliases perform prefix matching, so `@substrate-platform/content/search`
 * resolves to `packages/content/src/search.ts` automatically.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));
const workspace = (relative: string): string => path.resolve(here, relative);

export default defineConfig({
  resolve: {
    alias: {
      '@substrate-platform/ui': workspace('../../packages/ui/src'),
      '@substrate-platform/content': workspace('../../packages/content/src'),
      '@substrate-platform/config': workspace('../../packages/config/src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
