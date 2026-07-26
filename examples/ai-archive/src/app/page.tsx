/**
 * Home — AI Archive feature overview.
 *
 * A server component that surfaces the three pillars (hybrid search,
 * RAG Q&A, ingestion) and links into each surface. Capability badges
 * are read from env so the landing page always reflects the live mode.
 */
import Link from 'next/link';
import { hasAI, hasDatabase } from '@/lib/env';

type Feature = {
  href: string;
  title: string;
  description: string;
  badge: string;
  badgeClass: string;
};

const features: Feature[] = [
  {
    href: '/search',
    title: 'Hybrid Search',
    description:
      'Lexical FTS fused with pgvector semantic retrieval via Reciprocal Rank Fusion. Falls back to a client-side Orama index when no database is configured.',
    badge: 'FTS + pgvector',
    badgeClass: 'badge-accent',
  },
  {
    href: '/chat',
    title: 'RAG Q&A',
    description:
      'Ask a question, retrieve grounded context, and stream a cited answer. Drops into a demo mode with pre-built citations when no AI key is present.',
    badge: 'streaming + citations',
    badgeClass: 'badge-cyan',
  },
  {
    href: '/ingest',
    title: 'Ingestion Pipeline',
    description:
      'Submit articles, generate 1536-dim embeddings, and queue a reindex. Simulated end-to-end in demo mode so the flow is always explorable.',
    badge: 'embed + reindex',
    badgeClass: 'badge-accent',
  },
];

export default function HomePage() {
  const db = hasDatabase();
  const ai = hasAI();
  const mode = db && ai ? 'live' : db || ai ? 'partial' : 'demo';

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="space-y-5 pt-6">
        <span className="badge badge-accent">Next.js 16 · React 19 · PPR</span>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          AI-driven <span className="text-gradient">content retrieval</span>
          <br />
          &amp; grounded RAG answers.
        </h1>
        <p className="max-w-2xl text-lg text-[var(--color-text-secondary)]">
          A self-contained reference app built on the substrate workspace packages —
          hybrid search, retrieval-augmented chat with clickable citations, and an
          ingestion pipeline. Every layer degrades gracefully.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/search" className="btn btn-primary">
            Try search
          </Link>
          <Link href="/chat" className="btn btn-ghost">
            Ask a question
          </Link>
          <span className="badge">
            mode:&nbsp;
            <span className="mono text-[var(--color-text)]">{mode}</span>
          </span>
        </div>
      </section>

      {/* Feature grid */}
      <section className="grid gap-4 sm:grid-cols-3">
        {features.map((f) => (
          <Link key={f.href} href={f.href} className="card group flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{f.title}</h2>
              <span className={`badge ${f.badgeClass}`}>{f.badge}</span>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)]">{f.description}</p>
            <span className="mt-auto text-sm font-medium text-[var(--color-accent)] opacity-0 transition-opacity group-hover:opacity-100">
              Open →
            </span>
          </Link>
        ))}
      </section>

      {/* Capability matrix */}
      <section className="card">
        <h2 className="mb-4 text-lg font-semibold">Live capability matrix</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Capability label="PostgreSQL + pgvector" on={db} onLabel="connected" offLabel="not configured" />
          <Capability label="AI provider (OpenAI)" on={ai} onLabel="key set" offLabel="demo mode" />
          <Capability
            label="Search backend"
            on={db}
            onLabel="postgres FTS"
            offLabel="orama fallback"
          />
        </div>
        <p className="mt-4 text-xs text-[var(--color-text-muted)]">
          Configure <code className="mono">DATABASE_URL</code> and{' '}
          <code className="mono">OPENAI_API_KEY</code> to unlock live retrieval and
          streaming generation. See <code className="mono">.env.example</code>.
        </p>
      </section>
    </div>
  );
}

function Capability({
  label,
  on,
  onLabel,
  offLabel,
}: {
  label: string;
  on: boolean;
  onLabel: string;
  offLabel: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--color-text-secondary)]">{label}</span>
        <span
          className={`h-2.5 w-2.5 rounded-full ${on ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-muted)]'}`}
          aria-hidden
        />
      </div>
      <div className="mt-1 text-sm font-medium">
        {on ? (
          <span className="text-[var(--color-success)]">{onLabel}</span>
        ) : (
          <span className="text-[var(--color-text-muted)]">{offLabel}</span>
        )}
      </div>
    </div>
  );
}
