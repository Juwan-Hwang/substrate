/** Next.js config for realtime-room example. */
const nextConfig = {
  reactCompiler: true,
  experimental: {
    ppr: 'incremental' as const,
  },
  transpilePackages: ['@substrate/config'],
};

export default nextConfig;
