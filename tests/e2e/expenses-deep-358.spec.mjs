/**
 * expenses-deep-358.spec.mjs
 * Issue #358: deep functional test of the Expenses screens.
 * Covers the flows the older expense specs do not: totals math
 * (current-month total, filtered total, dashboard figure), editing an
 * expense through the correction form, search + category filters,
 * form-draft autosave/restore/discard across a reload, salary prefill
 * buttons, and delete with its confirm dialog. Extended after the full
 * manual deep test: inline validation, payroll (Saad prefill, Umair
 * workdays, the zero-workday prefill guard), Saad attendance, CSV
 * export content/escaping/filtered export, area badges + area search,
 * and dark-mode rendering without horizontal overflow.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';

function trackErrors(page) {
  const errors = [];
  // Excluded: favicon/resource noise, and Chromium's "Blocked call to
  // navigator.vibrate" policy message, which fires on programmatic
  // reloads without a prior tap and is not an app error.
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|navigator\.vibrate/.test(m.text())) errors.push(m.text()); });
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

  test('validation: empty, zero, negative and category-less submits are rejected inline', async ({ page }) => {
    const errors = trackErrors(page);
    const rows = page.locator('#expenseTable tr');

    await page.locator('#expenseSubmit').click();
    await expect(page.locator('#expenseDateError')).toBeVisible();
    await expect(page.locator('#expenseAmountError')).toBeVisible();
    await expect(page.locator('#expenseCategoryError')).toBeVisible();
    await expect(rows).toHaveCount(0);

    await page.locator('#expenseDate').fill(await pktToday(page));
    await page.locator('#expenseAmount').fill('0');
    await page.locator('#expenseCategory').selectOption('Tools');
    await page.locator('#expenseSubmit').click();
    await expect(page.locator('#expenseAmountError')).toContainText('greater than zero');
    await expect(rows).toHaveCount(0);

    await page.locator('#expenseAmount').fill('-50');
    await page.locator('#expenseSubmit').click();
    await expect(page.locator('#expenseAmountError')).toContainText('greater than zero');
    await expect(rows).toHaveCount(0);

    await page.locator('#expenseAmount').fill('100');
    await page.locator('#expenseCategory').selectOption('');
    await page.locator('#expenseSubmit').click();
    await expect(page.locator('#expenseCategoryError')).toBeVisible();
    await expect(page.locator('#expenseAmountError')).toBeHidden();
    await expect(rows).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('payroll: Saad prefill posts salary; Umair needs a logged workday first', async ({ page }) => {
    const errors = trackErrors(page);
    const rows = page.locator('#expenseTable tr');
    const today = await pktToday(page);

    // Saad: base salary prefill (no eligible customers in a fresh state).
    await expect(page.locator('#saadMonthlySalary')).toContainText('15,000');
    await page.locator('#recordSaadSalaryExpenseBtn').click();
    await expect(page.locator('#expenseCategory')).toHaveValue('Salary — Saad');
    await expect(page.locator('#expenseAmount')).toHaveValue('15000');
    await expect(page.locator('#expensePayrollPrefillNotice')).toBeVisible();
    await page.locator('#expenseSubmit').click();
    await expect(rows).toHaveCount(1);
    await expect(page.locator('#expenseCurrentMonthTotal')).toHaveText('PKR 15,000');

    // Umair with no logged workdays: the button must explain instead of
    // prefilling a PKR 0 expense that only fails at submit (deep-test fix).
    await expect(page.locator('#umairWorkdayExpense')).toContainText('No workday entries');
    await page.locator('#recordUmairSalaryExpenseBtn').click();
    await expect(page.locator('#toast')).toContainText('No logged workdays');
    await expect(page.locator('#expenseAmount')).not.toHaveValue('0');
    await expect(page.locator('#expensePayrollPrefillNotice')).toBeHidden();
    await expect(rows).toHaveCount(1);

    // Log one workday; duplicates are rejected; then the prefill works.
    await page.locator('#umairWorkdayDate').fill(today);
    await page.locator('#umairWorkdayForm').locator('button[type="submit"]').click();
    await expect(page.locator('#umairWorkdaysList li')).toHaveCount(1);
    await expect(page.locator('#umairWorkdayExpense')).toContainText('1,000');
    await page.locator('#umairWorkdayDate').fill(today);
    await page.locator('#umairWorkdayForm').locator('button[type="submit"]').click();
    await expect(page.locator('#umairWorkdayError')).toBeVisible();
    await expect(page.locator('#umairWorkdaysList li')).toHaveCount(1);

    await page.locator('#recordUmairSalaryExpenseBtn').click();
    await expect(page.locator('#expenseAmount')).toHaveValue('1000');
    await page.locator('#expenseSubmit').click();
    await expect(rows).toHaveCount(2);
    await expect(page.locator('#expenseTable')).toContainText('Salary — Umair');
    await expect(page.locator('#expenseCurrentMonthTotal')).toHaveText('PKR 16,000');

    // Remove the workday through its confirm dialog.
    await page.locator('#umairWorkdaysList li').first().locator('[data-remove-workday]').click();
    await page.getByRole('button', { name: 'Remove workday' }).click();
    await expect(page.locator('#umairWorkdaysList li')).toHaveCount(0);
    await expect(page.locator('#umairWorkdaysEmpty')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('attendance: log, duplicate rejected, remove via confirm', async ({ page }) => {
    const errors = trackErrors(page);
    const today = await pktToday(page);
    await page.locator('#logSaadTodayBtn').click();
    await expect(page.locator('#saadAttendanceDate')).toHaveValue(today);
    await page.locator('#saadAttendanceForm').locator('button[type="submit"]').click();
    await expect(page.locator('#saadAttendanceList li')).toHaveCount(1);
    await expect(page.locator('#saadAttendanceCount')).toContainText('1 unique day');

    await page.locator('#saadAttendanceDate').fill(today);
    await page.locator('#saadAttendanceForm').locator('button[type="submit"]').click();
    await expect(page.locator('#saadAttendanceError')).toBeVisible();
    await expect(page.locator('#saadAttendanceList li')).toHaveCount(1);

    await page.locator('#saadAttendanceList li').first().locator('[data-remove-attendance]').click();
    await page.getByRole('button', { name: 'Remove day' }).click();
    await expect(page.locator('#saadAttendanceList li')).toHaveCount(0);
    await expect(page.locator('#saadAttendanceEmpty')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('CSV export: content, escaping and filtered export match the ledger', async ({ page }) => {
    const errors = trackErrors(page);
    await addExpense(page, { amount: 2500, category: 'Repairs', notes: 'Fiber, "main" road' });
    await addExpense(page, { amount: 15000, category: 'Other expenses', notes: 'Office rent' });

    async function downloadCsv() {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('#exportExpensesCsvBtn').click()
      ]);
      const path = await download.path();
      return { name: download.suggestedFilename(), body: fs.readFileSync(path, 'utf8') };
    }
    function amounts(body) {
      return body.replace(/^﻿/, '').trim().split(/\r?\n/).slice(1)
        .map(line => { const m = line.match(/,(\d+(?:\.\d+)?),/); return m ? Number(m[1]) : 0; });
    }

    const all = await downloadCsv();
    expect(all.name).toMatch(/^shahdara-expenses-all-/);
    expect(amounts(all.body)).toHaveLength(2);
    expect(amounts(all.body).reduce((a, b) => a + b, 0)).toBe(17500);
    expect(all.body).toContain('"Fiber, ""main"" road"');

    await page.locator('#expenseCategoryFilter').selectOption('Repairs');
    await expect(page.locator('#expenseTable tr')).toHaveCount(1);
    const filtered = await downloadCsv();
    expect(filtered.name).toContain('filtered');
    expect(amounts(filtered.body)).toEqual([2500]);
    expect(errors).toEqual([]);
  });

  test('area: badge renders in the table and search matches the area', async ({ page }) => {
    const errors = trackErrors(page);
    const today = await pktToday(page);
    await page.evaluate((date) => {
      const key = 'shahdara-isp-billing-v1';
      const st = JSON.parse(localStorage.getItem(key));
      if (st.customers && st.customers[0]) st.customers[0].mohalla = 'Main Chowk';
      st.expenses = [...(st.expenses || []), { id: 'area358', date, amount: 4100, category: 'Cable', notes: 'Area tagged', area: 'Main Chowk', createdAt: new Date().toISOString() }];
      localStorage.setItem(key, JSON.stringify(st));
    }, today);
    await page.reload();
    await page.goto('/#/expenses');
    await expect(page.locator('#expensesView')).toBeVisible();

    const row = page.locator('#expenseTable tr', { hasText: 'Area tagged' });
    await expect(row.locator('.expense-area-badge')).toHaveText('Main Chowk');
    await expect(page.locator('#expenseArea option', { hasText: 'Main Chowk' })).toHaveCount(1);

    await page.locator('#expenseSearchInput').fill('Main Chowk');
    await expect(page.locator('#expenseTable tr')).toHaveCount(1);
    await expect(page.locator('#expenseFilteredTotal')).toContainText('4,100');
    expect(errors).toEqual([]);
  });

  test('dark mode at desktop and mobile widths: renders, no horizontal overflow', async ({ page }) => {
    const errors = trackErrors(page);
    await addExpense(page, { amount: 2500, category: 'Repairs', notes: 'Dark check' });
    await page.evaluate(() => localStorage.setItem('shahdara_theme', 'dark'));
    await page.reload();
    await page.goto('/#/expenses');
    await expect(page.locator('#expensesView')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark');
    for (const vp of [{ width: 1366, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(vp);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      // Note: the phase3 heading is intentionally hidden at desktop
      // widths (the screen title is deduplicated there), so assert on
      // the always-rendered table content instead.
      await expect(page.locator('#expenseTable')).toContainText('Dark check');
      await expect(page.locator('#expenseTable tr').first()).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
});
