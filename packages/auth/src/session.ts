/**
 * @substrate-platform/auth — Stateless signed session issuer.
 *
 * Implements HMAC-SHA256 stateless session tokens containing embedded
 * timestamps (iat / exp) and subject identifiers.
 * Zero database / Redis dependency (ideal for serverless & edge runtimes).
 */

import { base64UrlDecode, base64UrlEncode, hmacSha256, verifyHmacSha256 } from './crypto';
import type { SessionIssuer, SessionPayload } from './types';

export interface SessionIssuerOptions {
  /** Default session lifetime in seconds (defaults to 7 days = 604800). */
  readonly defaultTtlSeconds?: number;
}

function generateSecureNonce(bytesCount = 16): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(bytesCount);
    crypto.getRandomValues(bytes);
    return base64UrlEncode(bytes);
  }
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

/**
 * Creates a stateless signed session issuer.
 *
 * @param secret HMAC signing secret key.
 * @param options Optional configuration including default TTL.
 */
export function createSessionIssuer(
  secret: string | undefined,
  options: SessionIssuerOptions = {},
): SessionIssuer {
  const defaultTtl = options.defaultTtlSeconds ?? 60 * 60 * 24 * 7; // 7 days

  return {
    async issue(subject: string, ttlSeconds?: number, meta?: { amr?: string }): Promise<string> {
      if (!secret) {
        throw new Error('Cannot issue session token: auth secret is not configured.');
      }

      const now = Math.floor(Date.now() / 1000);
      const ttl = ttlSeconds ?? defaultTtl;
      const exp = now + ttl;

      const payload: SessionPayload = {
        subject,
        iat: now,
        exp,
        nonce: generateSecureNonce(),
        ...(meta?.amr ? { amr: meta.amr } : {}),
      };

      const encodedPayload = base64UrlEncode(JSON.stringify(payload));
      const signature = await hmacSha256(secret, encodedPayload);

      return `${encodedPayload}.${signature}`;
    },

    async verify(token: string): Promise<SessionPayload | null> {
      if (!secret || !token || typeof token !== 'string') {
        return null;
      }

      const parts = token.split('.');
      if (parts.length !== 2) {
        return null;
      }

      const [encodedPayload, signature] = parts;
      if (!encodedPayload || !signature) {
        return null;
      }

      const isValid = await verifyHmacSha256(secret, encodedPayload, signature);
      if (!isValid) {
        return null;
      }

      try {
        const json = base64UrlDecode(encodedPayload);
        const payload = JSON.parse(json) as SessionPayload;

        if (typeof payload.subject !== 'string' || typeof payload.exp !== 'number') {
          return null;
        }

        const now = Math.floor(Date.now() / 1000);
        if (payload.exp < now) {
          // Expired
          return null;
        }

        return payload;
      } catch {
        return null;
      }
    },
  };
}
