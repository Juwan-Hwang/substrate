export default function LatticeLoading() {
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-16">
      <div className="animate-pulse">
        <div className="mb-8 h-8 w-48 rounded-lg bg-text-primary/10" />
        <div className="aspect-video w-full rounded-xl bg-text-primary/5" />
      </div>
    </main>
  );
}
