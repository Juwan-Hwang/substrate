/**
 * Root layout — dark "knowledge base" shell with Geist fonts.
 *
 * Uses SubstrateLayout for the HTML shell and "Powered by Substrate" footer.
 * The Nav component and main content area are passed as children.
 */
import { aiArchiveFeatures, initFeatures } from '@substrate/config/features';
import { SubstrateLayout } from '@substrate/site/layout';
import { createMetadata } from '@substrate/site/metadata';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import type { ReactNode } from 'react';
import { Nav } from './nav';
import './globals.css';

initFeatures(aiArchiveFeatures);

export const metadata = createMetadata({
  name: 'AI Archive',
  url: 'https://ai-archive.example',
});

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <SubstrateLayout fontClass={`${GeistSans.variable} ${GeistMono.variable}`}>
      <Nav />
      <main className="container-page py-10">{children}</main>
    </SubstrateLayout>
  );
}
