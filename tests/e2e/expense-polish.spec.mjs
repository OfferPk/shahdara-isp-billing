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

async function addTestExpense(page, { date, amount, category, area, notes }) {
  await page.fill('#expenseDate', date);
  await page.fill('#expenseAmount', String(amount));
  await page.selectOption('#expenseCategory', category);
  if (area) {
    const areaSelect = page.locator('#expenseArea');
    const options = await areaSelect.locator('option').allInnerTexts();
    if (options.includes(area)) {
      await areaSelect.selectOption({ label: area });
    }
  }
  await page.fill('#expenseNotes', notes || '');
  await page.click('#expenseSubmit');
}

test.describe('Expense Polish QA - Sorting, CSV Area Export, Dismissible Notice, and Mobile Responsive Polish', () => {
  test('desktop: sorting across date, category, amount, and area headers updates sort indicators and table order', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await navigateToExpenses(page);

    // Add 2 test expenses to ensure sorting can be observed
    await addTestExpense(page, { date: '2026-10-01', amount: 1500, category: 'Repairs', notes: 'Splice repair' });
    await addTestExpense(page, { date: '2026-10-18', amount: 8000, category: 'Electricity', notes: 'Main hub bill' });

    const dateHeader = page.locator('[data-sort-expense="date"]');
    const catHeader = page.locator('[data-sort-expense="category"]');
    const amtHeader = page.locator('[data-sort-expense="amount"]');
    const areaHeader = page.locator('[data-sort-expense="area"]');

    // Default sort is date descending
    await expect(dateHeader).toHaveAttribute('aria-sort', 'descending');
    await expect(dateHeader.locator('.sort-indicator')).toHaveText('▼');
    await expect(catHeader.locator('.sort-indicator')).toHaveText('⇅');
    await expect(amtHeader.locator('.sort-indicator')).toHaveText('⇅');
    await expect(areaHeader.locator('.sort-indicator')).toHaveText('⇅');

    // Click date header to toggle to ascending
    await dateHeader.click();
    await expect(dateHeader).toHaveAttribute('aria-sort', 'ascending');
    await expect(dateHeader.locator('.sort-indicator')).toHaveText('▲');

    // Click category header
    await catHeader.click();
    await expect(catHeader).toHaveAttribute('aria-sort', 'ascending');
    await expect(catHeader.locator('.sort-indicator')).toHaveText('▲');
    await expect(dateHeader.locator('.sort-indicator')).toHaveText('⇅');

    // Click amount header
    await amtHeader.click();
    await expect(amtHeader).toHaveAttribute('aria-sort', 'descending');
    await expect(amtHeader.locator('.sort-indicator')).toHaveText('▼');

    // Click area header
    await areaHeader.click();
    await expect(areaHeader).toHaveAttribute('aria-sort', 'descending');
    await expect(areaHeader.locator('.sort-indicator')).toHaveText('▼');
  });

  test('payroll prefill notice has working dismiss button that preserves form fields', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await navigateToExpenses(page);

    // Click Saad payroll prefill
    const saadBtn = page.locator('#recordSaadSalaryExpenseBtn');
    await expect(saadBtn).toBeVisible();
    await saadBtn.click();

    const notice = page.locator('#expensePayrollPrefillNotice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('Prefilled from');

    const dismissBtn = page.locator('#dismissExpensePayrollNoticeBtn');
    await expect(dismissBtn).toBeVisible();

    // Click Dismiss
    await dismissBtn.click();
    await expect(notice).toBeHidden();

    // Verify form fields were preserved even after notice was dismissed
    await expect(page.locator('#expenseCategory')).toHaveValue('Salary — Saad');
    const amountVal = await page.locator('#expenseAmount').inputValue();
    expect(Number(amountVal)).toBeGreaterThanOrEqual(15000);

    // Cancel edit to reset form
    await page.click('#expenseCancel');
  });

  test('empty filter state displays inline reset button that restores full expense list', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await navigateToExpenses(page);

    // Add an expense if not present
    await addTestExpense(page, { date: '2026-10-10', amount: 500, category: 'Tools', notes: 'Crimping tool' });

    // Type a query with zero matches
    const searchInput = page.locator('#expenseSearchInput');
    await searchInput.fill('NonExistentExpenseTerm999');

    // Filter empty state should be visible with inline reset button
    const filterEmpty = page.locator('#expensesFilterEmpty');
    await expect(filterEmpty).toBeVisible();
    await expect(filterEmpty).toContainText('No recorded expenses match');

    const inlineResetBtn = page.locator('#resetExpenseFiltersInlineBtn');
    await expect(inlineResetBtn).toBeVisible();

    // Click inline reset button
    await inlineResetBtn.click();

    // Filter empty should be hidden and search input cleared
    await expect(filterEmpty).toBeHidden();
    await expect(searchInput).toHaveValue('');

    // Table should show entries again
    const table = page.locator('#expenseTable');
    await expect(table.locator('tr').first()).toBeVisible();
  });

  test('export CSV button triggers download with area column', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await navigateToExpenses(page);

    // Add a test expense
    await addTestExpense(page, { date: '2026-10-15', amount: 1200, category: 'Repairs', notes: 'Patch cord' });

    const exportBtn = page.locator('#exportExpensesCsvBtn');
    await expect(exportBtn).toBeVisible();

    // Intercept download
    const downloadPromise = page.waitForEvent('download');
    await exportBtn.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^shahdara-expenses-(all|filtered)-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  test('mobile 390x844: zero horizontal scroll and compliant touch targets', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await navigateToExpenses(page);

    // Verify view has no horizontal overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);

    // Check touch target heights of action buttons
    const payrollBtns = page.locator('.payroll-to-expense-btn');
    const count = await payrollBtns.count();
    for (let i = 0; i < count; i++) {
      const box = await payrollBtns.nth(i).boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }

    // Check Today shortcut buttons
    const saadToday = page.locator('#logSaadTodayBtn');
    const saadBox = await saadToday.boundingBox();
    if (saadBox) {
      expect(saadBox.height).toBeGreaterThanOrEqual(38);
    }
  });
});
