// Loan ledger: a personal dena/lena ledger kept fully apart from business
// billing, expenses, partner shares and profit. Written to run in CI (the
// repo Playwright runner cannot run in the dev VM). UI-driven at 390px:
// add a dena loan and a lena loan, record a repayment, check grand totals
// and per-person balances move, filter by direction, and confirm no
// horizontal overflow and no console errors.
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

function todayPkt() {
  return new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
}

async function addLoanEntry(page, { person, phone, direction, kind, amount }) {
  await page.fill('#loanPerson', person);
  if (phone !== undefined) await page.fill('#loanPhone', phone);
  await page.selectOption('#loanDirection', direction);
  await page.selectOption('#loanKind', kind);
  await page.fill('#loanAmount', String(amount));
  await page.fill('#loanDate', todayPkt());
  await page.click('#loanForm button[type="submit"]');
  await page.waitForTimeout(300);
}

test('loan ledger tracks dena/lena per person with grand totals and repayment at 390px', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/loans');
  await expect(page.locator('#loanView')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('#loanEmpty')).toBeVisible();
  await expect(page.locator('#loanTotalDena')).toHaveText('No loans recorded');

  await addLoanEntry(page, { person: 'Ahmed', phone: '03001234567', direction: 'dena', kind: 'loan', amount: 5000 });
  await expect(page.locator('#loanTotalDena')).toHaveText('PKR 5,000');
  await expect(page.locator('#loanPersonCards')).toContainText('Ahmed');
  await expect(page.locator('#loanPersonCards')).toContainText('03001234567');

  await addLoanEntry(page, { person: 'Ahmed', direction: 'lena', kind: 'loan', amount: 8000 });
  await expect(page.locator('#loanTotalLena')).toHaveText('PKR 8,000');
  await expect(page.locator('#loanPersonCards')).toContainText('PKR 3,000 to receive');

  await addLoanEntry(page, { person: 'Ahmed', direction: 'lena', kind: 'repayment', amount: 3000 });
  await expect(page.locator('#loanTotalLena')).toHaveText('PKR 5,000');
  await expect(page.locator('#loanPersonCards')).toContainText('Settled');

  await addLoanEntry(page, { person: 'Bilal', direction: 'dena', kind: 'loan', amount: 2000 });
  await page.selectOption('#loanDirectionFilter', 'lena');
  await expect(page.locator('#loanPersonCards')).toContainText('Ahmed');
  await expect(page.locator('#loanPersonCards')).not.toContainText('Bilal');
  await page.selectOption('#loanDirectionFilter', 'all');
  await expect(page.locator('#loanPersonCards')).toContainText('Bilal');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  expect(errors).toEqual([]);
});
