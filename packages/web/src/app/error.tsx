'use client';

/**
 * Root error boundary — catches errors thrown during streaming SSR
 * or Server Action execution. Displays a recovery UI without
 * unmounting the entire route.
 */
import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Route Error]', error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6">
      <div className="aevum-glass-card p-8 text-center">
        <h2 className="text-2xl font-semibold text-text-primary">Something went wrong</h2>
        <p className="mt-3 text-sm text-text-secondary">
          {error.message || 'An unexpected error occurred while rendering this page.'}
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-xs text-text-tertiary">Error ID: {error.digest}</p>
        )}
        <button
          type="button"
          className="btn btn-accent mt-6"
          onClick={reset}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
