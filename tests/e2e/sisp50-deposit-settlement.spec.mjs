// SISP-50: Disconnection Security Deposit Refund vs. Final Arrears
// Offset Calculator. Written to run in CI (the repo Playwright runner
// cannot run in the dev VM). Seeds a synthetic customer holding a
// Rs. 2,000 security deposit with Rs. 1,200 unpaid arrears and
// ISP-owned hardware, then walks the real operator flow at 360px:
//   - while connected, NO deposit settlement section exists;
//   - archiving (the app's disconnect action) reveals the recovery
//     checklist and the settlement quote (refund PKR 800);
//   - marking all hardware recovered keeps the quote at PKR 800;
//   - 1-click settle stamps the settlement, zeroes the deposit,
//     writes the bill's depositOffsetAmount (arrears cleared), and
//     swaps the quote for the settled line + clearance-receipt button;
//   - no page errors, no horizontal overflow at 360px.
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

async function seedCustomer(page) {
  await page.evaluate(() => {
    const state = {
      version: 1,
      nextCustomerNumber: 2,
      customers: [{
        id: 'cust-sisp50',
        customerNumber: 51,
        name: 'SEED DEPOSIT',
        mohalla: 'BARRIAN',
        phone: '',
        serviceStatus: 'active',
        packageSpeed: '5 Mbps',
        monthlySellingAmount: null,
        monthlyPriceSchedule: [],
        routerOwnership: 'isp-owned',
        mediaConverterOwnership: 'isp-owned',
        serialNumber: 'SN-5050',
        securityDeposit: 2000,
        routerPrice: 1500,
        mediaConverterCost: 800,
        hardwareRecovered: { router: null, mediaConverter: null },
        archived: false,
        archivedAt: null,
        bills: [{ id: 'bill-sisp50-sep', month: '2026-09', dueAmount: 1200, status: 'pending', payments: [] }],
        incidents: [],
        installmentPlans: []
      }]
    };
    localStorage.setItem('shahdara-isp-billing-v1', JSON.stringify(state));
  });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

async function openProfile(page) {
  await page.goto('/#/customers');
  await page.waitForSelector('#customerList [data-customer-id]', { timeout: 20000 });
  await page.locator('#customerList [data-customer-id="cust-sisp50"]').click();
  await page.waitForSelector('.profile-custody-section', { timeout: 20000 });
}

test('deposit settles against arrears on disconnection with an 800 refund', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedCustomer(page);
  await openProfile(page);

  // Connected: custody shows the deposit, but no settlement section.
  await expect(page.locator('.profile-custody-section').first()).toContainText('Security deposit');
  await expect(page.locator('.profile-deposit-settlement')).toHaveCount(0);

  // Disconnect (archive) and recover all hardware from the profile.
  await page.locator('#archiveCustomerButton').click();
  await expect(page.locator('#appConfirmTitle')).toHaveText('Archive this customer?');
  await page.locator('#appConfirmOkBtn').click();
  await expect(page.locator('.profile-custody-checklist')).toContainText('Router');
  await page.locator('#profileCustodyRecoverAllBtn').click();
  await expect(page.locator('.profile-custody-checklist')).toHaveCount(0);

  // The settlement quote: deposit 2,000 − arrears 1,200 − hardware 0.
  const section = page.locator('.profile-deposit-settlement');
  await expect(section).toContainText('Security Deposit Settlement');
  await expect(section).toContainText('PKR 2,000');
  await expect(section).toContainText('PKR 1,200');
  await expect(section).toContainText('PKR 800');

  // 1-click settle.
  await page.locator('#profileDepositSettleBtn').click();
  await expect(section).toContainText('Settled on');
  await expect(page.locator('#profileDepositReceiptBtn')).toBeVisible();

  // Persisted truth: deposit consumed, settlement stamped, arrears
  // cleared through the bill's deposit offset fields.
  const saved = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('shahdara-isp-billing-v1'));
    const customer = state.customers.find((row) => row.id === 'cust-sisp50');
    return {
      securityDeposit: customer.securityDeposit,
      refundAmount: customer.depositSettlement?.refundAmount,
      arrearsOffset: customer.depositSettlement?.arrearsOffset,
      billOffset: customer.bills[0]?.depositOffsetAmount,
      payments: customer.bills[0]?.payments?.length
    };
  });
  expect(saved).toEqual({
    securityDeposit: 0,
    refundAmount: 800,
    arrearsOffset: 1200,
    billOffset: 1200,
    payments: 0
  });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  await expect(errors).toEqual([]);
});
