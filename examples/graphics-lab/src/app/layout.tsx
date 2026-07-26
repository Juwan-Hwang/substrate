/** Root layout — dark theme, Geist fonts. */
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Graphics Lab', template: '%s — Graphics Lab' },
  description: 'WebGPU/WGSL, R3F, Rust/WASM graphics experiments.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
