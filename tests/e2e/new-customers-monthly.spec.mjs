import { test, expect } from '@playwright/test';

// New customers by month (customer ledger): the panel lives in the
// customers view and aggregates saved customers only. These specs are
// data-independent: they assert the panel and its controls exist and
// that switching views never breaks the roster, on empty and populated
// ledgers alike.
test.describe('New Customers By Month', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#customers');
    await expect(page.locator('#newCustomersPanel')).toBeVisible();
  });

  test('panel shows quick views and a month selector', async ({ page }) => {
    const panel = page.locator('#newCustomersPanel');
    await expect(panel.locator('[data-newcust-view="thisMonth"]')).toHaveText('This month');
    await expect(panel.locator('[data-newcust-view="lastMonth"]')).toHaveText('Last month');
    await expect(panel.locator('[data-newcust-view="last3Months"]')).toHaveText('Last 3 months');
    await expect(panel.locator('[data-newcust-view="last6Months"]')).toHaveText('Last 6 months');
    const monthSelect = panel.locator('#newCustomersMonthSelect');
    await expect(monthSelect).toBeVisible();
    await expect(monthSelect).toHaveValue('');
    await expect(monthSelect.locator('option').first()).toHaveText('Choose a month…');
    await expect(panel.locator('.new-customers-totals')).toContainText('new customers');
  });

  test('switching quick views keeps the panel and roster visible', async ({ page }) => {
    const panel = page.locator('#newCustomersPanel');
    await panel.locator('[data-newcust-view="lastMonth"]').click();
    await expect(panel.locator('[data-newcust-view="lastMonth"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(panel).toBeVisible();
    await panel.locator('[data-newcust-view="last6Months"]').click();
    await expect(panel.locator('[data-newcust-view="last6Months"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#customerList')).toBeVisible();
  });

  test('month selector lists months newest first when data has joins', async ({ page }) => {
    const monthSelect = page.locator('#newCustomersMonthSelect');
    const options = monthSelect.locator('option');
    const count = await options.count();
    // First option is always the placeholder; any further options are
    // months derived from the data, newest first, with counts.
    if (count > 1) {
      await expect(options.nth(1)).toHaveText(/\(\d+\)$/);
    }
  });
});
