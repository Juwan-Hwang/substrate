/**
 * Article detail route — statically generated for every slug.
 *
 * `generateStaticParams` enumerates the corpus so each article is prerendered
 * at build time. Per-article metadata points its social card at the dynamic
 * OG route, giving every post a bespoke image with no manual asset work.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, GlassCard } from '@substrate/ui';
import { articles, getArticle } from '@/lib/articles';

type Params = { slug: string };

/** Prerender one route per article in the static corpus. */
export function generateStaticParams(): Params[] {
  return articles.map((article) => ({ slug: article.slug }));
}

/** Per-article metadata, including a bespoke OG image. */
export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) {
    return {};
  }
  const ogTitle = encodeURIComponent(article.title);
  return {
    title: article.title,
    description: article.excerpt,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      type: 'article',
      images: [{ url: `/api/og?title=${ogTitle}` }],
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) {
    notFound();
  }

  return (
    <main className="container" style={{ paddingBlock: '4rem 2rem' }}>
      <Link href="/" className="muted" style={{ fontSize: '0.875rem' }}>
        ← Back
      </Link>

      <article style={{ marginTop: '1.5rem' }}>
        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.25rem', margin: '0 0 0.75rem' }}>{article.title}</h1>
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
              {article.date}
            </time>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {article.tags.map((tag) => (
                <Badge key={tag} variant="accent">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </header>

        <GlassCard style={{ padding: '2rem' }}>
          <div style={{ display: 'grid', gap: '1.25rem' }}>
            {article.body.split('\n\n').map((paragraph, index) => (
              <p
                key={index}
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
