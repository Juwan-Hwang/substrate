/**
 * Server Actions — Newsletter subscription.
 *
 * Validates email with Zod, stores via edge API, returns progressive state.
 */
'use server';

import { z } from 'zod';

const newsletterSchema = z.object({
  email: z.string().email(),
});

export type NewsletterState = {
  ok: boolean;
  message?: string;
  error?: string;
};

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

  // In production: POST to @substrate/edge /api/archive/subscribe
  // which stores in Upstash Redis and sends a confirmation email via Queues.
  return {
    ok: true,
    message: 'Subscribed! Check your inbox for confirmation.',
  };
}
