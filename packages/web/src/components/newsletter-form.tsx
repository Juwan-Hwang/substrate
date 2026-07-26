/**
 * Newsletter subscription form — React Hook Form + useActionState (React 19).
 *
 * Progressive enhancement: works without JS via Server Action.
 */
'use client';

import { useActionState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { subscribeNewsletter, type NewsletterState } from '../app/actions/newsletter';

const schema = z.object({
  email: z.string().email('Please enter a valid email'),
});

type FormData = z.infer<typeof schema>;

const initialState: NewsletterState = { ok: false };

export function NewsletterForm() {
  const [state, formAction, isPending] = useActionState(subscribeNewsletter, initialState);

  const {
    register,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  return (
    <form action={formAction} className="flex gap-3">
      <input
        {...register('email')}
        name="email"
        type="email"
        autoComplete="email"
        className="flex-1 rounded-lg border border-border-default bg-bg-muted px-4 py-2 text-text-primary placeholder-text-muted focus:border-accent focus:outline-none"
        placeholder="you@example.com"
      />
      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className="btn btn-accent whitespace-nowrap"
      >
        {isPending ? 'Subscribing...' : 'Subscribe'}
      </button>

      {state.ok && state.message && (
        <span className="self-center text-sm text-success">{state.message}</span>
      )}
      {state.error && (
        <span className="self-center text-sm text-danger">{state.error}</span>
      )}
      {errors.email && !state.error && (
        <span className="self-center text-sm text-danger">{errors.email.message}</span>
      )}
    </form>
  );
}
