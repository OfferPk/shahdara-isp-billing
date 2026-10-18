import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) {
      errors.push(m.text());
    }
  });
  return errors;
}

test.describe('Issue #255: Collect badge synchronization with actual pending dues', () => {
  test('Collect badge shows 74 after bills are created and drops to 71 when 3 payments are saved (persists across reload)', async ({ page }) => {
    const errors = trackErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // 1. Create bills of PKR 1,000 for all 74 customers
    await page.evaluate(async () => {
      const core = await import('./core.js');
      let s = JSON.parse(localStorage.getItem(core.STORAGE_KEY)) || core.createInitialState();
      const month = new Date().toISOString().slice(0, 7);
      for (const c of s.customers) {
        if (!c.archived) {
          s = core.saveBillMonth(s, c.id, { month, dueAmount: 1000, status: 'pending' });
        }
      }
      localStorage.setItem(core.STORAGE_KEY, JSON.stringify(s));
    });

    await page.reload();
    await page.waitForTimeout(300);

    // Collect badge on mobile bottom nav should be 74
    const badge = page.locator('#bottomNavBadgeCollection');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('74');

    // 2. Open Quick Collect, then Bulk Collect Cash
    await page.locator('#quickAddPaymentButton').click();
    const qcModal = page.locator('#quickCollectModal');
    await expect(qcModal).toBeVisible();

    await page.locator('#openBulkCollectBtn').click();
    const bcModal = page.locator('#bulkCollectModal');
    await expect(bcModal).toBeVisible();

    // Pick 3 customers in Bulk Collect
    const cards = bcModal.locator('.bc-pick-card');
    await expect(cards.first()).toBeVisible();
    await cards.nth(0).click();
    await cards.nth(1).click();
    await cards.nth(2).click();

    await page.locator('#bulkCollectAddBtn').click();
    await expect(page.locator('#bulkCollectCount')).toHaveText('3 customers');

    // Click Save payments
    await page.locator('#bulkCollectSaveBtn').click();
    await expect(page.locator('#bulkCollectStatus')).toContainText('3 payments saved');

    // Close Bulk Collect modal
    await page.locator('#closeBulkCollectBtn').click();
    await expect(bcModal).toBeHidden();
    await expect(qcModal).toBeHidden();

    // 3. Verify Collect badge dropped to 71
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('71');

    // 4. Reload page and assert Collect badge remains 71
    await page.reload();
    await page.waitForTimeout(300);
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('71');

    expect(errors).toEqual([]);
  });
});

test.describe('Issue #257: Expenses screen mobile layout and separated cards', () => {
  test('separates Add Expense and Recorded Expenses cards, eliminates 240px blank gap, and wires + Add Expense CTA', async ({ page }) => {
    const errors = trackErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // Navigate to Expenses
    await page.evaluate(() => {
      window.location.hash = '#/expenses';
    });
    await page.waitForTimeout(300);

    const addCard = page.locator('section[aria-labelledby="addExpenseHeading"]');
    const recCard = page.locator('section[aria-labelledby="recordedExpensesHeading"]');

    await expect(addCard).toBeVisible();
    await expect(addCard.locator('#addExpenseHeading')).toHaveText('Add or correct an expense');
    await expect(addCard.locator('#expenseForm')).toBeVisible();

    await expect(recCard).toBeVisible();
    await expect(recCard.locator('#recordedExpensesHeading')).toHaveText('Recorded expenses');
    await expect(recCard.locator('.table-filter-toolbar')).toBeVisible();
    await expect(recCard.locator('#expenseTable')).toBeAttached();

    // Verify search group height is compact (< 110px, eliminating the 240px tall gap)
    const sgBox = await recCard.locator('.table-filter-group.search-group').boundingBox();
    expect(sgBox).not.toBeNull();
    expect(sgBox.height).toBeLessThan(110);

    // Verify empty state CTA
    const addCta = recCard.locator('#scrollToAddExpenseBtn');
    await expect(addCta).toBeVisible();
    await addCta.click();

    // Verify #expenseForm is in view and amount input is focused
    await expect(addCard.locator('#expenseForm')).toBeInViewport();

    expect(errors).toEqual([]);
  });
});

test.describe('Issue #256: Customers desktop view prompt, live stats, and 390px column', () => {
  test('displays helpful prompt with live stats and wide customer column on desktop', async ({ page }) => {
    const errors = trackErrors(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Navigate to Customers
    await page.evaluate(() => {
      window.location.hash = '#/customers';
    });
    await page.waitForTimeout(300);

    // Customer pane should have spacious width (>= 360px)
    const paneBox = await page.locator('.customer-pane').boundingBox();
    expect(paneBox).not.toBeNull();
    expect(paneBox.width).toBeGreaterThanOrEqual(360);

    // Welcome card verification
    const welcome = page.locator('#welcomeState');
    await expect(welcome).toBeVisible();
    await expect(welcome.locator('.eyebrow')).toHaveText('SUBSCRIBER DIRECTORY');
    await expect(welcome.locator('h2')).toHaveText('Select a customer to view ledger');

    // Quick stats verification
    await expect(welcome.locator('#welcomeCount')).toHaveText('74');
    await expect(welcome.locator('#welcomePendingCount')).toBeVisible();
    await expect(welcome.locator('#welcomeTotalDues')).toBeVisible();

    expect(errors).toEqual([]);
  });
});
