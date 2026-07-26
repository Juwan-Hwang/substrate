/**
 * E2E tests — OG image generation.
 *
 * Verifies that the /api/og endpoint returns a valid image response.
 */
import { test, expect } from '@playwright/test';

test('OG image endpoint returns image', async ({ request }) => {
  const response = await request.get('/api/og');
  expect(response.status()).toBe(200);
  const contentType = response.headers()['content-type'];
  expect(contentType).toContain('image/');
});
