/**
 * Root layout — server component.
 *
 * Uses SubstrateLayout for the HTML shell and "Powered by Substrate" footer.
 * Realtime Room demonstrates Durable Objects, presence, and real-time collaboration.
 */
import { initFeatures, realtimeRoomFeatures } from '@substrate/config/features';
import { SubstrateLayout } from '@substrate/site/layout';
import { createMetadata } from '@substrate/site/metadata';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import './globals.css';

initFeatures(realtimeRoomFeatures);

export const metadata = createMetadata({
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
