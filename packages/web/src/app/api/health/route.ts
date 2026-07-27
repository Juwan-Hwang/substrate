/**
 * Health check endpoint — liveness probe for orchestrators & CDNs.
 *
 * Returns a 200 with a JSON body so Kubernetes, Cloudflare, or load
 * balancers can confirm the runtime is responsive. Marked force-dynamic
 * so the timestamp is never cached.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ status: 'ok', timestamp: Date.now() });
}
