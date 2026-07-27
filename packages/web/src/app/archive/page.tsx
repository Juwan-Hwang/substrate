import { SearchBox } from '../../components/search';
import { demoDocs } from '../../lib/articles';

export default function ArchivePage() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-24">
      <h1 className="text-4xl font-bold text-text-primary">Archive</h1>
      <p className="mt-4 text-text-secondary">
        Articles, projects, and notes. Search powered by Orama — instant, client-side, zero
        round-trips.
      </p>

      <div className="mt-8">
        <SearchBox docs={demoDocs} />
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        {demoDocs.map((doc) => (
          <a
            key={doc.id}
            href={`/archive/${doc.slug}`}
            className="aevum-glass-card group block p-6 transition-all hover:scale-[1.01]"
          >
            <div className="flex items-center gap-2">
              <span className="aevum-badge aevum-badge-accent text-xs uppercase">{doc.type}</span>
              {doc.tags.slice(0, 2).map((tag) => (
                <span key={tag} className="text-xs text-text-tertiary">
                  #{tag}
                </span>
              ))}
            </div>
            <h2 className="mt-3 text-lg font-semibold text-text-primary group-hover:text-accent-primary">
              {doc.title}
            </h2>
            {doc.excerpt && (
              <p className="mt-2 text-sm text-text-secondary line-clamp-2">{doc.excerpt}</p>
            )}
          </a>
        ))}
      </div>
    </main>
  );
}
