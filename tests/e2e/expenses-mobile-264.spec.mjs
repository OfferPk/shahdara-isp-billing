import { test, expect } from '@playwright/test';

async function navigateToScreen(page, screen) {
  await page.goto(`/#/${screen}`);
  await page.waitForTimeout(300);
  if (screen === 'expenses') {
    await expect(page.locator('#expensesView')).toBeVisible();
  } else if (screen === 'transactions') {
    await expect(page.locator('#transactionsView')).toBeVisible();
  }
}

test.describe('Issue #264: Mobile Expenses & Screen Title Polish QA Suite', () => {
  test('search box placeholder fits without truncation and action buttons wrap below on mobile', async ({ page, isMobile }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await navigateToScreen(page, 'expenses');

    const searchInput = page.locator('#expenseSearchInput');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute('placeholder', 'Search notes…');

    const clearBtn = page.locator('#clearExpenseFilters');
    const exportBtn = page.locator('#exportExpensesCsvBtn');
    await expect(clearBtn).toBeVisible();
    await expect(exportBtn).toBeVisible();

    if (isMobile) {
      // Search input should span full width of the search group on mobile
      const inputWidth = await searchInput.evaluate(el => el.getBoundingClientRect().width);
      const searchGroup = page.locator('#expensesView .table-filter-group.search-group');
      const groupWidth = await searchGroup.evaluate(el => el.getBoundingClientRect().width);
      expect(inputWidth).toBeGreaterThan(groupWidth * 0.9);

      // Clear and Export CSV buttons should sit below the search input
      const inputBottom = await searchInput.evaluate(el => el.getBoundingClientRect().bottom);
      const clearTop = await clearBtn.evaluate(el => el.getBoundingClientRect().top);
      const exportTop = await exportBtn.evaluate(el => el.getBoundingClientRect().top);

      expect(clearTop).toBeGreaterThanOrEqual(inputBottom - 2);
      expect(exportTop).toBeGreaterThanOrEqual(inputBottom - 2);

      // Buttons touch targets >= 44px
      const clearBox = await clearBtn.boundingBox();
      const exportBox = await exportBtn.boundingBox();
      expect(clearBox.height).toBeGreaterThanOrEqual(44);
      expect(exportBox.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('empty state is a padded card clear of the floating action button (+ FAB)', async ({ page, isMobile }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await navigateToScreen(page, 'expenses');

    // Stray count bar is hidden when empty
    const countBadge = page.locator('#expenseTableCount');
    await expect(countBadge).toBeHidden();

    // Empty state card is visible with friendly Urdu + English prompt
    const emptyCard = page.locator('#expensesEmpty');
    await expect(emptyCard).toBeVisible();
    await expect(emptyCard).toContainText('Abhi koi kharcha record nahi');
    await expect(emptyCard).toContainText('+ Add Expense');

    if (isMobile) {
      // Floating action button (#speedDialTrigger) does NOT overlap the empty state text
      const fab = page.locator('#speedDialTrigger');
      await expect(fab).toBeVisible();

      await emptyCard.scrollIntoViewIfNeeded();
      const fabBox = await fab.boundingBox();
      const textBottom = await emptyCard.evaluate(el => {
        const p = el.querySelector('.empty-secondary') || el;
        return p.getBoundingClientRect().bottom;
      });

      // The text inside the empty card ends above the bottom of the card and above the FAB area
      expect(textBottom).toBeLessThan(fabBox.y + 10);
    }

    // Assert zero horizontal overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);
  });

  test('expense items render as responsive cards with sortable chips and 0 horizontal overflow', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await navigateToScreen(page, 'expenses');

    // Record test expenses
    await page.fill('#expenseDate', '2026-10-18');
    await page.fill('#expenseAmount', '4500');
    await page.selectOption('#expenseCategory', 'Electricity');
    await page.fill('#expenseNotes', 'Shahdara office backup generator fuel');
    await page.click('#expenseSubmit');

    await page.fill('#expenseDate', '2026-10-15');
    await page.fill('#expenseAmount', '18000');
    await page.selectOption('#expenseCategory', 'Nayatel bill');
    await page.fill('#expenseNotes', 'Upstream optical transport bandwidth');
    await page.click('#expenseSubmit');

    const table = page.locator('#expenseTable');
    await expect(table).toContainText('Electricity');
    await expect(table).toContainText('Nayatel bill');

    // Count badge is now visible with accurate count
    const countBadge = page.locator('#expenseTableCount');
    await expect(countBadge).toBeVisible();
    await expect(countBadge).toContainText('2 expenses');

    // Test sort chips
    const amountSortChip = page.locator('[data-sort-expense="amount"]');
    await expect(amountSortChip).toBeVisible();
    await amountSortChip.click();

    // Highest amount first (Nayatel bill: 18,000)
    const cards = table.locator('tr');
    await expect(cards.first()).toContainText('Nayatel bill');

    // Action buttons on card are accessible with touch target >= 44px
    const editBtn = cards.first().locator('.edit-payment');
    const editBox = await editBtn.boundingBox();
    expect(editBox.height).toBeGreaterThanOrEqual(44);

    // Verify zero horizontal scroll overflow with cards present
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);
  });

  test('deduplicated screen titles on Expenses and Transactions in screen mode', async ({ page }) => {
    await page.goto('/');
    await navigateToScreen(page, 'expenses');

    // Screen header is visible with title and subtitle
    const srTitle = page.locator('#srScreenTitle');
    await expect(srTitle).toHaveText('Expenses');
    const srSubtitle = page.locator('#srScreenSubtitle');
    await expect(srSubtitle).toHaveText('Business expenses and payroll');

    // Duplicate h2 inside the phase3-heading is hidden in screen mode
    const duplicateExpensesHeading = page.locator('#expensesView .phase3-heading h2');
    await expect(duplicateExpensesHeading).toBeHidden();

    // Check Transactions screen
    await navigateToScreen(page, 'transactions');
    await expect(srTitle).toHaveText('Transactions');
    await expect(srSubtitle).toHaveText('Every saved payment, newest first');

    const duplicateTxHeading = page.locator('#transactionsView .transactions-heading h2');
    await expect(duplicateTxHeading).toBeHidden();
    const duplicateTxSubtitle = page.locator('#transactionsView .transactions-heading .transactions-subtitle');
    await expect(duplicateTxSubtitle).toBeHidden();
  });

  test('dark theme readability on toolbar and empty state', async ({ page }) => {
    await page.goto('/');
    await navigateToScreen(page, 'expenses');

    // Enable dark theme
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // Empty state card background is dark surface
    const emptyCard = page.locator('#expensesEmpty');
    const emptyBg = await emptyCard.evaluate(el => window.getComputedStyle(el).backgroundColor);
    expect(emptyBg).toBe('rgb(20, 36, 31)'); // #14241f

    // Toolbar background is dark surface
    const toolbar = page.locator('#expensesView .table-filter-toolbar');
    const toolbarBg = await toolbar.evaluate(el => window.getComputedStyle(el).backgroundColor);
    expect(toolbarBg).toBe('rgb(24, 45, 39)'); // #182d27
  });
});
