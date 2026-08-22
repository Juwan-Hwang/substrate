/**
 * Global error boundary — re-exports the platform's generic global error shell.
 *
 * Next.js requires global-error.tsx to be a Client Component.
 */
'use client';

export { SubstrateGlobalError as default } from '@substrate-platform/site/shells';
