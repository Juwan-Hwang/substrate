/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  experimental: {
    ppr: 'incremental',
    viewTransition: true,
    cacheComponents: true,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // Turbopack config (Next 16.3)
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['lightningcss'],
      },
    },
  },
  transpilePackages: [
    '@substrate/ui',
    '@substrate/content',
    '@substrate/graphics',
    '@substrate/contracts',
    '@substrate/observability',
  ],
};

export default nextConfig;
