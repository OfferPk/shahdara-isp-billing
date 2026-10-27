// Customer statement, second enhancement round: method filter, sort,
// month subtotals, aging, trend chart and row detail. Written to run in CI
// (the repo Playwright runner cannot run in the dev VM). Assertions avoid
// depending on any particular customer's data: seeded ledgers vary, so the
// specs read the rendered rows and check self-consistent properties (sort
// order, block presence, detail dialog) rather than fixed amounts.
import { test, expect } from '@playwright/test';

async function openStatement(page) {
  await page.goto('/#customers');
  const firstCustomerBtn = page.locator('#customerList [data-customer-id]').first();
  await expect(firstCustomerBtn).toBeVisible();
  await firstCustomerBtn.click();
  await expect(page.locator('#customerDetail')).toBeVisible();
  const openStatementBtn = page.locator('#openAccountStatementBtn');
  await expect(openStatementBtn).toBeVisible();
  await openStatementBtn.click();
  await expect(page.locator('#accountStatementModal')).toBeVisible();
  await expect(page.locator('#statementPreviewContainer')).toBeVisible();
}

async function statementRows(page) {
  return page.evaluate(() => [...document.querySelectorAll('tr[data-statement-row]')].map((row) => ({
    date: row.querySelector('.col-date')?.textContent.trim() || '',
    hasOverdueBadge: !!row.querySelector('.statement-overdue-badge')
  })));
}

test.describe('Customer Ledger Statement Enhancements (round 2)', () => {
  test.beforeEach(async ({ page }) => {
    await openStatement(page);
  });

  test('method filter and sort controls exist with the right defaults', async ({ page }) => {
    const methodFilter = page.locator('#statementMethodFilter');
    await expect(methodFilter).toBeVisible();
    await expect(methodFilter).toHaveValue('all');
    await expect(methodFilter.locator('option').first()).toHaveText('All methods');
    const sortSelect = page.locator('#statementSortSelect');
    await expect(sortSelect).toBeVisible();
    await expect(sortSelect).toHaveValue('date-asc');
    await expect(sortSelect.locator('option')).toHaveCount(4);
  });

  test('trend and aging blocks render; month subtotals render when rows exist', async ({ page }) => {
    await expect(page.locator('#statementPreviewContainer .statement-trend')).toBeVisible();
    await expect(page.locator('#statementPreviewContainer .statement-aging')).toBeVisible();
    const rows = await statementRows(page);
    if (rows.length > 0) {
      await expect(page.locator('#statementPreviewContainer .statement-month-subtotals')).toBeVisible();
    }
  });

  test('sort newest-first orders rows by non-increasing date without losing rows', async ({ page }) => {
    const before = await statementRows(page);
    if (before.length < 2) test.skip(true, 'ledger has fewer than two rows; sort order is trivially satisfied');
    await page.locator('#statementSortSelect').selectOption('date-desc');
    const after = await statementRows(page);
    expect(after.length).toBe(before.length);
    const dates = after.map((r) => r.date);
    const sorted = [...dates].sort().reverse();
    expect(dates).toEqual(sorted);
    // Clear restores the default order.
    await page.locator('#clearStatementFilters').click();
    await expect(page.locator('#statementSortSelect')).toHaveValue('date-asc');
    const cleared = await statementRows(page);
    expect(cleared.length).toBe(before.length);
  });

  test('method filter narrows the view without breaking the table', async ({ page }) => {
    const methods = await page.evaluate(() => [...document.querySelectorAll('#statementMethodFilter option')].map((o) => o.value));
    const pick = methods.find((m) => m !== 'all');
    if (!pick) {
      await expect(page.locator('#statementPreviewContainer .statement-table')).toBeVisible();
      return;
    }
    await page.locator('#statementMethodFilter').selectOption(pick);
    await expect(page.locator('#statementPreviewContainer .statement-table')).toBeVisible();
    await expect(page.locator('#statementPreviewContainer .statement-filter-note')).toBeVisible();
    await page.locator('#clearStatementFilters').click();
    await expect(page.locator('#statementMethodFilter')).toHaveValue('all');
  });

  test('clicking a row opens its detail; an overdue bill offers Schedule Promise', async ({ page }) => {
    const rows = await statementRows(page);
    if (rows.length === 0) test.skip(true, 'ledger is empty; no row to open');
    const overdueIndex = rows.findIndex((r) => r.hasOverdueBadge);
    const target = overdueIndex >= 0 ? overdueIndex : 0;
    await page.locator(`tr[data-statement-row="${target}"]`).first().click();
    await expect(page.locator('#statementEventDetailModal')).toBeVisible();
    await expect(page.locator('#statementEventDetailBody')).toContainText('Running balance');
    if (overdueIndex >= 0) {
      await expect(page.locator('#statementDetailSchedulePromiseBtn')).toBeVisible();
    } else {
      await expect(page.locator('#statementDetailSchedulePromiseBtn')).toBeHidden();
    }
    await page.locator('#closeStatementDetailBtn').click();
    await expect(page.locator('#statementEventDetailModal')).toBeHidden();
  });
});
