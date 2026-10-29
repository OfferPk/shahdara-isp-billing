// Advance payments (owner feature, 2026-10-29). Written to run in CI
// (the repo Playwright runner cannot run in the dev VM).
// Seeds ONE synthetic customer whose current-month bill (PKR 3,000) is
// already fully paid, then checks, at a real 360px viewport:
//   - the profile shows the Advance payment button in Current Billing;
//   - the Advance dialog opens, records PKR 3,000 dated today, and the
//     Current Billing summary then shows the advance credit;
//   - the stored payment carries kind:'advance' (the tag the engine and
//     the history/transactions badges read);
//   - the Transactions list shows the Advance badge on that payment;
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
const dateKeyOf = (d) => `${monthKeyOf(d)}-${String(d.getDate()).padStart(2, '0')}`;

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
          id: 'seed-adv', customerNumber: 1, name: 'E2E Advance Tester', mohalla: 'BARRIAN', phone: '',
          monthlySellingAmount: 3000,
          monthlyPriceSchedule: [{ amount: 3000, effectiveMonth: month, recordedAt: `${firstOfMonth}T09:00:00.000Z` }],
          bills: [
            { id: 'bill-current', month, dueAmount: 3000, status: 'pending', dueDate: `${month}-05`, payments: [
              { id: 'pay-full', date: firstOfMonth, amount: 3000, method: 'Cash' }
            ] }
          ],
          archived: false
        }
      ]
    };
    localStorage.setItem('shahdara-isp-billing-v1', JSON.stringify(state));
  }, { month, firstOfMonth });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  return { today: dateKeyOf(now) };
}

test.describe('Advance payment (owner feature)', () => {
  test('records an advance on a fully paid bill and tags it end to end', async ({ page }) => {
    const errors = trackErrors(page);
    const { today } = await bootAndSeed(page);

    // Open the seeded customer's profile.
    await page.goto('/#/customers');
    const row = page.locator('#customerList [data-customer-id]').first();
    await row.click();
    await expect(page.locator('#detailName')).toHaveText('E2E Advance Tester');

    // Current Billing: bill is Paid; the Advance button is offered.
    const summary = page.locator('#customerCurrentBillSummary');
    await expect(summary).toContainText('Paid');
    const advanceBtn = page.locator('#advancePaymentButton');
    await advanceBtn.scrollIntoViewIfNeeded();
    await expect(advanceBtn).toBeVisible();

    // Record the advance: PKR 3,000, today, Cash, with a note.
    await advanceBtn.click();
    const dialog = page.locator('#advancePaymentDialog');
    await expect(dialog).toBeVisible();
    await page.locator('#advancePaymentAmount').fill('3000');
    await page.locator('#advancePaymentDate').fill(today);
    await page.locator('#advancePaymentMethod').selectOption('Cash');
    await page.locator('#advancePaymentNote').fill('Next month paid early');
    await page.locator('#advancePaymentSaveBtn').click();
    await expect(dialog).toBeHidden();

    // The Current Billing summary now carries the advance credit.
    await expect(summary).toContainText('3,000');

    // The stored payment is tagged as advance, on the current bill.
    const stored = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('shahdara-isp-billing-v1'));
      const payments = state.customers[0].bills.flatMap(b => b.payments);
      return payments.map(p => ({ kind: p.kind ?? null, amount: p.amount, note: p.note ?? null }));
    });
    expect(stored).toHaveLength(2);
    expect(stored).toContainEqual({ kind: 'advance', amount: 3000, note: 'Next month paid early' });
    expect(stored.filter(p => p.kind === 'advance')).toHaveLength(1);

    // Transactions shows exactly one Advance badge (the tagged payment).
    await page.goto('/#/transactions');
    await expect(page.locator('#transactionsList .advance-badge')).toHaveCount(1);

    // No horizontal overflow at 360px, no page errors.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
});
