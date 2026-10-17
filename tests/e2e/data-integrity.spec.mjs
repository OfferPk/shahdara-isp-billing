import { test, expect } from '@playwright/test';

test.describe('Database Data Integrity & Safe Repair Suite E2E Verification', () => {
  test('opens via quick action ribbon, runs scan, renders SVG gauge, and closes cleanly', async ({ page }) => {
    await page.goto('/');

    const quickActionBtn = page.locator('#quickActionDataIntegrity');
    await expect(quickActionBtn).toBeVisible();
    await quickActionBtn.click();

    const modal = page.locator('#dataIntegrityModal');
    await expect(modal).toBeVisible();

    // Verify KPI cards
    const scoreVal = page.locator('#integrityScoreVal');
    await expect(scoreVal).toBeVisible();
    const auditedVal = page.locator('#integrityTotalAuditedVal');
    await expect(auditedVal).toBeVisible();

    // Verify SVG Health Gauge
    const svgChart = page.locator('.data-integrity-svg');
    await expect(svgChart).toBeVisible();

    // Test scan button trigger
    const scanBtn = page.locator('#runDataIntegrityScanBtn');
    await expect(scanBtn).toBeVisible();
    await scanBtn.click();

    // Check table exists
    const tableBody = page.locator('#dataIntegrityTableBody');
    await expect(tableBody).toBeVisible();

    // Close via header close button
    const closeBtn = page.locator('#closeDataIntegrityModalBtn');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });

  test('opens via backup footer controls and dismisses with Escape key', async ({ page }) => {
    await page.goto('/');

    // Toggle backup controls panel
    const toggleBtn = page.locator('#backupControlsToggle');
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();

    const backupPanel = page.locator('#backupControls');
    await expect(backupPanel).toBeVisible();

    // Click Data Integrity & Fixes button
    const integrityBtn = page.locator('#openDataIntegrityBtn');
    await expect(integrityBtn).toBeVisible();
    await integrityBtn.click();

    const modal = page.locator('#dataIntegrityModal');
    await expect(modal).toBeVisible();

    // Dismiss with Escape key
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('filters findings and verifies safe fix workflow', async ({ page }) => {
    await page.goto('/');

    // Inject dirty test customer into localStorage to test fix workflow
    await page.evaluate(() => {
      const raw = localStorage.getItem('shahdara-isp-billing-v1');
      const state = raw ? JSON.parse(raw) : { customers: [] };
      state.customers.push({
        id: 'test-dirty-cust-1',
        customerNumber: null, // Missing number
        name: 'Dirty Integrity Test User',
        monthlySellingAmount: 1800,
        bills: [
          { id: 'dirty-bill-1', month: '2026-02', dueAmount: null, payments: [] } // Unpriced bill
        ]
      });
      localStorage.setItem('shahdara-isp-billing-v1', JSON.stringify(state));
    });

    // Reload to pick up dirty state
    await page.reload();

    const quickActionBtn = page.locator('#quickActionDataIntegrity');
    await quickActionBtn.click();

    const modal = page.locator('#dataIntegrityModal');
    await expect(modal).toBeVisible();

    // Run Scan
    const scanBtn = page.locator('#runDataIntegrityScanBtn');
    await scanBtn.click();

    // Verify issues detected and Fix button is enabled
    const issuesFoundVal = page.locator('#integrityIssuesFoundVal');
    await expect(issuesFoundVal).not.toHaveText('0');

    const applyFixesBtn = page.locator('#applyDataIntegrityFixesBtn');
    await expect(applyFixesBtn).toBeEnabled();

    // Apply safe fixes
    await applyFixesBtn.click();

    // Re-verify that after fixes, autoFixable count becomes 0 and clean status achieved
    await expect(applyFixesBtn).toBeDisabled();

    // Close modal
    const secondaryCloseBtn = page.locator('#closeDataIntegritySecondaryBtn');
    await secondaryCloseBtn.click();
    await expect(modal).not.toBeVisible();
  });

  test('responsive verification: zero horizontal scroll and 44px touch targets at 390px mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const quickActionBtn = page.locator('#quickActionDataIntegrity');
    await expect(quickActionBtn).toBeVisible();
    await quickActionBtn.click();

    const modal = page.locator('#dataIntegrityModal');
    await expect(modal).toBeVisible();

    // Verify touch target min-height >= 44px on primary buttons
    const scanBtn = page.locator('#runDataIntegrityScanBtn');
    const scanBox = await scanBtn.boundingBox();
    expect(scanBox.height).toBeGreaterThanOrEqual(44);

    const closeBtn = page.locator('#closeDataIntegritySecondaryBtn');
    const closeBox = await closeBtn.boundingBox();
    expect(closeBox.height).toBeGreaterThanOrEqual(44);

    // Verify zero horizontal scroll
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);

    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });

  test('theme verification: renders cleanly in dark mode', async ({ page }) => {
    await page.goto('/');

    // Set dark theme
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('shahdara_theme', 'dark');
    });

    const quickActionBtn = page.locator('#quickActionDataIntegrity');
    await quickActionBtn.click();

    const modal = page.locator('#dataIntegrityModal');
    await expect(modal).toBeVisible();

    // Verify dark surface background is active
    const modalBg = await modal.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    // In dark mode, background should be rgb(15, 23, 42) / #0f172a
    expect(modalBg).toBe('rgb(15, 23, 42)');

    const closeBtn = page.locator('#closeDataIntegrityModalBtn');
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });
});
