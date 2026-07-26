/**
 * Root layout — server component.
 *
 * Loads the Geist fonts, the shared @substrate/ui stylesheet, and the site's
 * global theme. Initialises the feature manifest from the minimal-site
 * preset so every downstream component reads a consistent capability set.
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { initFeatures, minimalSiteFeatures, features } from '@substrate/config/features';
import '@substrate/ui/styles.css';
import './globals.css';

// Initialise the feature manifest for this deployment. Idempotent — also
// performed in instrumentation.ts, but declaring it here guarantees the
// manifest is active for server-rendered output.
initFeatures(minimalSiteFeatures);

export const metadata: Metadata = {
  title: {
    default: 'Minimal Site',
    template: '%s — Minimal Site',
  },
  description: 'A minimal, statically-generated content site built on the substrate monorepo.',
  metadataBase: new URL('https://minimal.example.com'),
  openGraph: {
    title: 'Minimal Site',
    description: 'A minimal, statically-generated content site built on the substrate monorepo.',
    type: 'website',
    images: [{ url: '/api/og' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: [{ url: '/api/og' }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const manifest = features();

  return (
    <html
      lang="en"
      className={`dark ${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        {children}
        <footer
          className="container"
          style={{ paddingBlock: '4rem 2rem', borderTop: '1px solid var(--border-primary)' }}
        >
          <p className="muted" style={{ fontSize: '0.875rem', margin: 0 }}>
            Minimal Site — built with substrate. Search: {manifest.search}.
          </p>
        </footer>
      </body>
    </html>
  );
}
