/**
 * Root layout — dark "knowledge base" shell with Geist fonts.
 *
 * The CSS variables for the fonts are emitted by `geist/font` and
 * consumed by the `@theme` block in `globals.css`.
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Nav } from './nav';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'AI Archive', template: '%s — AI Archive' },
  description:
    'AI-driven content retrieval and RAG Q&A — hybrid search, citations, and an ingestion pipeline.',
  metadataBase: new URL('https://ai-archive.example'),
  openGraph: {
    title: 'AI Archive',
    description: 'Hybrid search + RAG with transparent citations.',
    type: 'website',
    images: [{ url: '/api/og' }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html
      lang="en"
      className={`dark ${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Nav />
        <main className="container-page py-10">{children}</main>
      </body>
    </html>
  );
}
