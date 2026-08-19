/**
 * Next.js 16 configuration for the Northstar example site.
 *
 * Northstar is a fully independent consumer of the Substrate platform.
 * It consumes @substrate/site (the platform shell package) in addition to
 * the UI and content packages, proving that a third-party site can be
 * built entirely on platform primitives.
 *
 * - reactCompiler: opt-in to the React Compiler for automatic memoisation.
 * - cacheComponents: Partial Prerendering — static shells with streamed holes.
 * - experimental.viewTransition: enable the View Transitions API for routing.
 * - transpilePackages: consume the raw TypeScript source of the five
 *   workspace packages directly, with no separate build step required.
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
    '@substrate/site',
    '@substrate/ui',
    '@substrate/content',
    '@substrate/config',
    '@substrate/contracts',
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
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
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
