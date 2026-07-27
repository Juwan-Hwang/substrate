/**
 * Article detail route — renders a single Archive entry by slug.
 *
 * Prerendered for every article in the static corpus via
 * `generateStaticParams`. Per-article metadata points its social card
 * at the dynamic OG route, giving each post a bespoke image with no
 * manual asset work. Calls `notFound()` for unknown slugs so the
 * custom not-found.tsx boundary renders.
 */
import { Badge, GlassCard } from '@substrate/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { demoDocs, getArticle } from '../../../lib/articles';

type Params = { slug: string };

/** Prerender one route per article in the static corpus. */
export function generateStaticParams(): Params[] {
  return demoDocs.map((doc) => ({ slug: doc.slug }));
}

/** Per-article metadata, including a bespoke OG image. */
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
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
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-24">
      <Link
        href="/archive"
        className="text-sm text-text-secondary transition-colors hover:text-text-primary"
      >
        ← Back to Archive
      </Link>

      <article className="mt-8">
        <header className="mb-8">
          <div className="flex items-center gap-2">
            <Badge variant="accent" className="text-xs uppercase">
              {article.type}
            </Badge>
            {article.tags.map((tag) => (
              <span key={tag} className="text-xs text-text-tertiary">
                #{tag}
              </span>
            ))}
          </div>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-text-primary">
            {article.title}
          </h1>
          <p className="mt-3 text-text-secondary">{article.excerpt}</p>
        </header>

        <GlassCard className="p-8">
          <div className="grid gap-5">
            {article.body.split('\n\n').map((paragraph) => (
              <p key={paragraph} className="leading-7 text-text-primary">
                {paragraph}
              </p>
            ))}
          </div>
        </GlassCard>
      </article>
    </main>
  );
}
