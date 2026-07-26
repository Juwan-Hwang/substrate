/**
 * Top navigation — a minimal, server-rendered bar linking the three
 * primary surfaces (home / search / chat / ingest).
 */
import Link from 'next/link';

const links: { href: string; label: string }[] = [
  { href: '/', label: 'Overview' },
  { href: '/search', label: 'Search' },
  { href: '/chat', label: 'RAG Chat' },
  { href: '/ingest', label: 'Ingest' },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--color-border-subtle)] bg-[color-mix(in_srgb,var(--color-bg)_82%,transparent)] backdrop-blur-xl">
      <nav className="container-page flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span
            className="grid h-7 w-7 place-items-center rounded-lg text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-2))' }}
            aria-hidden
          >
            A
          </span>
          <span>AI Archive</span>
        </Link>
        <ul className="flex items-center gap-1">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
