/**
 * fast-search-set-fee-354.spec.mjs
 * Issue #354: Fast Search "Collect / Set Fee" for a customer with NO
 * monthly fee must open the Set monthly bill editor (like the
 * Customers-list "Bill not set" chip), not Quick Collect with Rs 0
 * chips. Once the fee exists, the same action opens Quick Collect.
 */
import { test, expect } from '@playwright/test';

async function freshApp(page) {
  await page.goto('/#/home');
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached' });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached' });
}

async function searchAndCollect(page, query) {
  await page.locator('#mobileCustomerSearchTrigger').click();
  const input = page.locator('#fastCustomerSearchInput');
  await expect(input).toBeVisible();
  await input.fill(query);
  const card = page.locator('.fcs-card', { hasText: query.toUpperCase() }).first();
  await expect(card).toBeVisible();
  return card;
}

test.describe('Issue 354: Fast Search Collect / Set Fee', () => {
  test('no-fee customer: opens Set monthly bill, not Quick Collect with Rs 0 chips', async ({ page }) => {
    await freshApp(page);
    const card = await searchAndCollect(page, 'awais');
    const collectBtn = card.locator('[data-fcs-action="collect"]');
    await expect(collectBtn).toContainText('Collect / Set Fee');
    await collectBtn.click();

    // The Set monthly bill dialog opens with the fee field ready.
    const dialog = page.locator('#inlineBillEditDialog');
    await expect(dialog).toBeVisible();
    await expect(page.locator('#inlineBillEditTitle')).toHaveText('Set monthly bill');
    await expect(page.locator('#inlineBillCustomerInfo')).toContainText('AWAIS');
    // Quick Collect did NOT open.
    await expect(page.locator('#quickCollectModal')).toBeHidden();

    // Set the fee: this month's bill is created on save.
    await page.locator('#inlineBillFeeInput').fill('1500');
    await page.locator('#inlineBillSaveBtn').click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('#toast')).toContainText('1,500');

    // Now the same search action goes to Quick Collect with real amounts.
    const card2 = await searchAndCollect(page, 'awais');
    await card2.locator('[data-fcs-action="collect"]').click();
    const qc = page.locator('#quickCollectModal');
    await expect(qc).toBeVisible();
    await expect(qc).not.toContainText('Full (Rs 0)');
  });

  test('Enter key on a no-fee result also opens the fee editor', async ({ page }) => {
    await freshApp(page);
    await page.locator('#mobileCustomerSearchTrigger').click();
    const input = page.locator('#fastCustomerSearchInput');
    await expect(input).toBeVisible();
    await input.fill('nazeer');
    await expect(page.locator('.fcs-card').first()).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('#inlineBillEditDialog')).toBeVisible();
    await expect(page.locator('#quickCollectModal')).toBeHidden();
  });
});
