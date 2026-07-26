export default function ArchiveLoading() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-16">
      <div className="animate-pulse">
        <div className="mb-8 h-8 w-48 rounded-lg bg-text-primary/10" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="aevum-glass-card h-32 p-6">
              <div className="h-4 w-24 rounded bg-text-primary/10" />
              <div className="mt-3 h-3 w-40 rounded bg-text-primary/5" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
