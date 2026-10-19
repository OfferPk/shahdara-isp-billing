import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) errors.push(m.text());
  });
  return errors;
}

test.describe('Digital Payments (Issue #224): JazzCash / Easypaisa / Raast / Bank and Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();

    // Setup initial customer packages so dues exist
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

    if (!await modal.isVisible()) {
      await page.locator('#quickAddPaymentButton').click();
      await expect(modal).toBeVisible();
    }
  });

  test('Quick Collect digital flow with Transaction ID & receipt badge', async ({ page }) => {
    const errors = trackErrors(page);

    const modal = page.locator('#quickCollectModal');
    await expect(modal).toBeVisible();

    // 1. Pick first customer
    const customerCard = modal.locator('.qc-customer-card').first();
    await expect(customerCard).toBeVisible();
    const custName = (await customerCard.locator('.qc-cust-name').textContent()).trim();
    await customerCard.click();

    // 2. Form is visible. Initially Cash is selected and digital fields are hidden
    const digitalFields = page.locator('#quickCollectDigitalFields');
    await expect(digitalFields).toBeHidden();

    // 3. Tap JazzCash method chip
    const jcChip = page.locator('.quick-method-chip[data-method="JazzCash"]');
    await jcChip.click();
    await expect(jcChip).toHaveClass(/is-active/);

    // 4. Digital fields container is now visible
    await expect(digitalFields).toBeVisible();
    const txnInput = page.locator('#quickCollectTransactionIdInput');
    await expect(txnInput).toBeVisible();

    // 5. Enter Transaction ID
    await txnInput.fill('TXN-JC-44556677');

    // 6. Confirm payment
    await page.locator('#quickCollectConfirmBtn').click();

    // 7. Success receipt slip is shown with Transaction ID badge
    const stepSuccess = page.locator('#quickCollectStepSuccess');
    await expect(stepSuccess).toBeVisible();

    const receiptCard = page.locator('#quickCollectReceiptCard');
    await expect(receiptCard).toBeVisible();
    await expect(receiptCard).toContainText(custName);
    await expect(receiptCard).toContainText('JazzCash');
    await expect(receiptCard).toContainText('TXN-JC-44556677');

    expect(errors).toEqual([]);
  });

  test('Duplicate Transaction ID detection prompts warning confirmation', async ({ page }) => {
    const errors = trackErrors(page);
    const modal = page.locator('#quickCollectModal');
    await expect(modal).toBeVisible();

    // 1. Record first payment with Transaction ID 'DUP-REF-112233'
    const cust1 = modal.locator('.qc-customer-card').nth(0);
    await cust1.click();

    await page.locator('.quick-method-chip[data-method="Raast"]').click();
    await page.locator('#quickCollectTransactionIdInput').fill('DUP-REF-112233');
    await page.locator('#quickCollectConfirmBtn').click();
    await expect(page.locator('#quickCollectStepSuccess')).toBeVisible();

    // 2. Click "Collect Another Customer"
    await page.locator('#quickCollectAnotherBtn').click();
    await expect(page.locator('#quickCollectStepPick')).toBeVisible();

    // 3. Pick second customer
    const cust2 = modal.locator('.qc-customer-card').nth(0);
    await cust2.click();

    // 4. Select JazzCash and enter SAME Transaction ID 'DUP-REF-112233'
    await page.locator('.quick-method-chip[data-method="JazzCash"]').click();
    await page.locator('#quickCollectTransactionIdInput').fill('DUP-REF-112233');

    // 5. Verify window.confirm is triggered with duplicate warning
    let dialogTriggered = false;
    let dialogMessage = '';
    page.once('dialog', async dialog => {
      dialogTriggered = true;
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    await page.locator('#quickCollectConfirmBtn').click();

    expect(dialogTriggered).toBe(true);
    expect(dialogMessage).toContain('Duplicate Transaction ID detected');
    expect(dialogMessage).toContain('DUP-REF-112233');

    // Success screen after accepting warning
    await expect(page.locator('#quickCollectStepSuccess')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('Owner Digital Payments Settings Modal and Monthly Report breakdown', async ({ page }) => {
    const errors = trackErrors(page);

    // Close quick collect modal if open
    const closeQcBtn = page.locator('#closeQuickCollectModalBtn');
    if (await closeQcBtn.isVisible()) {
      await closeQcBtn.click();
    }

    // Open Digital Payments Settings Modal via controller
    await page.evaluate(() => {
      window.digitalPaymentsSettingsController?.open();
    });

    const settingsModal = page.locator('#digitalPaymentsSettingsModal');
    await expect(settingsModal).toBeVisible();

    // Fill settings form
    await page.locator('#settingOwnerRaastId').fill('03009876543');
    await page.locator('#settingOwnerTillId').fill('TILL-889900');
    await page.locator('#settingOwnerAccountTitle').fill('Shahdara NOC Digital');
    await page.locator('#settingOwnerBankName').fill('Meezan Bank');
    await page.locator('#settingOwnerAccountNumber').fill('0101234567890');
    await page.locator('#settingDigitalInstructions').fill('WhatsApp screenshot after paying');

    // Submit form
    await page.locator('#saveDigitalPaymentsSettingsBtn').click();
    await expect(settingsModal).toBeHidden();

    // Verify persisted in localStorage
    const stored = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('shahdara_digital_payments_settings_v1') || '{}');
    });
    expect(stored.ownerRaastId).toBe('03009876543');
    expect(stored.ownerTillId).toBe('TILL-889900');
    expect(stored.ownerAccountTitle).toBe('Shahdara NOC Digital');

    // Navigate to Reports tab
    await page.evaluate(() => {
      window.switchView?.('reports');
    });

    const reportsView = page.locator('#billingReportsView');
    await expect(reportsView).toBeVisible();

    const methodBreakdown = page.locator('#monthlyReportMethodBreakdown');
    await expect(methodBreakdown).toBeAttached();

    expect(errors).toEqual([]);
  });
});
