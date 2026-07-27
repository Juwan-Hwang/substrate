/**
 * Server Actions — Newsletter subscription.
 *
 * Validates email with Zod, stores in PostgreSQL via @substrate/db,
 * returns progressive state.
 */
'use server';

import * as Sentry from '@sentry/nextjs';
import { createDb, newsletterSubscribers } from '@substrate/db';
import { createLogger } from '@substrate/observability';
import { z } from 'zod';

const logger = createLogger('Archive');

const newsletterSchema = z.object({
  email: z.string().email(),
});

export type NewsletterState = {
  ok: boolean;
  message?: string;
  error?: string;
};

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not configured');
  }
  return createDb({ url });
}

export async function subscribeNewsletter(
  _prev: NewsletterState,
  formData: FormData,
): Promise<NewsletterState> {
  const parsed = newsletterSchema.safeParse({
    email: formData.get('email'),
  });

  if (!parsed.success) {
    return { ok: false, error: 'Please enter a valid email address.' };
  }

  try {
    const db = getDb();

    // Insert — the unique constraint on email prevents duplicates.
    // If the email already exists, treat it as a successful re-subscription.
    await db
      .insert(newsletterSubscribers)
      .values({ email: parsed.data.email })
      .onConflictDoNothing({ target: newsletterSubscribers.email });

    return {
      ok: true,
      message: 'Subscribed! Check your inbox for confirmation.',
    };
  } catch (err) {
    logger.log({
      level: 'error',
      subsystem: 'Archive',
      message: 'subscribeNewsletter failed',
      timestamp: Date.now(),
      context: { error: err },
    });
    Sentry.captureException(err);
    return {
      ok: false,
      error: 'Failed to subscribe. Please try again later.',
    };
  }
}
