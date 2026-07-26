import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
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
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
