/**
 * SearchBox — client-side instant search via Orama.
 *
 * Indexed at build time from Velite collections.
 * Zero server round-trips — the index is embedded in the page.
 */
'use client';

import { createSearchIndex, type SearchableDoc } from '@substrate/content/search';
import { useEffect, useRef, useState } from 'react';

export function SearchBox({ docs }: { docs: SearchableDoc[] }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchableDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const indexRef = useRef<Awaited<ReturnType<typeof createSearchIndex>> | null>(null);

  // Build the Orama index once on mount.
  useEffect(() => {
    if (docs.length === 0) return;
    createSearchIndex(docs).then((idx) => {
      indexRef.current = idx;
    });
  }, [docs]);

  // Debounced search.
  useEffect(() => {
    if (!query.trim() || !indexRef.current) {
      setResults([]);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      if (!indexRef.current) return;
      const res = await indexRef.current.search(query, 8);
      const hits = res.hits.map((h) => h.document as unknown as SearchableDoc);
      setResults(hits);
      setLoading(false);
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="w-full">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search articles, projects, notes…"
        className="w-full rounded-lg border border-border-primary bg-bg-secondary px-4 py-3 text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
      />

      {loading && <p className="mt-2 text-sm text-text-tertiary">Searching…</p>}

      {results.length > 0 && (
        <ul className="mt-4 space-y-2">
          {results.map((doc) => (
            <li key={doc.id}>
              <a
                href={`/archive/${doc.slug}`}
                className="block rounded-lg border border-border-primary bg-bg-secondary p-4 transition-colors hover:border-accent-primary"
              >
                <div className="flex items-center gap-2">
                  <span className="aevum-badge aevum-badge-accent text-xs">{doc.type}</span>
                  <h3 className="font-semibold text-text-primary">{doc.title}</h3>
                </div>
                {doc.excerpt && (
                  <p className="mt-1 text-sm text-text-secondary line-clamp-2">{doc.excerpt}</p>
                )}
                {doc.tags.length > 0 && (
                  <div className="mt-2 flex gap-1">
                    {doc.tags.map((tag) => (
                      <span key={tag} className="text-xs text-text-tertiary">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </a>
            </li>
          ))}
        </ul>
      )}

      {query.trim() && !loading && results.length === 0 && indexRef.current && (
        <p className="mt-4 text-sm text-text-tertiary">No results for "{query}".</p>
      )}
    </div>
  );
}
