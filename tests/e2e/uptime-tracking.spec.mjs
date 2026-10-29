// Owner feature: Customer Uptime Tracking — profile age stamp,
// online/offline month summary, Quick Collect uptime one-liner.
// Written to run in CI (the repo Playwright runner cannot run in the
// dev VM). Seeds one synthetic customer whose connection started four
// months ago, with one recorded offline period (2 days 6 hours) in the
// PREVIOUS month (always fully in the past, whatever day CI runs),
// then checks at a real 360px viewport:
//   - the profile shows a "Profile age" stamp card;
//   - the uptime panel for that month lists the offline period with
//     its recorded reason, and the offline tile reads 2 days 6 hours;
//   - Quick Collect shows the one-line uptime summary for the bill
//     month being collected.
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

function monthShift(year, month1, delta) {
  const index = year * 12 + (month1 - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}
const pad = (n) => String(n).padStart(2, '0');

async function seedCustomer(page) {
  const ids = await page.evaluate(async () => {
    const core = await import('./core.js');
    let s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    const now = new Date();
    const prev = monthShift(now.getFullYear(), now.getMonth() + 1, -1);
    const conn = monthShift(now.getFullYear(), now.getMonth() + 1, -4);
    const prevMonth = `${prev.year}-${pad(prev.month)}`;
    const currentMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    s = core.addCustomer(s, 'E2E Uptime Subscriber', now, { phone: '+923001234568', mohalla: 'Test Mohalla', zone: 'Test Zone' });
    const customer = s.customers.at(-1);
    s = core.updateCustomerProfile(s, customer.id, { connectionDate: `${conn.year}-${pad(conn.month)}-15` });
    s = core.addIncident(s, customer.id, {
      reportedAt: `${prevMonth}-10T08:05`,
      offlineAt: `${prevMonth}-10T08:00`,
      restoredAt: `${prevMonth}-12T14:00`,
      note: 'E2E fiber cut reason'
    });
    s = core.saveBillMonth(s, customer.id, { month: currentMonth, dueAmount: '1500', status: 'pending' });
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(s));
    return { customerId: customer.id, prevMonth };
  });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  return ids;
}

test('uptime tracking: profile age stamp, month summary with reason, QC one-liner', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  const { customerId, prevMonth } = await seedCustomer(page);

  // Profile: age stamp card + uptime panel.
  await page.click(`#customerList [data-customer-id="${customerId}"]`);
  await expect(page.locator('#customerDetail')).toBeVisible({ timeout: 20000 });
  const ageCard = page.locator('.profile-summary-age');
  await expect(ageCard).toContainText('Profile age');
  await expect(ageCard.locator('strong')).toContainText(/month|day/);

  // Uptime panel for the previous month: the recorded period, its
  // reason, and the exact 2 days 6 hours offline total.
  await page.selectOption('#uptimeMonthSelect', prevMonth);
  const panel = page.locator('#uptimeSummaryBody');
  await expect(panel).toContainText('Offline periods & reasons');
  await expect(panel).toContainText('E2E fiber cut reason');
  await expect(panel).toContainText('2 days 6 hours');

  // Quick Collect: the one-line uptime summary for the bill month.
  await page.locator('#quickAddPaymentButton').click();
  const modal = page.locator('#quickCollectModal');
  await expect(modal).toBeVisible();
  const cards = modal.locator('.qc-customer-card');
  await expect(cards).toHaveCount(1);
  await cards.first().click();
  const line = page.locator('#quickCollectUptimeLine');
  await expect(line).toContainText('uptime');
  await expect(line).toContainText('Online');

  expect(errors).toEqual([]);
});
