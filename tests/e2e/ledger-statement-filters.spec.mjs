import { test, expect } from '@playwright/test';

// Customer ledger statement filters: the statement modal (CUSTOMER ACCOUNT
// LEDGER) previously offered only a time-range filter. These specs cover the
// new entry-type, billing-month and search filters plus Clear, without
// depending on any particular customer's data: the search assertions use a
// guaranteed non-matching query, so they hold on empty and populated ledgers.
test.describe('Customer Ledger Statement Filters', () => {
  test.beforeEach(async ({ page }) => {
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
  });

  test('filter controls exist with all entry types and an all-months default', async ({ page }) => {
    const typeFilter = page.locator('#statementTypeFilter');
    await expect(typeFilter).toBeVisible();
    await expect(typeFilter.locator('option')).toHaveCount(5);
    await expect(typeFilter).toHaveValue('all');
    const monthFilter = page.locator('#statementMonthFilter');
    await expect(monthFilter).toBeVisible();
    await expect(monthFilter).toHaveValue('all');
    await expect(monthFilter.locator('option').first()).toHaveText('All months');
    await expect(page.locator('#statementSearchInput')).toBeVisible();
    await expect(page.locator('#clearStatementFilters')).toBeVisible();
  });

  test('search with no match shows the filtered empty state, clear restores the view', async ({ page }) => {
    const search = page.locator('#statementSearchInput');
    await search.fill('zzz-no-such-entry');
    await expect(page.locator('#statementPreviewContainer')).toContainText('No entries match these filters');
    await expect(page.locator('#statementPreviewContainer .statement-filter-note')).toBeVisible();
    await page.locator('#clearStatementFilters').click();
    await expect(page.locator('#statementPreviewContainer')).not.toContainText('No entries match these filters');
    await expect(search).toHaveValue('');
    await expect(page.locator('#statementTypeFilter')).toHaveValue('all');
    await expect(page.locator('#statementMonthFilter')).toHaveValue('all');
  });

  test('changing the entry-type filter shows a filter note and never breaks the table', async ({ page }) => {
    await page.locator('#statementTypeFilter').selectOption('payment');
    await expect(page.locator('#statementPreviewContainer .statement-filter-note')).toBeVisible();
    await expect(page.locator('#statementPreviewContainer .statement-filter-note')).toContainText('CSV / WhatsApp exports cover only the visible entries');
    await expect(page.locator('#statementPreviewContainer .statement-table')).toBeVisible();
    // Period totals in the summary strip stay visible under any filter.
    await expect(page.locator('#statementPreviewContainer .statement-summary-strip')).toBeVisible();
  });
});
