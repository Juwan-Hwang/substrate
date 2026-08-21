/**
 * createMetadata — generates Next.js Metadata from a SiteIdentity.
 *
 * The application calls this with its own identity:
 *
 * ```ts
 * import { createMetadata } from '@substrate-platform/site/metadata';
 *
 * export const metadata = createMetadata({
 *   name: 'My Site',
 *   url: 'https://example.com',
 * });
 * ```
 *
 * The returned Metadata uses the site name as the default title and
 * creates a `%s — Site Name` template for per-page titles.
 */

import type { SiteIdentity } from '@substrate-platform/contracts';
import type { Metadata } from 'next';

export function createMetadata(identity: SiteIdentity): Metadata {
  return {
    title: {
      default: identity.name,
      template: `%s — ${identity.name}`,
    },
    metadataBase: new URL(identity.url),
    openGraph: {
      title: identity.name,
      type: 'website',
    },
  };
}
