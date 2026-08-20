/**
 * Orama search — instant static content search for the Archive.
 * Indexed at build time, queried client-side with zero server round-trip.
 */
import { create, insert, search } from '@orama/orama';

export type SearchableDoc<TType extends string = string> = {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  slug: string;
  tags: string[];
  /** Application-defined content type ('article', 'project', 'note', 'log', etc.). */
  type: TType;
};

export async function createSearchIndex(docs: SearchableDoc[]) {
  const db = await create({
    schema: {
      id: 'string',
      title: 'string',
      excerpt: 'string',
      body: 'string',
      slug: 'string',
      tags: 'string[]',
      type: 'string',
    },
  });

  for (const doc of docs) {
    await insert(db, doc);
  }

  return {
    search: (term: string, limit = 10) => search(db, { term, limit }),
  };
}
