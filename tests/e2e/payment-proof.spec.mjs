// Payment proof screenshot (owner feature, 2026-10-29). CI-only
// Playwright spec (the repo's Playwright runner cannot run in the VM;
// written for CI, not claimed as run locally).
// Seeds ONE synthetic customer with a partially paid current-month bill
// (one payment WITH a tiny proof image, one without), then checks at a
// real 360px viewport:
//   - the profile payment form carries the optional proof file field;
//   - recording a payment with a picked image stores a COMPRESSED proof
//     on the payment (data:image/jpeg, <= 200,000 chars — never the raw
//     pick) in localStorage;
//   - the history row for a proof payment shows the thumbnail button and
//     the payment without a proof shows none;
//   - tapping the thumbnail opens the read-only proof viewer dialog
//     showing exactly the stored image;
//   - no page errors and no horizontal overflow at 360px.
// The Quick Collect attach path is pinned by Node tests
// (tests/payment-proof.test.js); this spec covers the profile surfaces.
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

// A 1x1 PNG — the smallest real image a browser can decode.
const TINY_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const SEEDED_PROOF = `data:image/png;base64,${TINY_PNG.toString('base64')}`;

async function bootAndSeed(page) {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/#/home');
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  await page.evaluate(() => localStorage.clear());
  const now = new Date();
  const month = monthKeyOf(now);
  const firstOfMonth = `${month}-01`;
  await page.evaluate(({ month, firstOfMonth, proof }) => {
    const state = {
      version: 1,
      nextCustomerNumber: 2,
      customers: [
        {
          id: 'seed-proof', customerNumber: 1, name: 'E2E Proof Tester', mohalla: 'BARRIAN', phone: '',
          monthlySellingAmount: 3000,
          monthlyPriceSchedule: [{ amount: 3000, effectiveMonth: month, recordedAt: `${firstOfMonth}T09:00:00.000Z` }],
          bills: [
            { id: 'bill-current', month, dueAmount: 3000, status: 'pending', dueDate: `${month}-05`, payments: [
              { id: 'pay-with-proof', date: firstOfMonth, amount: 1000, method: 'Easypaisa', screenshot: proof },
              { id: 'pay-plain', date: firstOfMonth, amount: 500, method: 'Cash' }
            ] }
          ],
          archived: false
        }
      ]
    };
    localStorage.setItem('shahdara-isp-billing-v1', JSON.stringify(state));
  }, { month, firstOfMonth, proof: SEEDED_PROOF });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  return { month, today: dateKeyOf(now) };
}

test.describe('Payment proof screenshot (owner feature)', () => {
  test('attaches compressed proof at save and views it from history', async ({ page }) => {
    const errors = trackErrors(page);
    const { month, today } = await bootAndSeed(page);

    // Open the seeded customer's profile.
    await page.goto('/#/customers');
    const row = page.locator('#customerList [data-customer-id]').first();
    await row.click();
    await expect(page.locator('#detailName')).toHaveText('E2E Proof Tester');

    // History: exactly one proof thumbnail (the proof payment only).
    const monthCard = page.locator(`details[data-month-card="${month}"]`);
    await monthCard.evaluate((el) => { el.open = true; });
    const proofButtons = page.locator('[data-view-proof]');
    await expect(proofButtons).toHaveCount(1);

    // The viewer dialog shows exactly the stored image.
    await proofButtons.first().click();
    const dialog = page.locator('#paymentProofDialog');
    await expect(dialog).toBeVisible();
    await expect(page.locator('#paymentProofImage')).toHaveAttribute('src', SEEDED_PROOF);
    await page.locator('#paymentProofCloseBtn').click();
    await expect(dialog).toBeHidden();

    // Record a new payment WITH a picked screenshot via the profile form.
    const form = page.locator(`form[data-kind="payment"][data-month="${month}"]`);
    await expect(form.locator('input[name="proofScreenshot"]')).toHaveCount(1);
    await form.locator('input[name="amount"]').fill('500');
    await form.locator('select[name="method"]').selectOption('Easypaisa');
    await form.locator('input[name="date"]').fill(today);
    await form.locator('input[name="proofScreenshot"]').setInputFiles({ name: 'wallet.png', mimeType: 'image/png', buffer: TINY_PNG });
    await form.locator('button[type="submit"]').click();

    // The stored payment carries a compressed JPEG proof within the cap.
    await expect.poll(async () => page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('shahdara-isp-billing-v1'));
      const bill = state.customers[0].bills.find(b => b.payments.some(p => p.amount === 500 && p.method === 'Easypaisa'));
      const payment = bill?.payments.find(p => p.amount === 500 && p.method === 'Easypaisa');
      return payment?.screenshot ?? null;
    })).toMatch(/^data:image\/jpeg;base64,/);
    const storedProof = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('shahdara-isp-billing-v1'));
      return state.customers[0].bills.flatMap(b => b.payments).find(p => p.amount === 500 && p.method === 'Easypaisa').screenshot;
    });
    expect(storedProof.length).toBeLessThanOrEqual(200_000);

    // …and its history row now offers the proof viewer too.
    await expect(page.locator('[data-view-proof]')).toHaveCount(2);

    // No page errors, no horizontal overflow at 360px.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
});
