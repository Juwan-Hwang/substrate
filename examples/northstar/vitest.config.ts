/**
 * Vitest configuration for the Northstar example site.
 *
 * Maps the `@substrate-platform/*` workspace packages to their TypeScript source so
 * unit tests can import platform primitives without a build step.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));
const workspace = (relative: string): string => path.resolve(here, relative);

export default defineConfig({
  resolve: {
    alias: {
      '@substrate-platform/site': workspace('../../packages/site/src'),
      '@substrate-platform/ui': workspace('../../packages/ui/src'),
      '@substrate-platform/content': workspace('../../packages/content/src'),
      '@substrate-platform/config': workspace('../../packages/config/src'),
      '@substrate-platform/contracts': workspace('../../packages/contracts/src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
