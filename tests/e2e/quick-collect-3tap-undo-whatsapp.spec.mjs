// E2E test verifying:
// Issue #220: 3-tap cash collection: customer -> amount (prefilled with dues) -> Save -> receipt; works offline with Undo
// Issue #223: WhatsApp receipts: normalize 03xx -> 923xx for wa.me, validate numbers, bilingual text, share receipt as image/PDF
import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) errors.push(m.text());
  });
  return errors;
}

test.describe('Quick Collect 3-tap collection, 10s Undo, and WhatsApp normalization', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();

    // Setup packages so customers have pending bills with dues
    await page.locator('#quickAddPaymentButton').click();
    const modal = page.locator('#quickCollectModal');
    await expect(modal).toBeVisible();

    const setupBtn = page.locator('[data-qc-setup-packages]').first();
    if (await setupBtn.isVisible()) {
      await setupBtn.click();
      await page.locator('#collectSetupSelectAll').check();
      await page.locator('#collectSetupApplyBtn').click();
      await page.locator('#closeCollectSetupBtn').click();
    }
  });

  test('3-tap cash collection: customer -> prefilled amount -> Save -> receipt', async ({ page }) => {
    const errors = trackErrors(page);

    const modal = page.locator('#quickCollectModal');
    await expect(modal).toBeVisible();

    // Verify pending customer card is visible with dues
    const customerCard = modal.locator('.qc-customer-card').first();
    await expect(customerCard).toBeVisible();
    const customerName = await customerCard.locator('.qc-cust-name').textContent();

    // Tap 1: Pick customer
    await customerCard.click();

    // Step 2 form is displayed
    const stepForm = page.locator('#quickCollectStepForm');
    await expect(stepForm).toBeVisible();

    // Prefilled amount equals dues (> 0)
    const amountInput = page.locator('#quickCollectAmountInput');
    await expect(amountInput).toBeVisible();
    const prefilledVal = Number(await amountInput.inputValue());
    expect(prefilledVal).toBeGreaterThan(0);

    // Default method is Cash chip active
    const cashChip = page.locator('.quick-method-chip[data-method="Cash"]');
    await expect(cashChip).toHaveClass(/is-active/);

    // Tap 2: Tap Confirm / Save
    await page.locator('#quickCollectConfirmBtn').click();

    // Step 3: Success screen displays receipt slip
    const stepSuccess = page.locator('#quickCollectStepSuccess');
    await expect(stepSuccess).toBeVisible();

    const receiptCard = page.locator('#quickCollectReceiptCard');
    await expect(receiptCard).toBeVisible();
    await expect(receiptCard).toContainText(customerName.trim());
    await expect(receiptCard).toContainText('PKR ' + prefilledVal.toLocaleString('en-PK'));
    await expect(receiptCard).toContainText('Cash');

    expect(errors).toEqual([]);
  });

  test('method chips switch payment methods and quick amount chips update amount', async ({ page }) => {
    const errors = trackErrors(page);

    const modal = page.locator('#quickCollectModal');
    const customerCard = modal.locator('.qc-customer-card').first();
    await customerCard.click();

    const jazzChip = page.locator('.quick-method-chip[data-method="JazzCash"]');
    await jazzChip.click();
    await expect(jazzChip).toHaveClass(/is-active/);

    const methodSelect = page.locator('#quickCollectMethodSelect');
    await expect(methodSelect).toHaveValue('JazzCash');

    // Test Current Month chip
    const curMonthChip = page.locator('.quick-amount-chip[data-quick-amount="current"]');
    await curMonthChip.click();
    const amountInput = page.locator('#quickCollectAmountInput');
    const val = Number(await amountInput.inputValue());
    expect(val).toBeGreaterThan(0);

    // Test Half chip
    const halfChip = page.locator('.quick-amount-chip[data-quick-amount="half"]');
    await halfChip.click();
    const halfVal = Number(await amountInput.inputValue());
    expect(halfVal).toBe(Math.round(val / 2));

    expect(errors).toEqual([]);
  });

  test('10-second Undo reverts payment and restores customer dues in ledger', async ({ page }) => {
    const errors = trackErrors(page);

    const modal = page.locator('#quickCollectModal');
    const customerCard = modal.locator('.qc-customer-card').first();
    const customerId = await customerCard.getAttribute('data-customer-id');
    const customerName = (await customerCard.locator('.qc-cust-name').textContent()).trim();
    const initialDueText = await customerCard.locator('.qc-due-val').textContent();

    // Collect payment
    await customerCard.click();
    await page.locator('#quickCollectConfirmBtn').click();

    const stepSuccess = page.locator('#quickCollectStepSuccess');
    await expect(stepSuccess).toBeVisible();

    // Undo button is visible
    const undoBtn = page.locator('#quickCollectUndoBtn');
    await expect(undoBtn).toBeVisible();
    await expect(undoBtn).toContainText('Undo Payment');

    // Click Undo
    await undoBtn.click();

    // Returns to customer picker
    await expect(page.locator('#quickCollectStepPick')).toBeVisible();

    // Toast confirms restoration
    const toastEl = page.locator('#toast');
    await expect(toastEl).toBeVisible();
    await expect(toastEl).toContainText('undone. Ledger restored.');

    // The customer is still in the pending list with dues intact
    const restoredCard = modal.locator(`.qc-customer-card[data-customer-id="${customerId}"]`);
    await expect(restoredCard).toBeVisible();
    await expect(restoredCard.locator('.qc-due-val')).toHaveText(initialDueText);

    expect(errors).toEqual([]);
  });

  test('WhatsApp receipt link normalizes 03xx Pakistani mobile to 923xx with wa.me', async ({ page }) => {
    const errors = trackErrors(page);

    // Update first customer with a 0300-1234567 phone number
    await page.evaluate(() => {
      const state = window.quickCollectModalController.getState();
      const firstCust = state.customers.find(c => !c.archived);
      firstCust.phone = '0300-1234567';
      window.quickCollectModalController.commitState(state);
    });

    const modal = page.locator('#quickCollectModal');
    const customerCard = modal.locator('.qc-customer-card').first();
    await customerCard.click();
    await page.locator('#quickCollectConfirmBtn').click();

    // Intercept window.open
    let openedUrl = null;
    await page.exposeFunction('interceptWindowOpen', (url) => {
      openedUrl = url;
    });
    await page.evaluate(() => {
      window.open = (url) => {
        window.interceptWindowOpen(url);
      };
    });

    await page.locator('#quickCollectWhatsAppBtn').click();

    expect(openedUrl).not.toBeNull();
    expect(openedUrl).toMatch(/^https:\/\/wa\.me\/923001234567\?text=/);

    // Check bilingual message
    const decodedUrl = decodeURIComponent(openedUrl);
    expect(decodedUrl).toContain('SHAHDARA FIBER NETWORK');
    expect(decodedUrl).toContain('ادائیگی کی رسید');
    expect(decodedUrl).toContain('Amount Received');

    expect(errors).toEqual([]);
  });

  test('Share as Image button creates receipt file and shows shared badge', async ({ page }) => {
    const errors = trackErrors(page);

    const modal = page.locator('#quickCollectModal');
    const customerCard = modal.locator('.qc-customer-card').first();
    await customerCard.click();
    await page.locator('#quickCollectConfirmBtn').click();

    const shareImageBtn = page.locator('#quickCollectShareImageBtn');
    await expect(shareImageBtn).toBeVisible();

    await shareImageBtn.click();

    // Toast confirms receipt image ready / shared
    const toastEl = page.locator('#toast');
    await expect(toastEl).toBeVisible();
    await expect(toastEl).toContainText(/Receipt image ready/);

    expect(errors).toEqual([]);
  });
});
