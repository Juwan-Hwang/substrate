/**
 * Archive route — server component.
 *
 * Hydrates a client-side Orama search box with the static mission log corpus.
 * The corpus is mapped to the `SearchableDoc` shape here, on the server, so
 * the client component stays free of domain knowledge about mission logs.
 */
import type { SearchableDoc } from '@substrate-platform/content/search';
import { logs } from '@/lib/logs';
import { SearchBox } from './search';

const docs: SearchableDoc[] = logs.map((log) => ({
  id: log.slug,
  title: log.title,
  excerpt: log.excerpt,
  body: log.body,
  slug: log.slug,
  tags: log.tags,
  type: 'article',
}));

export default function ArchivePage() {
  return (
    <main className="container" style={{ paddingBlock: '4rem 2rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', margin: 0 }}>Archive</h1>
        <p className="muted" style={{ margin: '0.5rem 0 0' }}>
          Search every mission log, instantly.
        </p>
      </header>

      <SearchBox docs={docs} />
    </main>
  );
}
