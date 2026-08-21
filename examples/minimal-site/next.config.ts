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
  transpilePackages: [
    '@substrate-platform/ui',
    '@substrate-platform/content',
    '@substrate-platform/config',
    '@substrate-platform/site',
  ],
  // ── Security headers ────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'strict-dynamic'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
              'upgrade-insecure-requests',
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
