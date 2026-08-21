/**
 * Root layout — server component.
 *
 * Uses SubstrateLayout for the HTML shell and "Powered by Substrate" footer.
 * Graphics Lab demonstrates WebGPU/WGSL/R3F with full fallback chain.
 */

import { graphicsLabFeatures, initFeatures } from '@substrate-platform/config/features';
import { SubstrateLayout } from '@substrate-platform/site/layout';
import { createMetadata } from '@substrate-platform/site/metadata';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import type { Metadata } from 'next';
import './globals.css';

initFeatures(graphicsLabFeatures);

export const metadata: Metadata = createMetadata({
  name: 'Graphics Lab',
  url: 'https://graphics-lab.example.com',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <SubstrateLayout fontClass={`${GeistSans.variable} ${GeistMono.variable}`}>
      {children}
    </SubstrateLayout>
  );
}
