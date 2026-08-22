/**
 * Client-side search box powered by an in-browser Orama index.
 *
 * Receives the static document corpus as a prop, builds the index once on
 * mount, and queries it on every keystroke — zero network round-trips. When
 * the query is empty the full corpus is shown, so the control doubles as the
 * archive listing.
 */
'use client';

import { createSearchIndex, type SearchableDoc } from '@substrate-platform/content/search';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type SearchIndex = Awaited<ReturnType<typeof createSearchIndex>>;

type SearchBoxProps = {
  docs: SearchableDoc[];
};

export function SearchBox({ docs }: SearchBoxProps) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState<SearchIndex | null>(null);
  const [results, setResults] = useState<SearchableDoc[]>(docs);

  // Build the Orama index once when the corpus arrives.
  useEffect(() => {
    let active = true;
    createSearchIndex(docs).then((idx) => {
      if (active) setIndex(idx);
    });
    return () => {
      active = false;
    };
  }, [docs]);

  // Re-run the query whenever the index or the query changes.
  useEffect(() => {
    if (!index) return;
    const term = query.trim();
    if (term === '') {
      setResults(docs);
      return;
    }
    Promise.resolve(index.search(term)).then((res) => {
      setResults(res.hits.map((hit) => hit.document as SearchableDoc));
    });
  }, [index, query, docs]);

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search mission logs…"
        aria-label="Search mission logs"
        style={{
          width: '100%',
          padding: '0.75rem 1rem',
          background: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-primary)',
          borderRadius: '12px',
          fontSize: '0.95rem',
          outline: 'none',
        }}
      />

      <p className="tertiary" style={{ fontSize: '0.8125rem', margin: '0.75rem 0 1.5rem' }}>
        {results.length} result{results.length === 1 ? '' : 's'}
        {index === null ? ' · indexing…' : ''}
      </p>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.75rem' }}>
        {results.map((doc) => (
          <li key={doc.slug}>
            <Link href={`/logs/${doc.slug}`} style={{ display: 'block', padding: '0.25rem 0' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  alignItems: 'baseline',
                }}
              >
                <strong style={{ color: 'var(--text-primary)' }}>{doc.title}</strong>
                {doc.tags.length > 0 && (
                  <span className="tertiary" style={{ fontSize: '0.8125rem', flexShrink: 0 }}>
                    {doc.tags.join(' · ')}
                  </span>
                )}
              </div>
              <span className="muted" style={{ fontSize: '0.9rem' }}>
                {doc.excerpt}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
