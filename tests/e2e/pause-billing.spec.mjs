// SISP-8: Pro-Rata Package Upgrade & Temporary Vacation Hold (Freeze).
// Written to run in CI (the repo Playwright runner cannot run in the
// dev VM). Seeds a customer with a prior unpaid bill, pauses billing
// from the current month, and checks: the auto-generator creates no
// bill for the paused month, the prior bill stays intact, the profile
// shows the pause badge + Vacation hold row + checked hold checkbox,
// and the billing-cycle preview lists the customer as skipped with the
// "Paused (vacation hold)" label.
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

async function seedPausedCustomer(page) {
  await page.evaluate(async () => {
    const core = await import('./core.js');
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    const s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    const c0 = s.customers[0];
    c0.monthlyPriceSchedule = [{ effectiveMonth: prevMonth, amount: 3000, recordedAt: new Date().toISOString() }];
    c0.billingStartMonth = prevMonth;
    c0.bills = [{ id: 'seed-prev', month: prevMonth, dueAmount: 3000, dueDate: `${prevMonth}-05`, status: 'pending', payments: [], generated: true, priceSnapshot: 3000, createdAt: `${prevMonth}-01 00:00`, amountHistory: [] }];
    c0.paused = true;
    c0.pauseStartDate = `${month}-05`;
    c0.autoResumeDate = null;
    c0.pauseSkippedMonths = [];
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(s));
    localStorage.setItem('sisp-pause-test-month', month);
    localStorage.setItem('sisp-pause-test-prev-month', prevMonth);
    localStorage.setItem('sisp-pause-test-customer-id', c0.id);
  });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

test('vacation hold pauses billing, keeps the prior balance, and shows in the profile + cycle preview', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedPausedCustomer(page);
  const month = await page.evaluate(() => localStorage.getItem('sisp-pause-test-month'));
  const prevMonth = await page.evaluate(() => localStorage.getItem('sisp-pause-test-prev-month'));
  const customerId = await page.evaluate(() => localStorage.getItem('sisp-pause-test-customer-id'));

  // Auto-generator ran on reload: no bill for the paused month, the
  // prior unpaid bill untouched, and the month recorded as skipped.
  const afterLoad = await page.evaluate(async () => {
    const core = await import('./core.js');
    const s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    const c = s.customers.find((item) => item.id === localStorage.getItem('sisp-pause-test-customer-id'));
    const month = localStorage.getItem('sisp-pause-test-month');
    const prevMonth = localStorage.getItem('sisp-pause-test-prev-month');
    return {
      hasPausedMonthBill: c.bills.some((bill) => bill.month === month),
      prevBillAmount: (c.bills.find((bill) => bill.month === prevMonth) || {}).dueAmount ?? null,
      skipped: c.pauseSkippedMonths || []
    };
  });
  expect(afterLoad.hasPausedMonthBill).toBe(false);
  expect(afterLoad.prevBillAmount).toBe(3000);
  expect(afterLoad.skipped).toContain(month);

  // Profile shows the pause badge, the Vacation hold row, and the
  // checked hold checkbox in the edit form.
  await page.click(`#customerList [data-customer-id="${customerId}"]`);
  await expect(page.locator('#pauseStateBadge')).toBeVisible();
  await expect(page.locator('#pauseStateBadge')).toContainText('Paused since');
  await expect(page.locator('#customerProfileView')).toContainText('Vacation hold');
  await page.click('#editProfileButton');
  await expect(page.locator('#pauseBillingCheckbox')).toBeChecked();
  await expect(page.locator('#pauseStartDateInput')).toHaveValue(`${month}-05`);

  // Cycle preview lists the paused customer as skipped.
  await page.click('#openBillingCycleModalBtn');
  await expect(page.locator('#billingCycleModal')).toBeVisible();
  await page.fill('#billingCycleMonthInput', month);
  await page.click('#billingCyclePreviewBtn');
  await expect(page.locator('#billingCyclePreview')).toContainText('Paused (vacation hold)');

  // No horizontal overflow at 390px in the modal.
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  expect(errors).toEqual([]);
});
