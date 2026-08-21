/**
 * Root layout — server component.
 *
 * Uses SubstrateLayout for the HTML shell and "Powered by Substrate"
 * footer. The feature manifest is initialised from the minimal-site
 * preset so every downstream component reads a consistent capability set.
 */
import { initFeatures, minimalSiteFeatures } from '@substrate/config/features';
import { SubstrateLayout } from '@substrate/site/layout';
import { createMetadata } from '@substrate/site/metadata';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import type { ReactNode } from 'react';
import './globals.css';

// Initialise the feature manifest for this deployment.
initFeatures(minimalSiteFeatures);

export const metadata = createMetadata({
  name: 'Minimal Site',
  url: 'https://minimal.example.com',
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <SubstrateLayout fontClass={`${GeistSans.variable} ${GeistMono.variable}`}>
      {children}
    </SubstrateLayout>
  );
}
