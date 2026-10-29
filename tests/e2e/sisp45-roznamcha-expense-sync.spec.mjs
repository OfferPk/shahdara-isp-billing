// SISP-45: Roznamcha Petty Cash ↔ Monthly Expenses Auto-Sync.
// Written to run in CI (the repo Playwright runner cannot run in the dev
// VM). Seeds one synthetic roznamcha day (today, PKT) holding a Rs. 600
// Petrol / Bike Fuel outflow into sisp_roznamcha_v1, then checks, at a
// real 360px viewport:
//   - after reload, the startup sync pass has mirrored the outflow into
//     the Expenses ledger exactly once (state key shahdara-isp-billing-v1
//     holds one expense with roznamchaEntryId = the outflow id);
//   - the Expenses view lists the synced row under its mapped category
//     (Other expenses) with the Roznamcha provenance badge and NO
//     Edit/Delete buttons (the roznamcha is the source of truth);
//   - a second reload still shows exactly one mirrored row (the sync is
//     idempotent — re-running it can never duplicate the expense).
import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) errors.push(m.text()); });
  return errors;
}

async function boot(page) {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/#/home');
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

async function seedRoznamchaDay(page) {
  await page.evaluate(() => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
    localStorage.setItem('sisp_roznamcha_v1', JSON.stringify([{
      date: today,
      closed: false,
      outflows: [{ id: 'out-e2e-600', category: 'Petrol / Bike Fuel', amount: 600, lineman: 'E2E Lineman', note: 'Bike petrol' }]
    }]));
  });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

async function mirroredExpenses(page) {
  return page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('shahdara-isp-billing-v1') || '{}');
    return (state.expenses || []).filter((e) => e.roznamchaEntryId === 'out-e2e-600');
  });
}

async function openExpenses(page) {
  const drawerToggle = page.locator('#navDrawerToggle');
  if (await drawerToggle.isVisible()) {
    await drawerToggle.click();
    await expect(page.locator('#navDrawer')).toBeVisible();
    await page.locator('#navDrawer [data-nav-target="expenses"]').click();
  } else {
    await page.locator('#showExpensesButton').click();
  }
  await expect(page.locator('#expensesView')).toBeVisible();
}

test('roznamcha petrol outflow mirrors into Expenses exactly once with provenance and no edit/delete', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedRoznamchaDay(page);

  const mirrored = await mirroredExpenses(page);
  expect(mirrored).toHaveLength(1);
  expect(mirrored[0].amount).toBe(600);
  expect(mirrored[0].category).toBe('Other expenses');
  expect(mirrored[0].source).toBe('roznamcha');
  expect(mirrored[0].roznamchaCategory).toBe('Petrol / Bike Fuel');

  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  expect(await mirroredExpenses(page)).toHaveLength(1);

  await openExpenses(page);
  const rows = page.locator('#expenseTable tr');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Other expenses');
  await expect(rows.first()).toContainText('600');
  await expect(rows.first().locator('.expense-roznamcha-badge')).toHaveCount(1);
  await expect(rows.first().locator('[data-edit-expense]')).toHaveCount(0);
  await expect(rows.first().locator('[data-delete-expense]')).toHaveCount(0);
  expect(errors).toEqual([]);
});
