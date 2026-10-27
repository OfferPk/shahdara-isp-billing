// SISP-4: Hardware & Wire Installment (Kist / EMI) Auto-Billing Engine.
// Written to run in CI (the repo Playwright runner cannot run in the
// dev VM). Seeds a customer with a Rs. 3,000 router plan (3 x Rs. 1,000),
// runs the monthly billing cycle from the dashboard modal, and checks the
// kist line lands on that month's bill exactly once, the plan advances to
// monthsBilled 1, and the cycle preview shows the kist total.
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

async function seedKistCustomer(page) {
  await page.evaluate(async () => {
    const core = await import('./core.js');
    const kist = await import('./installment-plan.js');
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    let s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    const [c0] = s.customers.slice(0, 1);
    // Price schedule so the current month can be priced (the cycle adopts
    // the auto-generated current-month bill when the app reloads).
    c0.monthlyPriceSchedule = [{ effectiveMonth: prevMonth, amount: 3000, recordedAt: new Date().toISOString() }];
    c0.installmentPlans = [kist.createInstallmentPlan({ itemTitle: 'Tenda F3 Router', totalAmount: 3000, totalMonths: 3 })];
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(s));
    localStorage.setItem('sisp-kist-test-month', month);
  });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

test('kist plan bills exactly one Rs. 1,000 installment with the cycle', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedKistCustomer(page);
  const month = await page.evaluate(() => localStorage.getItem('sisp-kist-test-month'));

  await page.click('#openBillingCycleModalBtn');
  await expect(page.locator('#billingCycleModal')).toBeVisible();
  await page.fill('#billingCycleMonthInput', month);
  await page.click('#billingCyclePreviewBtn');
  await expect(page.locator('#billingCyclePreview')).toContainText('Kist installments included');
  await expect(page.locator('#billingCyclePreview')).toContainText('PKR 1,000');

  await page.click('#billingCycleConfirmBtn');
  await expect(page.locator('#billingCycleResult')).toContainText(`Billing cycle for ${month} ran`);
  await expect(page.locator('#billingCycleResult')).toContainText('kist included');

  const after = await page.evaluate(async () => {
    const core = await import('./core.js');
    const s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    const c0 = s.customers[0];
    const month = localStorage.getItem('sisp-kist-test-month');
    const monthBill = (c0.bills || []).find((row) => row.month === month);
    return {
      dueAmount: monthBill?.dueAmount ?? null,
      priceSnapshot: monthBill?.priceSnapshot ?? null,
      kistTotal: monthBill?.kistTotal ?? null,
      kistLines: monthBill?.kistLines ?? [],
      monthsBilled: (c0.installmentPlans || [])[0]?.monthsBilled ?? null,
      status: (c0.installmentPlans || [])[0]?.status ?? null
    };
  });
  // Package Rs. 3,000 + exactly one kist of Rs. 1,000.
  expect(after.dueAmount).toBe(4000);
  expect(after.priceSnapshot).toBe(3000);
  expect(after.kistTotal).toBe(1000);
  expect(after.kistLines).toHaveLength(1);
  expect(after.kistLines[0].installmentNumber).toBe(1);
  expect(after.kistLines[0].totalMonths).toBe(3);
  expect(after.monthsBilled).toBe(1);
  expect(after.status).toBe('active');

  // No horizontal overflow at 390px in the modal.
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  expect(errors).toEqual([]);
});
