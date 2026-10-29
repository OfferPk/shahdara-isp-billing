// SISP-43: Billed Ticket Charges Collect Modal & Receipt Integration.
// Written to run in CI (the repo Playwright runner cannot run in the dev
// VM). Seeds one synthetic customer with a Rs. 3,000 current-month bill
// plus one resolved billed ticket (Rs. 500 patch cord) through the app's
// own storage keys, then checks, at a real 360px viewport:
//   - Quick Collect shows the full payable (3,000 + 500 = 3,500) with
//     the Murammat / Material Charge (TKT-101) breakdown line;
//   - the amount is prefilled with the full payable;
//   - confirming records ONE payment whose ticketCharges stamp names
//     TKT-101, marks the ticket paid, and the success card prints the
//     ticket line next to the settled-in-full state.
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

async function seedCustomerWithTicket(page) {
  await page.evaluate(async () => {
    const core = await import('./core.js');
    let s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    s = core.addCustomer(s, 'E2E Test Subscriber', now, { phone: '+923001234567', mohalla: 'Test Mohalla', zone: 'Test Zone' });
    const customer = s.customers.at(-1);
    s = core.saveBillMonth(s, customer.id, { month, dueAmount: '3000', status: 'pending' });
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(s));
    const stamp = now.toISOString().slice(0, 16);
    localStorage.setItem('sisp_tickets_v1', JSON.stringify([{
      id: 'TKT-101',
      customerId: customer.id,
      customerName: 'E2E Test Subscriber',
      complaintId: '',
      faultPreset: 'Fiber Cut / Splice Loss',
      customFault: '',
      technician: 'Test Lineman',
      priority: 'Normal',
      status: 'Resolved',
      createdAt: stamp,
      resolvedAt: stamp,
      note: '',
      materialsUsed: [{ key: 'patch-cord', qty: 1, amount: 500 }],
      billingType: 'billed',
      billedAmount: 500,
      chargePaid: false,
      chargePaidAt: '',
      stockDeductions: [],
      stockDeducted: false
    }]));
  });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

test('sisp-43: collect shows 3,500 payable and one payment settles bill + ticket charge', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedCustomerWithTicket(page);

  await page.locator('#quickAddPaymentButton').click();
  const modal = page.locator('#quickCollectModal');
  await expect(modal).toBeVisible();

  const cards = modal.locator('.qc-customer-card');
  await expect(cards).toHaveCount(1);
  await cards.first().click();

  // The form header spells out the split and the full payable.
  const header = page.locator('#quickCollectCustomerHeader');
  await expect(header).toContainText('Total Payable');
  await expect(header).toContainText('PKR 3,500');
  await expect(header).toContainText('Murammat / Material Charge (TKT-101)');
  await expect(header).toContainText('Bill dues: PKR 3,000');
  await expect(page.locator('#quickCollectAmountInput')).toHaveValue('3500.00');

  await page.locator('#quickCollectConfirmBtn').click();

  // Success card prints the ticket line and the settled state.
  const receiptCard = page.locator('#quickCollectReceiptCard');
  await expect(receiptCard).toContainText('Murammat / Material Charge (TKT-101)');
  await expect(receiptCard).toContainText('PKR 500');
  await expect(receiptCard).toContainText('Settle in Full');

  // Storage truth: one stamped payment, ticket marked paid against it.
  const stored = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('shahdara-isp-billing-v1'));
    const tickets = JSON.parse(localStorage.getItem('sisp_tickets_v1'));
    const payments = state.customers.flatMap((c) => (c.bills ?? []).flatMap((b) => b.payments ?? []));
    return { payments, tickets };
  });
  expect(stored.payments).toHaveLength(1);
  expect(stored.payments[0].amount).toBe(3500);
  expect(stored.payments[0].ticketCharges).toEqual([{ ticketId: 'TKT-101', amount: 500 }]);
  expect(stored.tickets[0].chargePaid).toBe(true);
  expect(stored.tickets[0].chargePaymentId).toBe(stored.payments[0].id);

  expect(errors).toEqual([]);
});
