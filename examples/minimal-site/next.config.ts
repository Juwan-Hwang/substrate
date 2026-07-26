/**
 * Next.js 16 configuration for the minimal-site example.
 *
 * - reactCompiler: opt-in to the React Compiler for automatic memoisation.
 * - cacheComponents: Partial Prerendering (formerly experimental.ppr) —
 *   static shells with streamed dynamic holes, opted-in per route.
 * - experimental.viewTransition: enable the View Transitions API for routing.
 * - transpilePackages: consume the raw TypeScript source of the three
 *   workspace packages directly, with no separate build step required.
 *
 * Note: lightningcss is consumed by @tailwindcss/postcss (see
 * postcss.config.mjs) rather than as a Turbopack loader rule, because
 * `lightningcss` is a CSS transformer library, not a webpack-style loader.
 */
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true,
  cacheComponents: true,
  experimental: {
    viewTransition: true,
    useTypeScriptCli: true,
  },
  transpilePackages: ['@substrate/ui', '@substrate/content', '@substrate/config'],
};

export default nextConfig;
