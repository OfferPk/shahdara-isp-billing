// Partner share tabs (Expenses view): "Nasir share" and "Aqib share".
// Written to run in CI (the repo Playwright runner cannot run in the dev
// VM). Seeded history is written through the app's own core helpers plus a
// direct expenses patch, the same pattern as the analytics specs.
// Assertions check rendered shares and self-consistent properties, and that
// both tabs show the same figures from the same shared helper.
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

async function seedPartnerMonth(page) {
  await page.evaluate(async () => {
    const core = await import('./core.js');
    let s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    const c0 = s.customers[0];
    const month = '2026-10';
    s = core.saveBillMonth(s, c0.id, { month, dueAmount: '250000', status: 'pending' });
    s = core.addPayment(s, c0.id, month, { date: `${month}-05`, amount: '200000', method: 'Cash' });
    s = { ...s, expenses: [
      ...(s.expenses ?? []),
      { id: 'seed-exp-1', date: `${month}-03`, amount: 15000, category: 'Salary — Saad', notes: '', area: '' },
      { id: 'seed-exp-2', date: `${month}-10`, amount: 20000, category: 'Nayatel bill', notes: '', area: '' },
      { id: 'seed-exp-3', date: `${month}-12`, amount: 15000, category: 'Electricity', notes: '', area: '' },
    ] };
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(s));
  });
}

test('Nasir and Aqib tabs show the same 50% share from one helper', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedPartnerMonth(page);
  await page.goto('/#/expenses');
  await page.waitForSelector('#expenseTabNasir', { state: 'visible', timeout: 20000 });

  await page.click('#expenseTabNasir');
  await page.selectOption('#nasirShareMonth', '2026-10');
  const nasir = page.locator('#nasirShareContent');
  await expect(nasir).toContainText('PKR 200,000');
  await expect(nasir).toContainText('PKR 50,000');
  await expect(nasir).toContainText('PKR 150,000');
  await expect(nasir).toContainText('PKR 75,000');
  await expect(nasir).toContainText('Nayatel bill');
  await expect(nasir).toContainText('Salary — Saad');

  await page.click('#expenseTabAqib');
  await page.selectOption('#aqibShareMonth', '2026-10');
  const aqib = page.locator('#aqibShareContent');
  await expect(aqib).toContainText('PKR 200,000');
  await expect(aqib).toContainText('PKR 75,000');

  expect(errors).toEqual([]);
});

test('partner share panels do not overflow at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = trackErrors(page);
  await boot(page);
  await seedPartnerMonth(page);
  await page.goto('/#/expenses');
  await page.waitForSelector('#expenseTabNasir', { state: 'visible', timeout: 20000 });
  await page.click('#expenseTabNasir');
  await page.selectOption('#nasirShareMonth', '2026-10');
  await page.waitForSelector('#nasirShareContent .partner-share-grid', { state: 'visible', timeout: 20000 });
  const overflow = await page.evaluate(() => {
    const panel = document.getElementById('nasirSharePanel');
    return panel.scrollWidth - panel.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});
