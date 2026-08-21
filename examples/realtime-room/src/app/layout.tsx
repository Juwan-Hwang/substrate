/**
 * Root layout — server component.
 *
 * Uses SubstrateLayout for the HTML shell and "Powered by Substrate" footer.
 * Realtime Room demonstrates Durable Objects, presence, and real-time collaboration.
 */

import { initFeatures, realtimeRoomFeatures } from '@substrate-platform/config/features';
import { SubstrateLayout } from '@substrate-platform/site/layout';
import { createMetadata } from '@substrate-platform/site/metadata';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import type { Metadata } from 'next';
import './globals.css';

initFeatures(realtimeRoomFeatures);

export const metadata: Metadata = createMetadata({
  name: 'Realtime Room',
  url: 'https://realtime-room.example.com',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <SubstrateLayout fontClass={`${GeistSans.variable} ${GeistMono.variable}`}>
      {children}
    </SubstrateLayout>
  );
}
