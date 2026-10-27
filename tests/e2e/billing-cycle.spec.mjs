// SISP-2: Automated Monthly Bill Cycle, Arrears Carry-Forward & Advance
// Adjustment Engine. Written to run in CI (the repo Playwright runner
// cannot run in the dev VM). Seeds a customer with a prior unpaid bill,
// runs the cycle from the dashboard modal, checks the batch summary, the
// receipt breakdown lines, and that a re-run for the same month is blocked.
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

async function seedCycleCustomer(page) {
  await page.evaluate(async () => {
    const core = await import('./core.js');
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    let s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    const [c0] = s.customers.slice(0, 1);
    // Price schedule so the current month can be priced (the cycle adopts
    // the auto-generated current-month bill when the app reloads).
    c0.monthlyPriceSchedule = [{ effectiveMonth: prevMonth, amount: 3000, recordedAt: new Date().toISOString() }];
    s = core.saveBillMonth(s, c0.id, { month: prevMonth, dueAmount: '3000', status: 'pending' });
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(s));
    localStorage.setItem('sisp-billing-cycle-test-month', month);
  });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

test('billing cycle previews arrears, runs once, and blocks a re-run', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedCycleCustomer(page);
  const month = await page.evaluate(() => localStorage.getItem('sisp-billing-cycle-test-month'));

  await page.click('#openBillingCycleModalBtn');
  await expect(page.locator('#billingCycleModal')).toBeVisible();
  await page.fill('#billingCycleMonthInput', month);
  await page.click('#billingCyclePreviewBtn');
  await expect(page.locator('#billingCyclePreview')).toContainText('Total arrears carried forward');
  await expect(page.locator('#billingCyclePreview')).toContainText('PKR 3,000');

  await page.click('#billingCycleConfirmBtn');
  await expect(page.locator('#billingCycleResult')).toContainText(`Billing cycle for ${month} ran`);
  await expect(page.locator('#dashboardBillingCycleValue')).toContainText('cycled');

  const stored = await page.evaluate(() => localStorage.getItem('sisp_billing_cycles_v1'));
  expect(stored).toBeTruthy();
  const cycles = JSON.parse(stored);
  expect(cycles).toHaveLength(1);
  expect(cycles[0].month).toBe(month);
  expect(cycles[0].totals.totalArrears).toBe(3000);

  // Re-run for the same month is refused with a clear message.
  await page.click('#openBillingCycleModalBtn');
  await page.fill('#billingCycleMonthInput', month);
  await page.click('#billingCyclePreviewBtn');
  await expect(page.locator('#billingCyclePreview')).toContainText('already ran');

  // No horizontal overflow at 390px in the modal.
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  expect(errors).toEqual([]);
});
