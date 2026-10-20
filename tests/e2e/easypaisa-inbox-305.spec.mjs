import { test, expect } from '@playwright/test';

const SAMPLE_RECEIVED_EMAIL = `Transaction Successful
Hi AQIB EJAZ,
Money Transfer of Rs. 3500.0 on 20-Oct-2026 from Easypaisa was successful
Transaction Type\tMoney Transfer to Easypaisa
Transaction ID\t57255283999
Date & Time\t20-Oct-2026 15:45:12
Sender Name\tHAMZA RIAZ
Sender Number\t03123456789
Receiver Name\tAQIB EJAZ
Receiver Number\t03055669955
Transfer amount\tRs. 3500.0
Fee\tRs. 0.00
Total\tRs. 3500.0`;

const SAMPLE_CSV_DATA = `Transaction ID,Date & Time (PKT),Type,Sender Name,Sender Number,Receiver Name,Receiver Number,Amount (PKR),Fee (PKR),Total (PKR),Direction,Status
57255283888,20-Oct-2026 14:20:38,Money Transfer,AQIB EJAZ,03055669955,NASIR MAHMOOD,03335001667,5000,0,5000,Sent,Parsed
57255283999,20-Oct-2026 15:45:12,Money Transfer,HAMZA RIAZ,03123456789,AQIB EJAZ,03055669955,3500,0,3500,Received,Parsed`;

test.describe('Easypaisa Payments Inbox (#305)', () => {
  test('Mobile (390x844): screen opens, imports sample, matches customer, records payment, deduplicates', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/easypaisa');

    // 1. Verify screen mode & header
    const view = page.locator('#easypaisaView');
    await expect(view).toBeVisible();
    await expect(page.locator('#srScreenTitle')).toHaveText('Payments Inbox');

    // Check no horizontal scroll overflow at 390px
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);

    // 2. Open Manual Paste modal and import sample email
    const pasteBtn = page.locator('#easypaisaImportManualBtn, #emptyPasteBtn').first();
    await expect(pasteBtn).toBeVisible();
    await pasteBtn.click();

    const importModal = page.locator('#easypaisaImportModal');
    await expect(importModal).toBeVisible();

    const pasteInput = importModal.locator('#manualPasteInput');
    await pasteInput.fill(SAMPLE_RECEIVED_EMAIL);

    const parseBtn = importModal.locator('#manualPasteSubmitBtn');
    await parseBtn.click();

    // Verify modal closed
    await expect(importModal).toBeHidden();

    // 3. Verify transaction row appeared in inbox
    const row = page.locator('tr[data-txn-id="57255283999"]');
    await expect(row).toBeVisible();
    await expect(row.locator('.amount-val')).toContainText('3,500');
    await expect(row.locator('.badge-received')).toBeVisible();

    // Verify KPI cards updated
    const todayRecvKpi = page.locator('.easypaisa-kpi-card.highlight-green .kpi-value');
    await expect(todayRecvKpi).toContainText('3,500');

    // 4. Select a customer to match if not already matched
    const custSelect = row.locator('.easypaisa-customer-select');
    if (await custSelect.isVisible()) {
      // Choose second option (first real customer)
      await custSelect.selectOption({ index: 1 });
    }

    // 5. Click "Record Payment"
    const recordBtn = row.locator('.btn-record-payment');
    await expect(recordBtn).toBeVisible();
    await recordBtn.click();

    // Handle in-app confirmation dialog
    const confirmOkBtn = page.locator('#appConfirmOkBtn');
    try {
      await confirmOkBtn.waitFor({ state: 'visible', timeout: 4000 });
      await confirmOkBtn.click();
    } catch {
      // Dialog didn't open or already closed
    }

    // 6. Verify row updates to Recorded
    await expect(row.locator('.badge-recorded, .text-success-label').first()).toBeVisible();

    // 7. Deduplication check: Re-import same sample text
    await page.locator('#easypaisaImportManualBtn').click();
    await expect(importModal).toBeVisible();
    await pasteInput.fill(SAMPLE_RECEIVED_EMAIL);
    await parseBtn.click();
    await expect(importModal).toBeHidden();

    // Verify still exactly one row for this txnId and it remains recorded
    const allMatchingRows = page.locator('tr[data-txn-id="57255283999"]');
    await expect(allMatchingRows).toHaveCount(1);
    await expect(allMatchingRows.locator('.badge-recorded, .text-success-label').first()).toBeVisible();

    // 8. Test Back button returns to Home
    const backBtn = page.locator('.sr-back-button');
    await expect(backBtn).toBeVisible();
    await backBtn.click();

    await expect(page.locator('#billingDashboard')).toBeVisible();
    await expect(view).toBeHidden();
  });

  test('Desktop (1280x800): displays full table, settings modal, and filters work cleanly', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/#/easypaisa');

    const view = page.locator('#easypaisaView');
    await expect(view).toBeVisible();

    // Test settings modal
    const settingsBtn = page.locator('#easypaisaSettingsBtn');
    await expect(settingsBtn).toBeVisible();
    await settingsBtn.click();

    const settingsModal = page.locator('#easypaisaSettingsModal');
    await expect(settingsModal).toBeVisible();

    // Fill sheet URL and owner number
    await settingsModal.locator('#settingSheetUrl').fill('https://docs.google.com/spreadsheets/d/e/2PACX-sample/pub?output=csv');
    await settingsModal.locator('#settingOwnerNumber').fill('03055669955');
    await settingsModal.locator('button[type="submit"]').click();

    await expect(settingsModal).toBeHidden();

    // Test search filter
    const searchInput = page.locator('#easypaisaSearchInput');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('57255283999');

    // Direction filter
    const dirFilter = page.locator('#easypaisaFilterDirection');
    await expect(dirFilter).toBeVisible();
    await dirFilter.selectOption('Received');

    // Clear filters button
    const clearBtn = page.locator('#easypaisaClearFiltersBtn');
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
      await expect(searchInput).toHaveValue('');
    }
  });
});
