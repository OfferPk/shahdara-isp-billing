// Regression for #236: the Home "Billing Audit" tile did nothing because only the hidden
// backup-footer button received the click listener.
import { test, expect } from '@playwright/test';

test('Home Billing Audit tile opens the Billing Correctness dialog inside the viewport', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  const tile = page.locator('#quickActionBillingCorrectness');
  await tile.scrollIntoViewIfNeeded();
  await tile.click();
  const modal = page.locator('#billingCorrectnessModal');
  await expect(modal).toBeVisible();
  expect(await modal.evaluate(d => d.open)).toBe(true);
  const box = await modal.boundingBox();
  const vp = page.viewportSize();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
  await expect(page.locator('#auditDiscCountBadge')).toContainText(/finding/);
  await page.locator('#closeBillingCorrectnessModalBtn').click();
  await expect(modal).toBeHidden();
  // Reopening still works (listener not lost, no double-open errors).
  await tile.click();
  await expect(modal).toBeVisible();
  expect(errors).toEqual([]);
});
