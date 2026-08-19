/**
 * Cloudflare Turnstile — bot protection for form submissions.
 *
 * Verifies Turnstile tokens server-side via the Siteverify API.
 * Used to protect experiment submissions, newsletter signups, and
 * content reindex triggers.
 *
 * Security policy: fail-closed. If no secret is configured, verification
 * always fails in production. In development (NODE_ENV !== 'production'),
 * verification is skipped with a warning.
 */

import { createEdgeLogger } from './logger';

const logger = createEdgeLogger('turnstile');

export type TurnstileConfig = {
  secretKey: string;
  siteKey?: string;
};

export type TurnstileResult = {
  success: boolean;
  errorCodes?: string[] | undefined;
  challengeTs?: string | undefined;
  hostname?: string | undefined;
  action?: string | undefined;
  cdata?: string | undefined;
};

/**
 * Verify a Turnstile token.
 *
 * Call this in a Hono middleware or route handler:
 * ```ts
 * const result = await verifyTurnstile(token, req.ip);
 * if (!result.success) return c.json({ error: 'Bot verification failed' }, 403);
 * ```
 *
 * Fail-closed: if no secret is configured and NODE_ENV is 'production',
 * returns `{ success: false }`. In development, returns `{ success: true }`
 * with a console warning.
 */
export async function verifyTurnstile(
  token: string,
  remoteip?: string,
  config?: TurnstileConfig,
): Promise<TurnstileResult> {
  if (!config?.secretKey) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('No secret key configured in production — rejecting request');
      return { success: false, errorCodes: ['missing-secret'] };
    }
    logger.warn('No secret key configured — skipping verification (development only)');
    return { success: true };
  }

  const body = new URLSearchParams({
    secret: config.secretKey,
    response: token,
  });

  if (remoteip) {
    body.set('remoteip', remoteip);
  }

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body,
  });

  const data = (await res.json()) as {
    success: boolean;
    'error-codes'?: string[];
    challenge_ts?: string;
    hostname?: string;
    action?: string;
    cdata?: string;
  };

  return {
    success: data.success,
    errorCodes: data['error-codes'],
    challengeTs: data.challenge_ts,
    hostname: data.hostname,
    action: data.action,
    cdata: data.cdata,
  };
}

/**
 * Hono middleware for Turnstile verification.
 *
 * Expects a `cf-turnstile-response` header or `turnstileToken` body field.
 */
export function turnstileMiddleware(config: TurnstileConfig) {
  return async (
    c: { req: { header(name: string): string | undefined }; json(): Promise<unknown> },
    next: () => Promise<void>,
  ) => {
    const token = c.req.header('cf-turnstile-response');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing Turnstile token' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await verifyTurnstile(token, undefined, config);
    if (!result.success) {
      return new Response(
        JSON.stringify({ error: 'Bot verification failed', codes: result.errorCodes }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    await next();
  };
}
