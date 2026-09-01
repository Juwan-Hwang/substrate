/**
 * @substrate-platform/auth — Cryptographic primitives and timing-safe helpers.
 */

import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Constant-time comparison between two strings using SHA-256 digests.
 * Safe against timing attacks regardless of string lengths.
 */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const digestA = createHash('sha256').update(a).digest();
  const digestB = createHash('sha256').update(b).digest();
  return timingSafeEqual(digestA, digestB);
}

/**
 * Calculates SHA-256 hex digest of a string.
 */
export function sha256Hex(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Encodes a string or Uint8Array into URL-safe base64 (without padding).
 */
export function base64UrlEncode(input: string | Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(typeof input === 'string' ? input : input).toString('base64url');
  }
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b !== undefined) {
      binary += String.fromCharCode(b);
    }
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decodes URL-safe base64 into a string.
 */
export function base64UrlDecode(input: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(input, 'base64url').toString('utf-8');
  }
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Computes an HMAC-SHA256 signature using Web Crypto API.
 */
export async function hmacSha256(secret: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return base64UrlEncode(new Uint8Array(signature));
}

/**
 * Verifies an HMAC-SHA256 signature using constant-time comparison.
 */
export async function verifyHmacSha256(
  secret: string,
  data: string,
  expectedSignature: string,
): Promise<boolean> {
  try {
    const actualSignature = await hmacSha256(secret, data);
    return timingSafeEqualStrings(actualSignature, expectedSignature);
  } catch {
    return false;
  }
}
