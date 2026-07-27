import { docsSource } from '@substrate/content';
import { notFound } from 'next/navigation';

export default function DocsPage() {
  if (!docsSource) return notFound();
  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <h1 className="text-4xl font-bold text-text-primary">Documentation</h1>
      <p className="mt-4 text-text-secondary">Docs are being prepared. Check back soon.</p>
    </main>
  );
}
