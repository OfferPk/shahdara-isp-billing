// Area-summary phone cards: the wide 10-column table overflows phone screens
// (amounts cut mid-number), so at <=700px the same rows render as one card per
// area/mohalla/zone row, reusing the Area Intelligence card pattern. Written to
// run in CI (the repo Playwright runner cannot run in the dev VM). Seeds two
// customers in one area (one with a zone, one without) plus current-month
// bills, then checks the cards at 390px: every column as a labeled line with
// its full amount, the wide table hidden, and no horizontal overflow.
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

async function seedAreaCustomers(page) {
  await page.evaluate(async () => {
    const core = await import('./core.js');
    let s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    const [c0, c1] = s.customers.slice(0, 2);
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    s = core.updateCustomerProfile(s, c0.id, { mohalla: 'MOHALLA KISHTI', zone: 'North', serviceStatus: 'active', packageSpeed: '5 Mbps', monthlySellingAmount: 1000 }, now);
    s = core.updateCustomerProfile(s, c1.id, { mohalla: 'MOHALLA KISHTI', serviceStatus: 'active', packageSpeed: '5 Mbps', monthlySellingAmount: 1000 }, now);
    s = core.saveBillMonth(s, c0.id, { month, dueAmount: '25000', status: 'pending' });
    s = core.saveBillMonth(s, c1.id, { month, dueAmount: '12000', status: 'pending' });
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(s));
  });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

test('area summary renders as cards at 390px with every column labeled and full amounts', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedAreaCustomers(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/analytics');
  const cards = page.locator('#areaSummaryCards');
  await expect(cards.locator('.area-intel-card').first()).toBeVisible({ timeout: 20000 });
  await expect(cards).toContainText('Kishti');
  await expect(cards).toContainText('PKR 37,000', 'the full service-month billed amount stays whole, never cut mid-number');
  for (const label of ['Profiles', 'Active configured subscriptions', 'Service-month billed', 'Outstanding', 'Excluded from ARPU', 'Online %', 'Incidents', 'New connections', 'ARPU']) {
    await expect(cards).toContainText(label, `every table column shows as a labeled line: ${label}`);
  }
  await expect(page.locator('.area-summary-card .table-scroll')).toBeHidden('the wide summary table hides at narrow widths');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  expect(errors).toEqual([]);
});
