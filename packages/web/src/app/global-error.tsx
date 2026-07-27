'use client';

/**
 * Root error boundary — catches errors that error.tsx cannot, including
 * failures thrown by the root layout itself. Because it replaces the
 * entire document, it must render its own <html> and <body>.
 *
 * Errors are reported to Sentry (if configured) with the error digest
 * for correlation with server-side logs.
 */
import { useEffect } from 'react';
import './globals.css';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Global Error]', error);

    // Report to Sentry if the SDK is loaded.
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      import('@sentry/nextjs')
        .then((Sentry) => {
          Sentry.captureException(error, {
            tags: { digest: error.digest ?? 'unknown' },
          });
        })
        .catch(() => {
          // Sentry failed to load — console.error is the fallback.
        });
    }
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6">
          <div className="aevum-glass-card p-8 text-center">
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
