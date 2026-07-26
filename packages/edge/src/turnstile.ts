/**
 * Cloudflare Turnstile — bot protection for form submissions.
 *
 * Verifies Turnstile tokens server-side via the Siteverify API.
 * Used to protect experiment submissions, newsletter signups, and
 * content reindex triggers.
 */

export type TurnstileConfig = {
  secretKey: string;
  siteKey?: string;
};

export type TurnstileResult = {
  success: boolean;
  errorCodes?: string[];
  challengeTs?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
};

/**
 * Verify a Turnstile token.
 *
 * Call this in a Hono middleware or route handler:
 * ```ts
 * const result = await verifyTurnstile(token, req.ip);
 * if (!result.success) return c.json({ error: 'Bot verification failed' }, 403);
 * ```
 */
export async function verifyTurnstile(
  token: string,
  remoteip?: string,
  config?: TurnstileConfig,
): Promise<TurnstileResult> {
  if (!config?.secretKey) {
    // No secret configured — skip verification (development mode).
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

  const data = await res.json() as {
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
  return async (c: { req: { header(name: string): string | undefined }; json(): Promise<unknown> }, next: () => Promise<void>) => {
    const token = c.req.header('cf-turnstile-response');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing Turnstile token' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await verifyTurnstile(token, undefined, config);
    if (!result.success) {
      return new Response(JSON.stringify({ error: 'Bot verification failed', codes: result.errorCodes }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await next();
  };
}
