import { test, expect } from '@playwright/test';

async function navigateToExpenses(page) {
  const drawerToggle = page.locator('#navDrawerToggle');
  if (await drawerToggle.isVisible()) {
    await drawerToggle.click();
    await expect(page.locator('#navDrawer')).toBeVisible();
    await page.locator('#navDrawer [data-nav-target="expenses"]').click();
  } else {
    const topBtn = page.locator('#showExpensesButton');
    if (await topBtn.isVisible()) {
      await topBtn.click();
    }
  }
  await expect(page.locator('#expensesView')).toBeVisible();
}

test.describe('Expense Manager & Filter UX Suite E2E Verification', () => {
  test('navigates to expenses view, records expense, filters by month & category, and tests sorting', async ({ page }) => {
    await page.goto('/');

    await navigateToExpenses(page);

    const expensesView = page.locator('#expensesView');
    await expect(expensesView).toBeVisible();

    // Verify KPI metric cards
    const entryCount = page.locator('#expenseEntryCount');
    await expect(entryCount).toBeVisible();
    const currentMonthTotal = page.locator('#expenseCurrentMonthTotal');
    await expect(currentMonthTotal).toBeVisible();
    const filteredTotal = page.locator('#expenseFilteredTotal');
    await expect(filteredTotal).toBeVisible();

    // Verify filter toolbar elements
    const monthFilter = page.locator('#expenseMonthFilter');
    await expect(monthFilter).toBeVisible();
    const categoryFilter = page.locator('#expenseCategoryFilter');
    await expect(categoryFilter).toBeVisible();
    const searchInput = page.locator('#expenseSearchInput');
    await expect(searchInput).toBeVisible();
    const clearBtn = page.locator('#clearExpenseFilters');
    await expect(clearBtn).toBeVisible();
    const exportCsvBtn = page.locator('#exportExpensesCsvBtn');
    await expect(exportCsvBtn).toBeVisible();

    // Record a new expense
    const today = new Date().toISOString().slice(0, 10);
    await page.fill('#expenseDate', today);
    await page.fill('#expenseAmount', '4500');
    await page.selectOption('#expenseCategory', 'Electricity');
    await page.fill('#expenseNotes', 'Shahdara office backup generator fuel');
    await page.click('#expenseSubmit');

    // Confirm row appears in table
    const table = page.locator('#expenseTable');
    await expect(table).toContainText('Electricity');
    await expect(table).toContainText('PKR 4,500');
    await expect(table).toContainText('Shahdara office backup generator fuel');

    // Record a second expense in a different category
    await page.fill('#expenseDate', today);
    await page.fill('#expenseAmount', '12000');
    await page.selectOption('#expenseCategory', 'Nayatel bill');
    await page.fill('#expenseNotes', 'Upstream optical transport bandwidth');
    await page.click('#expenseSubmit');

    await expect(table).toContainText('Nayatel bill');
    await expect(table).toContainText('PKR 12,000');

    // Test Category Filter
    await categoryFilter.selectOption('Electricity');
    await expect(table).toContainText('Electricity');
    await expect(table).not.toContainText('Nayatel bill');
    await expect(filteredTotal).toContainText('PKR 4,500');

    // Clear filters
    await clearBtn.click();
    await expect(categoryFilter).toHaveValue('all');
    await expect(table).toContainText('Electricity');
    await expect(table).toContainText('Nayatel bill');

    // Test Search input
    await searchInput.fill('upstream');
    await expect(table).toContainText('Nayatel bill');
    await expect(table).not.toContainText('Electricity');
    await expect(filteredTotal).toContainText('PKR 12,000');

    await clearBtn.click();
    await expect(searchInput).toHaveValue('');

    // Test Month Filter
    const currentMonthVal = today.slice(0, 7);
    await monthFilter.selectOption(currentMonthVal);
    await expect(table).toContainText('Electricity');
    await expect(table).toContainText('Nayatel bill');

    // Test Sorting by Amount
    const sortAmountTh = page.locator('th[data-sort-expense="amount"]');
    await sortAmountTh.click();
    const rows = table.locator('tr');
    // Amount descending: first row should have 12,000
    await expect(rows.first()).toContainText('Nayatel bill');

    // Reverse sort
    await sortAmountTh.click();
    // Amount ascending: first row should have 4,500
    await expect(rows.first()).toContainText('Electricity');
  });

  test('verifies mobile responsive layout (390x844) and touch target sizing', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await navigateToExpenses(page);

    const expensesView = page.locator('#expensesView');
    await expect(expensesView).toBeVisible();

    // Verify touch targets on filter toolbar controls are at least 42px high
    const monthFilter = page.locator('#expenseMonthFilter');
    const monthBox = await monthFilter.boundingBox();
    expect(monthBox).not.toBeNull();
    expect(monthBox.height).toBeGreaterThanOrEqual(42);

    const clearBtn = page.locator('#clearExpenseFilters');
    const clearBox = await clearBtn.boundingBox();
    expect(clearBox).not.toBeNull();
    expect(clearBox.height).toBeGreaterThanOrEqual(42);

    // Verify zero horizontal scroll overflow
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);
  });

  test('verifies dark mode theme styling on expense filters and action buttons', async ({ page }) => {
    await page.goto('/');

    await navigateToExpenses(page);

    // Toggle dark mode
    const themeBtn = page.locator('#themeToggleBtn');
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
    } else {
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    }

    const htmlTheme = await page.locator('html').getAttribute('data-theme');
    expect(htmlTheme).toBe('dark');

    // Scoped to expenses view filter toolbar
    const toolbar = page.locator('#expensesView .table-filter-toolbar');
    await expect(toolbar).toBeVisible();
    const toolbarBg = await toolbar.evaluate(el => window.getComputedStyle(el).backgroundColor);
    // Dark theme background is rgb(24, 45, 39)
    expect(toolbarBg).toBe('rgb(24, 45, 39)');
  });
});
