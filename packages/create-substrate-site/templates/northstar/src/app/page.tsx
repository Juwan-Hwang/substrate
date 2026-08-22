/**
 * Home route — renders the mission log index as a stack of glass cards.
 *
 * Pure server component: the mission log corpus is static, so the entire
 * page is prerendered at build time.
 */
import { Badge, GlassCard } from '@substrate-platform/ui';
import Link from 'next/link';
import { logs } from '@/lib/logs';

export default function HomePage() {
  return (
    <main className="container" style={{ paddingBlock: '4rem 2rem' }}>
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2rem', margin: '0 0 0.5rem' }}>Northstar</h1>
        <p className="muted" style={{ margin: 0 }}>
          Field reports from the edge of human reach.
        </p>
      </header>

      <section>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: '1.5rem',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Mission Logs</h2>
          <Link href="/archive" className="muted" style={{ fontSize: '0.875rem' }}>
            Archive &amp; search →
          </Link>
        </div>

        <div style={{ display: 'grid', gap: '1rem' }}>
          {logs.map((log) => (
            <Link key={log.slug} href={`/logs/${log.slug}`} style={{ display: 'block' }}>
              <GlassCard style={{ padding: '1.5rem' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: '1rem',
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: '1.125rem' }}>{log.title}</h3>
                  <time
                    className="tertiary"
                    style={{
                      fontSize: '0.8125rem',
                      flexShrink: 0,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {log.date}
                  </time>
                </div>
                <p className="muted" style={{ margin: '0.75rem 0 1rem' }}>
                  {log.excerpt}
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {log.tags.map((tag) => (
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
