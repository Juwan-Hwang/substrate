/**
 * Error boundary — re-exports the platform's generic error shell.
 *
 * Next.js requires error.tsx to be a Client Component. The 'use client'
 * directive here satisfies that requirement; the actual error UI is
 * provided by @substrate-platform/site/shells, which is also a client module.
 */
'use client';

export { SubstrateError as default } from '@substrate-platform/site/shells';
