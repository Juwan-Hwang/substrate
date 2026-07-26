/**
 * Root loading UI — shown instantly during streaming SSR.
 *
 * With Cache Components + Partial Prefetching (Next.js 16.3 Instant
 * Navigations), this shell is prefetched once per route and reused
 * across links, making navigation feel like a SPA.
 */
export default function Loading() {
  return (
    <div className="mx-auto min-h-screen max-w-5xl px-6 py-24" aria-busy="true">
      <div className="animate-pulse">
        <div className="mb-20">
          <div className="h-12 w-32 rounded-lg bg-text-primary/10" />
          <div className="mt-4 h-6 w-80 rounded-lg bg-text-primary/5" />
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="aevum-glass-card h-32 p-6">
              <div className="h-5 w-24 rounded bg-text-primary/10" />
              <div className="mt-3 h-4 w-40 rounded bg-text-primary/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
