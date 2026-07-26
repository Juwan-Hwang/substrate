/**
 * `/search` — hybrid search surface.
 *
 * A client component that queries `/api/search` and renders results with
 * a provider badge, a normalised score bar, and a citation reference.
 * The server decides postgres-vs-orama; this UI is provider-agnostic.
 */
'use client';

import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import type { SearchResponse, SearchResult } from '@/lib/types';

type Status = 'idle' | 'loading' | 'error';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [provider, setProvider] = useState<SearchResponse['provider'] | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const runSearch = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    const term = query.trim();
    if (!term) return;
    setStatus('loading');
    setError(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(term)}&limit=10`);
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      const data = (await res.json()) as SearchResponse;
      setResults(data.results);
      setProvider(data.provider);
      setStatus('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  }, [query]);

  const maxScore = results.reduce((m, r) => Math.max(m, r.score), 0) || 1;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Hybrid Search</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Lexical FTS fused with semantic retrieval. Try: <em>vector</em>, <em>RRF</em>,{' '}
          <em>embeddings</em>.
        </p>
      </header>

      <form onSubmit={runSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the archive…"
          className="input"
          autoFocus
          aria-label="Search query"
        />
        <button type="submit" className="btn btn-primary" disabled={status === 'loading'}>
          {status === 'loading' ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error && (
        <p className="text-sm text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      )}

      {provider && (
        <p className="text-xs text-[var(--color-text-muted)]">
          <span className={`badge ${provider === 'postgres' ? 'badge-accent' : 'badge-cyan'}`}>
            {provider}
          </span>{' '}
          {results.length} result{results.length === 1 ? '' : 's'} for “{query.trim()}”
        </p>
      )}

      <ul className="space-y-3">
        {results.map((r) => {
          const pct = Math.round((r.score / maxScore) * 100);
          return (
            <li key={r.id} className="card card-tight space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="font-semibold leading-snug">{r.title}</h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">{r.excerpt}</p>
                </div>
                <span className={`badge shrink-0 ${r.source === 'postgres' ? 'badge-accent' : 'badge-cyan'}`}>
                  {r.source}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="score-bar flex-1">
                  <span style={{ width: `${pct}%` }} />
                </div>
                <span className="mono text-xs text-[var(--color-text-muted)]">
                  {r.score.toFixed(4)}
                </span>
                <span className="mono text-xs text-[var(--color-text-muted)]" title={r.citation.ref}>
                  ref:{r.citation.ref.slice(0, 12)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {provider && results.length === 0 && status === 'idle' && (
        <p className="text-sm text-[var(--color-text-muted)]">No matches found.</p>
      )}
    </div>
  );
}
