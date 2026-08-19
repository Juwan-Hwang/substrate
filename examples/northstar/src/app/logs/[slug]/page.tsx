/**
 * Mission log detail route — statically generated for every slug.
 *
 * `generateStaticParams` enumerates the corpus so each log is prerendered
 * at build time. Per-log metadata points its social card at the dynamic
 * OG route, giving every entry a bespoke image with no manual asset work.
 */
import { Badge, GlassCard } from '@substrate/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAllSlugs, getLog } from '@/lib/logs';

type Params = { slug: string };

/** Prerender one route per mission log in the static corpus. */
export function generateStaticParams(): Params[] {
  return getAllSlugs().map((slug) => ({ slug }));
}

/** Per-log metadata, including a bespoke OG image. */
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const log = getLog(slug);
  if (!log) {
    return {};
  }
  const ogTitle = encodeURIComponent(log.title);
  return {
    title: log.title,
    description: log.excerpt,
    openGraph: {
      title: log.title,
      description: log.excerpt,
      type: 'article',
      images: [{ url: `/api/og?title=${ogTitle}` }],
    },
  };
}

export default async function LogPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const log = getLog(slug);
  if (!log) {
    notFound();
  }

  return (
    <main className="container" style={{ paddingBlock: '4rem 2rem' }}>
      <Link href="/" className="muted" style={{ fontSize: '0.875rem' }}>
        ← Back
      </Link>

      <article style={{ marginTop: '1.5rem' }}>
        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.25rem', margin: '0 0 0.75rem' }}>{log.title}</h1>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <time
              className="tertiary"
              style={{ fontSize: '0.875rem', fontVariantNumeric: 'tabular-nums' }}
            >
              {log.date}
            </time>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {log.tags.map((tag) => (
                <Badge key={tag} variant="accent">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </header>

        <GlassCard style={{ padding: '2rem' }}>
          <div style={{ display: 'grid', gap: '1.25rem' }}>
            {log.body.split('\n\n').map((paragraph) => (
              <p
                key={paragraph}
                style={{ margin: 0, color: 'var(--text-primary)', lineHeight: 1.7 }}
              >
                {paragraph}
              </p>
            ))}
          </div>
        </GlassCard>
      </article>
    </main>
  );
}
