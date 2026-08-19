/**
 * Archive route — server component.
 *
 * Hydrates a client-side Orama search box with the static article corpus.
 * The corpus is mapped to the `SearchableDoc` shape here, on the server, so
 * the client component stays free of domain knowledge about articles.
 */
import type { SearchableDoc } from '@substrate/content/search';
import { articles } from '@/lib/articles';
import { SearchBox } from './search';

const docs: SearchableDoc[] = articles.map((article) => ({
  id: article.slug,
  title: article.title,
  excerpt: article.excerpt,
  body: article.body,
  slug: article.slug,
  tags: article.tags,
  type: 'article',
}));

export default function ArchivePage() {
  return (
    <main className="container" style={{ paddingBlock: '4rem 2rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', margin: 0 }}>Archive</h1>
        <p className="muted" style={{ margin: '0.5rem 0 0' }}>
          Search every article, instantly.
        </p>
      </header>

      <SearchBox docs={docs} />
    </main>
  );
}
