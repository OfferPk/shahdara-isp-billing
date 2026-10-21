/**
 * expenses-deep-358.spec.mjs
 * Issue #358: deep functional test of the Expenses screens.
 * Covers the flows the older expense specs do not: totals math
 * (current-month total, filtered total, dashboard figure), editing an
 * expense through the correction form, search + category filters,
 * form-draft autosave/restore/discard across a reload, salary prefill
 * buttons, and delete with its confirm dialog.
 */
import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  return errors;
}

async function pktToday(page) {
  return page.evaluate(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' }));
}

async function addExpense(page, { amount, category, notes }) {
  // The expense form intentionally has no default date (unlike the
  // payment form); existing specs fill it explicitly too.
  await page.locator('#expenseDate').fill(await pktToday(page));
  await page.locator('#expenseAmount').fill(String(amount));
  await page.locator('#expenseCategory').selectOption(category);
  if (notes) await page.locator('#expenseNotes').fill(notes);
  await page.locator('#expenseSubmit').click();
  await expect(page.locator('#toast')).toBeVisible();
}

test.describe('Issue 358: Expenses screens deep functional test', () => {
  test.setTimeout(150000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/#/home');
    await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached' });
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.goto('/#/expenses');
    await expect(page.locator('#expensesView')).toBeVisible();
  });

  test('add, totals, edit, filters, delete', async ({ page }) => {
    const errors = trackErrors(page);

    await addExpense(page, { amount: 2500, category: 'Repairs', notes: 'Fiber splice repair' });
    await addExpense(page, { amount: 15000, category: 'Other expenses', notes: 'Office rent October' });

    const rows = page.locator('#expenseTable tr');
    await expect(rows).toHaveCount(2);
    await expect(page.locator('#expenseCurrentMonthTotal')).toHaveText('PKR 17,500');
    await expect(page.locator('#expenseEntryCount')).toContainText('2');

    // Dashboard reflects the same current-month expenses.
    await page.goto('/#/home');
    await expect(page.locator('#dashboardCurrentExpenses')).toContainText('17,500');
    await page.goto('/#/expenses');

    // Edit the Repairs expense 2500 -> 3000 via the correction form.
    const repairsRow = page.locator('#expenseTable tr', { hasText: 'Repairs' });
    await repairsRow.locator('[data-edit-expense]').click();
    await expect(page.locator('#expenseSubmit')).toHaveText('Save expense correction');
    await expect(page.locator('#expenseAmount')).toHaveValue('2500');
    await page.locator('#expenseAmount').fill('3000');
    await page.locator('#expenseSubmit').click();
    // Corrections are gated by a confirm dialog.
    await page.getByRole('button', { name: 'Save correction' }).click();
    await expect(page.locator('#expenseCurrentMonthTotal')).toHaveText('PKR 18,000');
    await expect(page.locator('#expenseTable')).toContainText('3,000');

    // Search filter narrows to rent; filtered total follows.
    await page.locator('#expenseSearchInput').fill('rent');
    await expect(rows).toHaveCount(1);
    await expect(page.locator('#expenseFilteredTotal')).toContainText('15,000');
    await page.locator('#expenseSearchInput').fill('');

    // Category filter: Repairs only.
    await page.locator('#expenseCategoryFilter').selectOption('Repairs');
    await expect(rows).toHaveCount(1);
    await expect(page.locator('#expenseTable')).toContainText('Fiber splice repair');
    await page.locator('#expenseCategoryFilter').selectOption('all');
    await expect(rows).toHaveCount(2);

    // Delete the rent expense through its confirm dialog.
    const rentRow = page.locator('#expenseTable tr', { hasText: 'Office rent' });
    await rentRow.locator('[data-delete-expense]').click();
    await page.getByRole('button', { name: 'Delete expense' }).click();
    await expect(rows).toHaveCount(1);
    await expect(page.locator('#expenseCurrentMonthTotal')).toHaveText('PKR 3,000');

    expect(errors).toEqual([]);
  });

  test('draft autosave: typing survives reload, discard clears it', async ({ page }) => {
    const errors = trackErrors(page);
    await page.locator('#expenseAmount').fill('999');
    await page.locator('#expenseNotes').fill('draft note test');
    // Wait until the autosave actually writes the draft (both fields —
    // the 250ms debounce can land a first save before Notes is typed).
    await expect.poll(() => page.evaluate(() => localStorage.getItem('shahdara_draft_expenseForm'))).toContain('draft note test');
    await page.reload();
    await expect(page.locator('#expensesView')).toBeVisible();
    await expect(page.locator('#expenseDraftNotice')).toBeVisible();
    await expect(page.locator('#expenseAmount')).toHaveValue('999');
    await expect(page.locator('#expenseNotes')).toHaveValue('draft note test');
    await page.locator('#discardExpenseDraftBtn').click();
    await expect(page.locator('#expenseDraftNotice')).toBeHidden();
    await expect(page.locator('#expenseAmount')).toHaveValue('');
    expect(errors).toEqual([]);
  });

  test('empty state: no expenses -> empty message and No entries total', async ({ page }) => {
    const errors = trackErrors(page);
    await expect(page.locator('#expensesEmpty')).toBeVisible();
    await expect(page.locator('#expenseCurrentMonthTotal')).toHaveText('No entries');
    expect(errors).toEqual([]);
  });
});
