// Home Budget: the owner's personal household ledger, kept fully apart from
// the business expense ledger. Written to run in CI (the repo Playwright
// runner cannot run in the dev VM). Records one default-category entry and
// one custom-category entry through the form, then checks the list, the
// always-visible all-time total, the month filter, and no horizontal
// overflow at 390px.
import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) errors.push(m.text()); });
  return errors;
}

async function boot(page) {
  await page.goto('/#/home');
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

test('home budget records entries, totals, and a custom category without touching business money', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await page.goto('/#/homeBudget');
  await expect(page.locator('#homeBudgetForm')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('#homeBudgetView')).toContainText('never enter the business expense ledger');
  await expect(page.locator('#homeBudgetAllTimeTotal')).toContainText('PKR 0');

  await page.locator('#homeBudgetDate').fill('2026-10-05');
  await page.locator('#homeBudgetAmount').fill('1500');
  await page.locator('#homeBudgetCategory').selectOption('Balla shop');
  await page.locator('#homeBudgetNotes').fill('weekly groceries');
  await page.locator('#homeBudgetSubmit').click();
  await expect(page.locator('#homeBudgetList')).toContainText('Balla shop');
  await expect(page.locator('#homeBudgetList')).toContainText('PKR 1,500');
  await expect(page.locator('#homeBudgetAllTimeTotal')).toContainText('PKR 1,500');

  await page.locator('#homeBudgetDate').fill('2026-10-06');
  await page.locator('#homeBudgetAmount').fill('3000');
  await page.locator('#homeBudgetCategory').selectOption('__custom__');
  await expect(page.locator('#homeBudgetCustomCategoryLabel')).toBeVisible();
  await page.locator('#homeBudgetCustomCategory').fill('School fees');
  await page.locator('#homeBudgetSubmit').click();
  await expect(page.locator('#homeBudgetList')).toContainText('School fees');
  await expect(page.locator('#homeBudgetAllTimeTotal')).toContainText('PKR 4,500');

  await expect(page.locator('#homeBudgetMonthTotals')).toContainText('PKR 4,500');
  await page.locator('#homeBudgetMonthFilter').selectOption('2026-10');
  await expect(page.locator('#homeBudgetMonthTotal')).toContainText('PKR 4,500');
  await expect(page.locator('#homeBudgetAllTimeTotal')).toContainText('PKR 4,500', 'the all-time total never changes under a month filter');
  await page.locator('#homeBudgetMonthFilter').selectOption('all');
  await page.locator('#homeBudgetCategoryFilter').selectOption('School fees');
  await expect(page.locator('#homeBudgetList')).toContainText('School fees');
  await expect(page.locator('#homeBudgetList')).not.toContainText('Balla shop');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  expect(errors).toEqual([]);
});
