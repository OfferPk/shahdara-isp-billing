// Change Package inside Quick Collect (owner feature, 2026-10-29).
// Written to run in CI (the repo Playwright runner cannot run in the
// dev VM). Seeds ONE synthetic customer on the PKR 1,000 package with
// this month's 1,000 bill unpaid, then checks, at a real 360px
// viewport:
//   - the payment step shows the current package with a catalogue picker;
//   - picking the PKR 2,000 package and tapping "Change package" reprices
//     this month's bill in place: the stored bill becomes 2,000, the
//     amount field is prefilled 2,000 and the dues header shows 2,000 —
//     without leaving the sheet;
//   - confirming collects the 2,000 and lands on the receipt step;
//   - no page errors and no horizontal overflow at 360px.
// Dates are computed from the real clock so the spec is month-agnostic.
import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) errors.push(m.text()); });
  return errors;
}

const monthKeyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

async function bootAndSeed(page) {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/#/home');
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  await page.evaluate(() => localStorage.clear());
  const now = new Date();
  const month = monthKeyOf(now);
  const firstOfMonth = `${month}-01`;
  await page.evaluate(({ month, firstOfMonth }) => {
    const state = {
      version: 1,
      nextCustomerNumber: 2,
      customers: [
        {
          id: 'seed-pkg', customerNumber: 1, name: 'E2E Package Tester', mohalla: 'BARRIAN', phone: '',
          packageSpeed: '3Mbps / 100GB',
          monthlySellingAmount: 1000,
          monthlyPriceSchedule: [{ amount: 1000, effectiveMonth: month, recordedAt: `${firstOfMonth}T09:00:00.000Z` }],
          bills: [
            { id: 'bill-current', month, dueAmount: 1000, status: 'pending', dueDate: `${month}-05`, payments: [] }
          ],
          archived: false
        }
      ]
    };
    localStorage.setItem('shahdara-isp-billing-v1', JSON.stringify(state));
  }, { month, firstOfMonth });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  return { month };
}

test.describe('Change Package inside Quick Collect (owner feature)', () => {
  test('reprices this month\'s bill in the sheet and collects at the new package', async ({ page }) => {
    const errors = trackErrors(page);
    const { month } = await bootAndSeed(page);

    await page.locator('#quickAddPaymentButton').click();
    const modal = page.locator('#quickCollectModal');
    await expect(modal).toBeVisible();

    await modal.locator('.qc-customer-card').first().click();
    await expect(page.locator('#quickCollectStepForm')).toBeVisible();

    // The package row shows the current package and the catalogue picker.
    const packageBox = page.locator('#quickCollectPackageBox');
    await expect(packageBox).toContainText('3Mbps / 100GB');
    await expect(packageBox).toContainText('PKR 1,000');

    // Pick the 2,000 package and apply — one tap, same sheet.
    await page.locator('#quickCollectPackageSelect').selectOption('5mbps-200gb');
    const applyBtn = page.locator('[data-qc-change-package]');
    await expect(applyBtn).toBeEnabled();
    await applyBtn.click();

    // The form now reflects the new package's dues.
    await expect(page.locator('#quickCollectAmountInput')).toHaveValue('2000.00');
    await expect(page.locator('#quickCollectCustomerHeader')).toContainText('PKR 2,000');
    await expect(packageBox).toContainText('5Mbps / 200GB');

    // The stored ledger tells the same story: bill repriced, plan changed,
    // and the package-history audit entry exists.
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('shahdara-isp-billing-v1')));
    const customer = stored.customers.find(c => c.id === 'seed-pkg');
    const bill = customer.bills.find(b => b.month === month);
    expect(customer.packageSpeed).toBe('5Mbps / 200GB');
    expect(customer.monthlySellingAmount).toBe(2000);
    expect(Number(bill.dueAmount)).toBe(2000);
    expect(customer.packageHistory.at(-1).newPackage).toBe('5Mbps / 200GB');
    expect(customer.packageHistory.at(-1).staffName).toBe('Quick Collect');

    // Collect at the new package without leaving the flow.
    await page.locator('#quickCollectConfirmBtn').click();
    await expect(page.locator('#quickCollectStepSuccess')).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
});
