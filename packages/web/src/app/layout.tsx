import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { NewsletterForm } from '../components/newsletter-form';
import { PaintRegistrar } from '../components/paint-registrar';
import { Providers } from '../components/providers';
import { SmoothScroll } from '../components/smooth-scroll';
import '@substrate/ui/styles.css';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Aevum',
    template: '%s — Aevum',
  },
  description: 'A personal site platform — Lattice, Crucible, and Archive.',
  metadataBase: new URL('https://aevum.dev'),
  openGraph: {
    title: 'Aevum',
    description: 'A personal site platform — Lattice, Crucible, and Archive.',
    type: 'website',
    images: [{ url: '/api/og' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Providers>
          <SmoothScroll />
          <PaintRegistrar />
          <Suspense>{children}</Suspense>
          <footer className="mx-auto max-w-5xl px-6 py-12">
            <div className="aevum-glass-card p-6">
              <h3 className="mb-2 text-lg font-semibold text-text-primary">Stay updated</h3>
              <p className="mb-4 text-sm text-text-secondary">
                Get notified when new experiments and articles are published.
              </p>
              <Suspense>
                <NewsletterForm />
              </Suspense>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
