/** Next.js config for graphics-lab example. */
const nextConfig = {
  reactCompiler: true,
  experimental: {
    ppr: 'incremental' as const,
    viewTransition: true,
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['lightningcss'],
      },
    },
  },
  transpilePackages: ['@substrate/graphics', '@substrate/config'],
};

export default nextConfig;
