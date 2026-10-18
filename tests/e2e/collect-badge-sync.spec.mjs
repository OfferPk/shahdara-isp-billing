import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  return errors;
}

test.describe('Issue #255: Collect badge synchronization with pending dues', () => {
  test('Collect badge shows 74 after bills are created and drops to 71 when 3 payments are saved (persists across reload)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile bottom navigation badge test');
    const errors = trackErrors(page);
    await page.goto('/');

    // 1. Open Collect tab
    const collBtn = page.locator('[data-mobile-nav="collection"]');
    await expect(collBtn).toBeVisible();
    await collBtn.click();

    // Quick Collect modal should open
    const quickModal = page.locator('#quickCollectModal');
    await expect(quickModal).toBeVisible();

    // 2. Open Set packages & monthly fee
    const setupBtn = quickModal.locator('[data-qc-setup-packages]');
    await expect(setupBtn).toBeVisible();
    await setupBtn.click();

    const setupModal = page.locator('#collectSetupModal');
    await expect(setupModal).toBeVisible();

    // Select all customers and generate bills
    await page.locator('#collectSetupSelectAll').check();
    await page.locator('#collectSetupApplyBtn').click();
    await expect(page.locator('#collectSetupStatus')).toContainText(/bills generated/i);
    await page.locator('#closeCollectSetupBtn').click();
    await expect(setupModal).toBeHidden();

    // Collect badge on mobile bottom nav should be 74
    const badge = page.locator('#bottomNavBadgeCollection');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('74');

    // Quick Collect Pending count should also be 74
    await expect(page.locator('#quickCollectDuesCount')).toHaveText('74');

    // 3. Open Bulk Collect Cash
    await page.locator('#openBulkCollectBtn').click();

    const bulkModal = page.locator('#bulkCollectModal');
    await expect(bulkModal).toBeVisible();

    // Add 3 customers in Bulk Collect (v2 rows: due prefilled in each row's amount box;
    // an added row leaves the list, so the next pending customer moves to the top).
    const rows = bulkModal.locator('.bc-row');
    await expect(rows.first()).toBeVisible();
    for (let i = 0; i < 3; i++) {
      await rows.first().locator('[data-bulk-add]').click();
      await expect(page.locator('#bulkCollectCount')).toHaveText(`${i + 1} customer${i ? 's' : ''}`);
    }
    await expect(page.locator('#bulkCollectCount')).toHaveText('3 customers');

    // Save payments
    const saveBtn = page.locator('#bulkCollectSaveBtn');
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    await expect(page.locator('#bulkCollectStatus')).toContainText('3 payments saved');

    // 4. Verify Collect badge dropped to 71
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('71');

    // Close Bulk Collect
    await page.locator('#closeBulkCollectBtn').click();
    await expect(bulkModal).toBeHidden();

    // Navigate to Home tab
    const homeBtn = page.locator('[data-mobile-nav="home"]');
    await homeBtn.click();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('71');

    // 5. Reload page and assert Collect badge remains 71
    await page.reload();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('71');

    // Re-open Collect and assert Pending count also displays 71
    await collBtn.click();
    await expect(quickModal).toBeVisible();
    await expect(page.locator('#quickCollectDuesCount')).toHaveText('71');

    expect(errors).toEqual([]);
  });
});
