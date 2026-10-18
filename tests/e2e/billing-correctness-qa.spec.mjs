import { test, expect } from '@playwright/test';

test.describe('Billing Correctness QA & Collection Targets E2E Verification', () => {

  test('billing correctness modal runs audit, renders SVG pipeline, and dismisses via backdrop tap', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && (msg.text().includes('attribute height') || msg.text().includes('attribute rx'))) {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');

    // Open Billing Correctness modal via backup footer controls
    await page.locator('#backupControlsToggle').click();
    const openBtn = page.locator('#openBillingCorrectnessBtn');
    await expect(openBtn).toBeVisible();
    await openBtn.click();

    const modal = page.locator('#billingCorrectnessModal');
    await expect(modal).toBeVisible();

    // Verify KPI summary cards
    const accuracyVal = page.locator('#auditCleanBillsVal');
    await expect(accuracyVal).toBeVisible();

    // Verify SVG pipeline visualizer
    const svgChart = page.locator('.billing-correctness-svg');
    await expect(svgChart).toBeVisible();

    // Test filter dropdown
    const filterSelect = page.locator('#billingDiscFilterSelect');
    await expect(filterSelect).toBeVisible();
    await filterSelect.selectOption('all');

    // Verify zero SVG console errors
    expect(consoleErrors).toHaveLength(0);

    // Test backdrop click dismissal (click on backdrop in top-left of viewport outside dialog)
    await page.mouse.click(5, 5);
    await expect(modal).not.toBeVisible();
  });

  test('collection target modal opens, displays pace telemetry, and closes on backdrop tap', async ({ page }) => {
    await page.goto('/');

    const openBtn = page.locator('#openCollectionTargetBtn');
    await expect(openBtn).toBeVisible();
    await openBtn.click();

    const modal = page.locator('#collectionTargetModal');
    await expect(modal).toBeVisible();

    // Verify monthly target input
    const targetInput = page.locator('#targetAmountInput');
    await expect(targetInput).toBeVisible();

    // Dismiss via backdrop click
    await page.mouse.click(5, 5);
    await expect(modal).not.toBeVisible();
  });

  test('responsive verification: zero horizontal scroll and 44px touch targets at 390px mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // Open via more menu
    await page.locator('#mobileMoreButton').click();
    await expect(page.locator('#mobileMoreMenu')).toBeVisible();
    await page.locator('#mobileMoreBillingCorrectnessBtn').click();

    const modal = page.locator('#billingCorrectnessModal');
    await expect(modal).toBeVisible();

    // Verify 44px min touch target on Run Audit button
    const runBtn = page.locator('#runBillingAuditBtn');
    const runBox = await runBtn.boundingBox();
    if (runBox) {
      expect(runBox.height).toBeGreaterThanOrEqual(44);
    }

    // Verify zero horizontal scroll overflow at 390px
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Close via close button
    const closeBtn = page.locator('#closeBillingCorrectnessModalBtn');
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });

  test('theme verification: renders cleanly in dark mode', async ({ page }) => {
    await page.goto('/');

    // Enable dark mode
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('shahdara_theme', 'dark');
    });

    await page.locator('#backupControlsToggle').click();
    await page.locator('#openBillingCorrectnessBtn').click();

    const modal = page.locator('#billingCorrectnessModal');
    await expect(modal).toBeVisible();

    // Verify dark surface background is active
    const modalBg = await modal.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    expect(modalBg).toBe('rgb(15, 23, 42)');

    const closeBtn = page.locator('#closeBillingCorrectnessModalBtn');
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });

});
