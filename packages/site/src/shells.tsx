/**
 * Error / Loading / Not-Found shells — generic, application-agnostic
 * UI for Next.js convention files.
 *
 * Applications re-export these from their `app/error.tsx`,
 * `app/global-error.tsx`, `app/loading.tsx`, and `app/not-found.tsx`.
 *
 * ```tsx
 * // app/error.tsx
 * export { SubstrateError as default } from '@substrate-platform/site/shells';
 * ```
 */
'use client';

import { type ReactElement, useEffect } from 'react';

// ── Types ───────────────────────────────────────────────────────────

export type ErrorShellProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

// ── Error boundary ──────────────────────────────────────────────────

export function SubstrateError({ error, reset }: ErrorShellProps): ReactElement {
  useEffect(() => {
    console.error('[Route Error]', error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6">
      <div className="substrate-glass-card p-8 text-center">
        <h2 className="text-2xl font-semibold text-text-primary">Something went wrong</h2>
        <p className="mt-3 text-sm text-text-secondary">
          {error.message || 'An unexpected error occurred while rendering this page.'}
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-xs text-text-tertiary">Error ID: {error.digest}</p>
        )}
        <button type="button" className="btn btn-accent mt-6" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}

// ── Global error boundary ───────────────────────────────────────────

export function SubstrateGlobalError({ error, reset }: ErrorShellProps): ReactElement {
  useEffect(() => {
    console.error('[Global Error]', error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6">
          <div className="substrate-glass-card p-8 text-center">
            <h2 className="text-2xl font-semibold text-text-primary">Application error</h2>
            <p className="mt-3 text-sm text-text-secondary">
              {error.message || 'A critical error occurred while rendering this page.'}
            </p>
            {error.digest && (
              <p className="mt-2 font-mono text-xs text-text-tertiary">Error ID: {error.digest}</p>
            )}
            <button type="button" className="btn btn-accent mt-6" onClick={reset}>
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

// ── Loading shell ───────────────────────────────────────────────────

export function SubstrateLoading(): ReactElement {
  return (
    <div className="mx-auto min-h-screen max-w-5xl px-6 py-24" aria-busy="true">
      <div className="animate-pulse">
        <div className="mb-20">
          <div className="h-12 w-32 rounded-lg bg-text-primary/10" />
          <div className="mt-4 h-6 w-80 rounded-lg bg-text-primary/5" />
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="substrate-glass-card h-32 p-6">
              <div className="h-5 w-24 rounded bg-text-primary/10" />
              <div className="mt-3 h-4 w-40 rounded bg-text-primary/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Not-found shell ─────────────────────────────────────────────────

export function SubstrateNotFound(): ReactElement {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6">
      <div className="substrate-glass-card p-8 text-center">
        <p className="font-mono text-sm text-text-tertiary">404</p>
        <h1 className="mt-2 text-3xl font-semibold text-text-primary">Page not found</h1>
        <p className="mt-3 text-sm text-text-secondary">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <a href="/" className="btn btn-accent mt-6 inline-block">
          Back to home
        </a>
      </div>
    </main>
  );
}
