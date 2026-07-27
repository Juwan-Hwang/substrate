/**
 * Custom 404 — rendered when `notFound()` is called or no route matches.
 *
 * Keeps the Aevum brand shell and offers a way back home. Styled to
 * match the route error boundary (error.tsx) for visual consistency.
 */
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6">
      <div className="aevum-glass-card p-8 text-center">
        <p className="font-mono text-sm text-text-tertiary">404</p>
        <h1 className="mt-2 text-3xl font-semibold text-text-primary">Page not found</h1>
        <p className="mt-3 text-sm text-text-secondary">
          The page you’re looking for doesn’t exist or has been moved.
        </p>
        <Link href="/" className="btn btn-accent mt-6 inline-block">
          Back to home
        </Link>
      </div>
    </main>
  );
}
