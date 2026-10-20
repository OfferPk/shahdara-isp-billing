// Regression for #236: the Home "Billing Audit" tile did nothing because only the hidden
// backup-footer button received the click listener.
// #278 follow-up: the tile now lives in the More menu (Operations & Intelligence Tools);
// it must still open the Billing Correctness dialog from there.
import { test, expect } from '@playwright/test';

// Opens an Operations & Intelligence tile the way a user does on mobile
// (More menu -> Operations & Intelligence Tools). On desktop the More menu is
// not rendered, so dispatch the click directly — tile handlers are id-based.
async function clickOpsTile(page, selector) {
  const tile = page.locator(selector);
  if (await page.locator('#mobileMoreButton').isVisible()) {
    await page.locator('#mobileMoreButton').click();
    const details = page.locator('#moreMenuOpsToolsDetails');
    if (!(await details.evaluate(d => d.open))) await details.locator('summary').click();
    await tile.scrollIntoViewIfNeeded();
    await expect(tile).toBeVisible();
    await tile.click();
  } else {
    await tile.dispatchEvent('click');
  }
}

test('Billing Audit tile (More menu) opens the Billing Correctness dialog inside the viewport', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await clickOpsTile(page, '#quickActionBillingCorrectness');
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
  await clickOpsTile(page, '#quickActionBillingCorrectness');
  await expect(modal).toBeVisible();
  expect(errors).toEqual([]);
});
