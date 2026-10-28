// Customer lists: Top 10 early payers (1st–3rd, crowned 👑), 10 often-late
// payers (after 5th), the "tang karne wale" list with its rule shown, and
// "Mohalla (N)" headcounts in the area filter.
// Written to run in CI (the repo Playwright runner cannot run in the dev VM).
// Seeds one early payer (two 1st–3rd receipts) and one late payer (two
// after-5th receipts), then checks each ranking renders at 390px.
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

async function seedLists(page) {
  await page.evaluate(async () => {
    const core = await import('./core.js');
    let s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    const [early, late] = s.customers.slice(0, 2);
    const now = new Date();
    s = core.updateCustomerProfile(s, early.id, { mohalla: 'Bani', serviceStatus: 'active', packageSpeed: '5 Mbps', monthlySellingAmount: 1000 }, now);
    s = core.updateCustomerProfile(s, late.id, { mohalla: 'Kishti', serviceStatus: 'active', packageSpeed: '5 Mbps', monthlySellingAmount: 1000 }, now);
    for (const month of ['2026-06', '2026-07']) {
      s = core.saveBillMonth(s, early.id, { month, dueAmount: '1000', status: 'pending' }, now);
      s = core.saveBillMonth(s, late.id, { month, dueAmount: '1000', status: 'pending' }, now);
    }
    s = core.addPayment(s, early.id, '2026-06', { date: '2026-06-02', amount: '1000', method: 'Cash' }, now);
    s = core.addPayment(s, early.id, '2026-07', { date: '2026-07-01', amount: '1000', method: 'Cash' }, now);
    s = core.addPayment(s, late.id, '2026-06', { date: '2026-06-06', amount: '1000', method: 'Cash' }, now);
    s = core.addPayment(s, late.id, '2026-07', { date: '2026-07-20', amount: '1000', method: 'Cash' }, now);
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(s));
  });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

test('early, late and troublesome lists render with crown and mohalla counts at 390px', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedLists(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/reports');
  await page.waitForFunction(() => document.querySelectorAll('#rankingType option').length > 1, { timeout: 20000 });
  const results = page.locator('#customerRankingResults');
  const basis = page.locator('#customerRankingBasis');

  await page.selectOption('#rankingType', 'early-payers');
  await expect(results.locator('.owner-result-card').first()).toBeVisible({ timeout: 20000 });
  await expect(results.locator('.owner-crown-avatar').first()).toBeVisible();
  await expect(results.locator('.owner-crown-avatar').first()).toContainText('👑');
  await expect(results).toContainText('👑');
  await expect(results).toContainText('2 early payments · 1st–3rd');
  await expect(basis).toContainText('1st, 2nd or 3rd');

  await page.selectOption('#rankingType', 'late-payers');
  await expect(results).toContainText('2 late payments · after 5th');

  await page.selectOption('#rankingType', 'troublesome');
  await expect(results).toContainText('2 payments after the 5th');
  await expect(basis).toContainText('2 or more payments after the 5th');

  const areaOptions = await page.locator('#rankingArea option').allTextContents();
  expect(areaOptions.some(text => /Banii \(\d+\)/.test(text))).toBe(true);
  expect(areaOptions.some(text => /Kishtii \(\d+\)/.test(text))).toBe(true);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  expect(errors).toEqual([]);
});
