// SISP-21: Digital Wallet Ledger e2e spec (CI only — Playwright cannot run
// in the dev VM). Seeds the real storage key and covers: dashboard wallet
// card, ledger modal breakdown, 1-tap verification toggle, duplicate TID
// warning on the payment form, and 390px no-overflow.
import { test, expect } from '@playwright/test';

const SEED = {
  version: 1,
  customers: [
    {
      id: 'cust-wallet-1',
      customerNumber: 1,
      name: 'Wallet E2E Alpha',
      area: 'Kala Khata',
      archived: false,
      bills: [
        {
          id: 'bill-wallet-1',
          month: '2026-10',
          dueAmount: 3000,
          status: 'pending',
          payments: [
            { id: 'pay-wallet-1', date: '2026-10-05', amount: 3000, method: 'Easypaisa', transactionId: '12345678901' }
          ],
          amountHistory: []
        }
      ]
    }
  ]
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript((seed) => {
    localStorage.setItem('shahdara-isp-billing-v1', JSON.stringify(seed));
  }, SEED);
  await page.goto('/');
});

test('SISP-21: wallet ledger card opens the modal with breakdown and toggle', async ({ page }) => {
  await expect(page.locator('#openWalletLedgerModalBtn')).toBeVisible();
  await page.locator('#openWalletLedgerModalBtn').click();
  await expect(page.locator('#walletLedgerModal')).toBeVisible();
  await expect(page.locator('#walletLedgerBreakdown')).toContainText('Easypaisa');
  await expect(page.locator('#walletLedgerPaymentList')).toContainText('Pending Screenshot Verification');
  const toggle = page.locator('[data-wallet-toggle]').first();
  await toggle.click();
  await expect(page.locator('#walletLedgerPaymentList')).toContainText('Verified in Statement');
});

test('SISP-21: a duplicate TID on the payment form shows the conflict warning', async ({ page }) => {
  await page.locator('#customerList [data-customer-id]').first().click();
  await expect(page.locator('[name="transactionId"]')).toBeVisible();
  await page.locator('[name="transactionId"]').fill('12345678901');
  await page.locator('[name="amount"]').fill('3000');
  await page.locator('button[type="submit"]').first().click();
  await expect(page.locator('#appConfirmDialog')).toBeVisible();
});

test('SISP-21: wallet ledger has no horizontal overflow at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#openWalletLedgerModalBtn').click();
  await expect(page.locator('#walletLedgerModal')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});
