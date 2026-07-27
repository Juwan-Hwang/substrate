export default function ArticleLoading() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-24">
      <div className="animate-pulse">
        <div className="mb-8 h-4 w-28 rounded bg-text-primary/10" />
        <div className="mb-8 h-10 w-3/4 rounded-lg bg-text-primary/10" />
        <div className="aevum-glass-card space-y-4 p-8">
          <div className="h-4 w-full rounded bg-text-primary/5" />
          <div className="h-4 w-full rounded bg-text-primary/5" />
          <div className="h-4 w-5/6 rounded bg-text-primary/5" />
          <div className="h-4 w-full rounded bg-text-primary/5" />
          <div className="h-4 w-2/3 rounded bg-text-primary/5" />
        </div>
      </div>
    </main>
  );
}
