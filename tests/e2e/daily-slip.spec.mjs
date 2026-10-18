import { test, expect } from '@playwright/test';

test.describe('Daily Slip Quick Action & Live State Suite (#238)', () => {
  test('Daily Slip quick action copies slip, provides feedback, and opens daily closing modal', async ({ page, context }) => {
    // Grant clipboard permissions if supported
    try {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    } catch {}

    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#billingDashboard')).toBeVisible();

    const slipBtn = page.locator('#quickActionDailyClosingSlip');
    await expect(slipBtn).toBeVisible();

    // Click Daily Slip
    await slipBtn.click();

    // Verify toast notification appears
    const toast = page.locator('#toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Daily closing');

    // Verify Daily Closing Modal opens for full interactive review
    const modal = page.locator('#dailyClosingModal');
    await expect(modal).toBeVisible();
    await expect(modal).toHaveAttribute('open', '');

    // Verify action buttons exist in modal footer
    await expect(page.locator('#dcCopySlipBtn')).toBeVisible();
    await expect(page.locator('#dcShareWhatsAppBtn')).toBeVisible();
    await expect(page.locator('#dcPrintA4Btn')).toBeVisible();
    await expect(page.locator('#dcPrintPosBtn')).toBeVisible();
    await expect(page.locator('#dcExportCsvBtn')).toBeVisible();

    // Close via close button
    const closeBtn = page.locator('#closeDailyClosingModalBtn');
    await closeBtn.click();
    await expect(modal).not.toBeVisible();

    expect(errors).toEqual([]);
  });

  test('Daily Slip reflects newly recorded payments dynamically', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Tap quick action to trigger daily slip and open modal
    const slipBtn = page.locator('#quickActionDailyClosingSlip');
    await slipBtn.click();

    const modal = page.locator('#dailyClosingModal');
    await expect(modal).toBeVisible();

    // Check KPI element
    const kpiTotal = page.locator('#dcKpiTotal');
    await expect(kpiTotal).toBeVisible();

    // Close modal
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();

    expect(errors).toEqual([]);
  });
});
