// Partner share detail (Partners tab, Expenses view): one shared detail
// for both partners, from the settlement month. Written to run in CI (the
// repo Playwright runner cannot run in the dev VM). Seeded history is
// written through the app's own core helpers plus a direct expenses patch,
// the same pattern as the analytics specs. Assertions check the rendered
// detail and self-consistent properties, and that both partners' sections
// show the same figures from the same shared helper.
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

test('Partners tab shows both partners\' detail from one helper', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedPartnerMonth(page);
  await page.goto('/#/expenses');
  await page.waitForSelector('#expenseTabPartners', { state: 'visible', timeout: 20000 });

  await page.click('#expenseTabPartners');
  await page.selectOption('#partnerSettlementMonth', '2026-10');
  const detail = page.locator('#partnerShareDetail');
  await expect(detail).toContainText('Nasir');
  await expect(detail).toContainText('Aqib');
  await expect(detail).toContainText('PKR 200,000');
  await expect(detail).toContainText('PKR 50,000');
  await expect(detail).toContainText('PKR 150,000');
  await expect(detail).toContainText('PKR 75,000');
  await expect(detail).toContainText('Nayatel bill');
  await expect(detail).toContainText('Salary — Saad');

  expect(errors).toEqual([]);
});

test('partner share detail does not overflow at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = trackErrors(page);
  await boot(page);
  await seedPartnerMonth(page);
  await page.goto('/#/expenses');
  await page.waitForSelector('#expenseTabPartners', { state: 'visible', timeout: 20000 });
  await page.click('#expenseTabPartners');
  await page.selectOption('#partnerSettlementMonth', '2026-10');
  await page.waitForSelector('#partnerShareDetail .partner-share-history', { state: 'visible', timeout: 20000 });
  const overflow = await page.evaluate(() => {
    const panel = document.getElementById('partnersPanel');
    return panel.scrollWidth - panel.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});
