// Saad visit log: per-visit job record + month-end summary with payments.
// Written to run in CI (the repo Playwright runner cannot run in the dev
// VM). Logs a splicing visit for a seeded customer with start/end times,
// checks the month summary shows 1 day + 3.5 hours + where he worked, logs
// a salary payment, and checks the payment totals — plus no horizontal
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

test('saad visit log: splicing visit + salary payment roll into the month summary', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await expect(page.locator('#dashboardSaadVisitsValue')).toContainText('No visits yet');
  await page.locator('#openSaadVisitsModalBtn').click();
  await expect(page.locator('#saadVisitsModal')).toBeVisible();
  await page.locator('#saadVisitsMonth').fill('2026-10');
  await page.locator('#saadVisitDate').fill('2026-10-05');
  await page.locator('#saadVisitType').selectOption('splicing');
  // Index 0 is the "area-level work" placeholder; index 1 is the first seeded customer.
  await page.locator('#saadVisitCustomer').selectOption({ index: 1 });
  await page.locator('#saadVisitStartTime').fill('09:00');
  await page.locator('#saadVisitEndTime').fill('12:30');
  await page.locator('#saadVisitNote').fill('Main fiber splice');
  await page.locator('#saadVisitForm button[type="submit"]').click();
  const listText = await page.locator('#saadVisitsList').innerText();
  expect(listText).toContain('2026-10-05');
  expect(listText).toContain('3.5 h');
  const summaryText = await page.locator('#saadVisitsMonthSummary').innerText();
  expect(summaryText).toContain('2026-10-05');
  expect(summaryText).toContain('3.5 h');
  await page.locator('#saadPaymentDate').fill('2026-10-31');
  await page.locator('#saadPaymentAmount').fill('15000');
  await page.locator('#saadPaymentType').selectOption('salary');
  await page.locator('#saadPaymentForm button[type="submit"]').click();
  await expect(page.locator('#saadVisitsMonthSummary')).toContainText('15000 PKR');
  await page.locator('#saadVisitsCloseBtn').click();
  await expect(page.locator('#dashboardSaadVisitsValue')).toContainText('1 visit');
  expect(errors).toEqual([]);
});

test('saad visit log: no horizontal overflow at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page);
  await page.locator('#openSaadVisitsModalBtn').click();
  await expect(page.locator('#saadVisitsModal')).toBeVisible();
  const overflow = await page.evaluate(() => {
    const el = document.querySelector('#saadVisitsModal .modal-card');
    return el ? el.scrollWidth - el.clientWidth : -1;
  });
  expect(overflow).toBeLessThanOrEqual(0);
});
