/**
 * payments-deep-356.spec.mjs
 * Issue #356: deep functional test of the Payments screens.
 * Seeds real payments through Quick Collect (Cash, Bank Transfer via
 * the Bank chip, partial JazzCash), then exercises the Transactions
 * screen end to end: summary math, method filters, amount sort, row
 * expand, inline Edit (correction), Delete + Undo, and CSV export.
 *
 * Regression covered: the Bank chip used data-method="Bank" (not a
 * canonical method), which emptied the method select and silently
 * recorded the payment as Cash.
 */
import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  return errors;
}

async function seedFees(page) {
  await page.evaluate(() => window.collectSetup?.open());
  await page.locator('#collectSetupSelectAll').check();
  await page.locator('#collectSetupApplyBtn').click();
  await page.waitForSelector('#collectSetupModal', { state: 'hidden', timeout: 15000 });
}

async function qcPay(page, name, { method = null, amount = null, txn = null } = {}) {
  await page.locator('#quickAddPaymentButton').click();
  const modal = page.locator('#quickCollectModal');
  await expect(modal).toBeVisible();
  const card = modal.locator('.qc-customer-card', { hasText: name }).first();
  await expect(card).toBeVisible();
  await card.click();
  if (method) await page.locator(`.quick-method-chip[data-method="${method}"]`).click();
  if (amount !== null) await page.locator('#quickCollectAmountInput').fill(String(amount));
  if (txn) await page.locator('#quickCollectTransactionIdInput').fill(txn);
  await page.locator('#quickCollectConfirmBtn').click();
  await expect(page.locator('#quickCollectStepSuccess')).toBeVisible();
  await page.locator('#quickCollectDoneCloseBtn').click();
  await expect(modal).toBeHidden();
}

test.describe('Issue 356: Payments screens deep functional test', () => {
  test.setTimeout(150000);
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/home');
    await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached' });
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('#quickAddPaymentButton', { state: 'attached' });
  });

  test('transactions: seed 3 payments, filter, sort, edit, delete+undo, export', async ({ page }) => {
    const errors = trackErrors(page);
    await seedFees(page);
    await qcPay(page, 'NAZEER', {}); // full 1000 Cash (defaults)
    await qcPay(page, 'AWAIS', { method: 'Bank Transfer', txn: 'BANKTXN123' }); // full 1000 via Bank chip
    await qcPay(page, 'TEHMENA', { method: 'JazzCash', amount: 400, txn: 'JC-9001' }); // partial 400

    // Regression: the Bank payment must be stored as Bank Transfer, not Cash.
    const stored = await page.evaluate(() => {
      const st = window.quickCollectModalController?.getState?.();
      const out = [];
      for (const c of st.customers) for (const b of c.bills || []) for (const p of b.payments || []) out.push(`${c.name}:${p.method}:${p.amount}`);
      return out.sort();
    });
    expect(stored).toEqual(['AWAIS:Bank Transfer:1000', 'NAZEER:Cash:1000', 'TEHMENA:JazzCash:400']);

    await page.goto('/#/transactions');
    await expect(page.locator('#transactionsCount')).toContainText('3 of 3 recorded payments');
    await expect(page.locator('#txSummaryTotal')).toHaveText('PKR 2,400');

    // Method filter: Bank Transfer shows only AWAIS.
    await page.locator('#transactionMethodFilter').selectOption('Bank Transfer');
    await expect(page.locator('#transactionsList [data-payment-row]')).toHaveCount(1);
    await expect(page.locator('#transactionsList')).toContainText('AWAIS');
    await expect(page.locator('#txSummaryTotal')).toHaveText('PKR 1,000');
    // Method filter: Cash shows only NAZEER (the Bank payment must not leak in).
    await page.locator('#transactionMethodFilter').selectOption('Cash');
    await expect(page.locator('#transactionsList [data-payment-row]')).toHaveCount(1);
    await expect(page.locator('#transactionsList')).toContainText('NAZEER');
    await page.locator('#transactionMethodFilter').selectOption('all');
    await expect(page.locator('#transactionsList [data-payment-row]')).toHaveCount(3);

    // Sort by amount ascending: TEHMENA (400) first.
    await page.locator('#transactionSortSelect').selectOption('amount-asc');
    await expect(page.locator('#transactionsList [data-payment-row]').first()).toContainText('TEHMENA');

    // Expand AWAIS row -> actions; Edit amount 1000 -> 900 inline.
    // (Locate by payment id: the correction form replaces the row's
    // content and no longer contains the customer name.)
    const awaisRow = page.locator('#transactionsList [data-payment-row]', { hasText: 'AWAIS' });
    const awaisPid = await awaisRow.getAttribute('data-payment-row');
    await awaisRow.locator('.tx-row').click();
    await awaisRow.locator('[data-transaction-edit]').click();
    const form = page.locator(`#transactionsList [data-payment-row="${awaisPid}"] form.payment-form.editing`);
    await expect(form).toBeVisible();
    await form.locator('input[name="amount"]').fill('900');
    await form.locator('button[type="submit"]').click();
    await expect(form).toBeHidden();
    await expect(page.locator('#txSummaryTotal')).toHaveText('PKR 2,300');

    // Delete TEHMENA's payment, then Undo from the toast.
    const tehRow = page.locator('#transactionsList [data-payment-row]', { hasText: 'TEHMENA' });
    await tehRow.locator('.tx-row').click();
    await tehRow.locator('[data-transaction-delete]').click();
    await page.getByRole('button', { name: 'Delete payment' }).click();
    await expect(page.locator('#transactionsCount')).toContainText('2 of 2 recorded payments');
    await page.locator('#toast .toast-action-btn', { hasText: 'Undo' }).click();
    await expect(page.locator('#transactionsCount')).toContainText('3 of 3 recorded payments');

    // CSV export downloads a file.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#exportTransactionsCsvBtn').click()
    ]);
    expect(download.suggestedFilename()).toMatch(/^transactions-.*\.csv$/);

    expect(errors).toEqual([]);
  });

  test('transactions empty state: no payments -> empty message, zero totals, no errors', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/#/transactions');
    await expect(page.locator('#transactionsCount')).toContainText('0 of 0 recorded payments');
    await expect(page.locator('#transactionsEmpty')).toBeVisible();
    await expect(page.locator('#txSummaryTotal')).toHaveText('PKR 0');
    expect(errors).toEqual([]);
  });
});
