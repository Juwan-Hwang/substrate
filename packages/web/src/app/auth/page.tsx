/**
 * Auth page — sign in / sign up with Better Auth.
 *
 * Supports email/password, GitHub OAuth, and WebAuthn Passkeys.
 */
'use client';

import { useState } from 'react';
import { signIn, signUp } from '../../lib/auth';

export default function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'signup') {
        await signUp.email({ email, password });
      } else {
        await signIn.email({ email, password });
      }
      // Redirect to home or the redirect URL.
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleGitHub() {
    setLoading(true);
    try {
      await signIn.social({ provider: 'github' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'GitHub sign-in failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-24">
      <div className="aevum-glass-card p-8">
        <h1 className="mb-6 text-2xl font-bold text-text-primary">
          {mode === 'signin' ? 'Sign in to Aevum' : 'Create an account'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-text-primary">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-border-default bg-bg-muted px-4 py-2 text-text-primary focus:border-accent focus:outline-none"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-text-primary">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-lg border border-border-default bg-bg-muted px-4 py-2 text-text-primary focus:border-accent focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="btn btn-primary w-full"
          >
            {loading ? 'Loading...' : mode === 'signin' ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-border-default" />
          <span className="text-xs text-text-muted">or</span>
          <div className="h-px flex-1 bg-border-default" />
        </div>

        <button
          type="button"
          onClick={handleGitHub}
          disabled={loading}
          className="btn btn-ghost w-full"
        >
          Continue with GitHub
        </button>

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}

        <p className="mt-6 text-center text-sm text-text-secondary">
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            className="text-accent underline"
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </main>
  );
}
