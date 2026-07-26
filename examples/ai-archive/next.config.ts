/**
 * Next.js configuration for the AI Archive example.
 *
 * - `reactCompiler`: compile-time memoisation for React 19.
 * - `ppr: 'incremental'`: Partial Prerendering — static shell with streaming holes.
 * - `transpilePackages`: the workspace packages ship as TypeScript source,
 *   so Next must transpile them before bundling.
 */
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    ppr: 'incremental',
  },
  transpilePackages: [
    '@substrate/db',
    '@substrate/ai',
    '@substrate/config',
    '@substrate/content',
  ],
};

export default nextConfig;
