/**
 * Home route — renders the article index as a stack of glass cards.
 *
 * Pure server component: the article corpus is static, so the entire page is
 * prerendered at build time.
 */
import Link from 'next/link';
import { Badge, GlassCard } from '@substrate/ui';
import { articles } from '@/lib/articles';

export default function HomePage() {
  return (
    <main className="container" style={{ paddingBlock: '4rem 2rem' }}>
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2rem', margin: '0 0 0.5rem' }}>Minimal Site</h1>
        <p className="muted" style={{ margin: 0 }}>
          A static content site on the substrate stack.
        </p>
      </header>

      <section>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Articles</h2>
          <Link href="/archive" className="muted" style={{ fontSize: '0.875rem' }}>
            Archive &amp; search →
          </Link>
        </div>

        <div style={{ display: 'grid', gap: '1rem' }}>
          {articles.map((article) => (
            <Link key={article.slug} href={`/articles/${article.slug}`} style={{ display: 'block' }}>
              <GlassCard style={{ padding: '1.5rem' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: '1rem',
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: '1.125rem' }}>{article.title}</h3>
                  <time
                    className="tertiary"
                    style={{ fontSize: '0.8125rem', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {article.date}
                  </time>
                </div>
                <p className="muted" style={{ margin: '0.75rem 0 1rem' }}>
                  {article.excerpt}
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {article.tags.map((tag) => (
                    <Badge key={tag} variant="accent">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
