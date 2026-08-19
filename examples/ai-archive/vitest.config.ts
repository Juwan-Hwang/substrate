/**
 * Vitest configuration.
 *
 * The workspace packages ship as TypeScript source, so we alias the
 * subpaths the tests exercise straight to their `.ts` files. This keeps
 * the tests hermetic — no build step required.
 */
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));
const pkg = (p: string) => fileURLToPath(new URL(`../../packages/${p}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': `${root}src`,
      '@substrate/content/search': `${pkg('content/src/search.ts')}`,
      '@substrate/content': `${pkg('content/src/index.ts')}`,
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
