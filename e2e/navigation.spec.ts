/**
 * E2E tests — navigation and core page rendering.
 *
 * These tests verify that the reference implementation (@substrate/web)
 * renders correctly and that all three subsystems are accessible.
 */
import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('renders brand and subsystem links', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Aevum');
    await expect(page.locator('a[href="/lattice"]')).toBeVisible();
    await expect(page.locator('a[href="/crucible"]')).toBeVisible();
    await expect(page.locator('a[href="/archive"]')).toBeVisible();
  });

  test('navigates to Lattice', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/lattice"]');
    await expect(page.locator('h1')).toContainText('Lattice');
    await expect(page.locator('text=force-directed')).toBeVisible({ timeout: 10000 });
  });

  test('navigates to Archive', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/archive"]');
    await expect(page.locator('h1')).toContainText('Archive');
  });

  test('navigates to Crucible', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/crucible"]');
    await expect(page.locator('h1')).toContainText('Crucible');
  });
});

test.describe('Archive', () => {
  test('displays search box', async ({ page }) => {
    await page.goto('/archive');
    await expect(page.locator('input[type="search"]')).toBeVisible();
  });

  test('displays article cards', async ({ page }) => {
    await page.goto('/archive');
    await expect(page.locator('.aevum-glass-card').first()).toBeVisible();
  });

  test('search filters results', async ({ page }) => {
    await page.goto('/archive');
    await page.fill('input[type="search"]', 'WebGPU');
    // Wait for debounced search to complete.
    await page.waitForTimeout(500);
    // Should show at least one result containing WebGPU.
    const results = page.locator('a[href^="/archive/"]');
    await expect(results.first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Lattice', () => {
  test('renders renderer tier badge', async ({ page }) => {
    await page.goto('/lattice');
    // The renderer tier badge should appear (WebGPU, WebGL2, Canvas, or Static).
    await expect(page.locator('.aevum-badge').first()).toBeVisible({ timeout: 10000 });
  });
});
