/**
 * Root layout — server component.
 *
 * Northstar is the first example site that consumes @substrate/site's
 * platform primitives directly:
 *   - SubstrateLayout: the HTML shell with fonts, dark theme, and footer.
 *   - createMetadata: factory for Next.js Metadata from SiteIdentity.
 *   - registerInstrumentation: factory for the instrumentation hook.
 *   - SubstrateError/Loading/NotFound: generic convention-file shells.
 *
 * The application injects its own identity ("Northstar"), feature preset,
 * and accent colour — the platform provides the structure, the application
 * provides the meaning.
 *
 * Northstar is a pure static site (minimalSiteFeatures), so it does not
 * need SubstrateProviders (which wraps React Query / tRPC). That primitive
 * is consumed by the ai-archive and realtime-room examples instead.
 *
 * ## CSS Contract
 *
 * Northstar follows the three-tier CSS package boundary:
 *
 *   1. @import "tailwindcss"               — Tailwind v4 entry (consumer)
 *   2. @import "@substrate/ui/styles.css"  — design tokens + components
 *   3. @import "@substrate/site/globals"   — Tailwind theme bridge + utilities
 *
 * See globals.css for the full contract documentation.
 */
import { features, initFeatures, minimalSiteFeatures } from '@substrate/config/features';
import { SubstrateLayout } from '@substrate/site/layout';
import { createMetadata } from '@substrate/site/metadata';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import type { ReactNode } from 'react';
import './globals.css';

// Initialise the feature manifest for this deployment.
initFeatures(minimalSiteFeatures);

export const metadata = createMetadata({
  name: 'Northstar',
  url: 'https://northstar.example.com',
});

export default function RootLayout({ children }: { children: ReactNode }) {
  const manifest = features();

  return (
    <SubstrateLayout
      fontClass={`${GeistSans.variable} ${GeistMono.variable}`}
      poweredBy={{ enabled: false }}
    >
      {children}
      <footer
        className="container"
        style={{ paddingBlock: '4rem 2rem', borderTop: '1px solid var(--border-primary)' }}
      >
        <p className="muted" style={{ fontSize: '0.875rem', margin: 0 }}>
          Northstar — a fictional interstellar technology journal. Built on Substrate. Search:{' '}
          {manifest.search}.
        </p>
      </footer>
    </SubstrateLayout>
  );
}
