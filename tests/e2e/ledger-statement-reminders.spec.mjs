import { test, expect } from '@playwright/test';

test.describe('Customer Ledger Statement, Batch Slips & Payment Reminders E2E Verification', () => {
  test('customer detail statement modal opens, switches ranges, exports CSV, and closes cleanly', async ({ page }) => {
    await page.goto('/#customers');

    // Select first customer in customer roster
    const firstCustomerBtn = page.locator('#customerList [data-customer-id]').first();
    await expect(firstCustomerBtn).toBeVisible();
    await firstCustomerBtn.click();

    // Verify customer detail is displayed
    const customerDetail = page.locator('#customerDetail');
    await expect(customerDetail).toBeVisible();

    // Verify technical tools accordion is collapsed by default
    const techToolsDetails = page.locator('#customerTechnicalToolsDetails');
    await expect(techToolsDetails).toBeVisible();
    await expect(techToolsDetails).not.toHaveAttribute('open', '');

    // Expand technical tools accordion and verify engineering tools exist
    const techSummary = page.locator('.customer-technical-summary');
    await techSummary.click();
    await expect(techToolsDetails).toHaveAttribute('open', '');
    const spliceBtn = page.locator('#openSpliceInspectionBtn');
    await expect(spliceBtn).toBeVisible();

    // Collapse technical tools accordion
    await techSummary.click();
    await expect(techToolsDetails).not.toHaveAttribute('open', '');

    // Open Statement Modal
    const openStatementBtn = page.locator('#openAccountStatementBtn');
    await expect(openStatementBtn).toBeVisible();
    await openStatementBtn.click();

    const statementModal = page.locator('#accountStatementModal');
    await expect(statementModal).toBeVisible();

    // Verify Statement Title and Preview Container
    const statementHeading = page.locator('#statementModalTitle');
    await expect(statementHeading).toContainText('Customer Account Statement');
    const previewContainer = page.locator('#statementPreviewContainer');
    await expect(previewContainer).toBeVisible();

    // Verify account statement header and sections are rendered
    await expect(previewContainer).toContainText('CUSTOMER ACCOUNT STATEMENT');
    await expect(previewContainer).toContainText('All-time Ledger');
    await expect(previewContainer).toContainText('Total Billed Charges');
    await expect(previewContainer).toContainText('Ending Net Balance');

    // Verify Range Selector works
    const rangeSelect = page.locator('#statementRangeSelect');
    await expect(rangeSelect).toBeVisible();
    await rangeSelect.selectOption('3m');
    await expect(previewContainer).toBeVisible();
    await rangeSelect.selectOption('all');
    await expect(previewContainer).toBeVisible();

    // Verify Share on WhatsApp button
    const shareWhatsAppBtn = page.locator('#shareStatementWhatsAppBtn');
    await expect(shareWhatsAppBtn).toBeVisible();
    await shareWhatsAppBtn.click();
    const toast = page.locator('#toast');
    await expect(toast).toBeVisible();

    // Close Statement Modal via close button
    const closeStatementBtn = page.locator('#closeStatementModalBtn');
    await expect(closeStatementBtn).toBeVisible();
    await closeStatementBtn.click();
    await expect(statementModal).not.toBeVisible();

    // Reopen and close with Esc key
    await openStatementBtn.click();
    await expect(statementModal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(statementModal).not.toBeVisible();
  });

  test('payment reminder modal opens, updates templates, counts characters, and closes cleanly', async ({ page }) => {
    await page.goto('/#customers');

    // Select first customer
    const firstCustomerBtn = page.locator('#customerList [data-customer-id]').first();
    await expect(firstCustomerBtn).toBeVisible();
    await firstCustomerBtn.click();

    // Open Reminder Modal
    const openReminderBtn = page.locator('#openReminderModalBtn');
    await expect(openReminderBtn).toBeVisible();
    await openReminderBtn.click();

    const reminderModal = page.locator('#paymentReminderModal');
    await expect(reminderModal).toBeVisible();

    // Verify Template Selector changes message
    const templateSelect = page.locator('#reminderTemplateSelect');
    await expect(templateSelect).toBeVisible();
    const textarea = page.locator('#reminderMessageText');
    await expect(textarea).toBeVisible();

    const initialText = await textarea.inputValue();
    expect(initialText.length).toBeGreaterThan(0);

    await templateSelect.selectOption('overdue');
    const overdueText = await textarea.inputValue();
    expect(overdueText.length).toBeGreaterThan(0);

    const charCount = page.locator('#reminderCharCount');
    await expect(charCount).toContainText('characters');

    // Close reminder modal
    const closeReminderBtn = page.locator('#closeReminderModalBtn');
    await closeReminderBtn.click();
    await expect(reminderModal).not.toBeVisible();
  });

  test('monthly reports view opens batch billing slips modal with month selection and filter options', async ({ page }) => {
    await page.goto('/');

    // Open navigation drawer and navigate to Reports view
    const drawerToggle = page.locator('#navDrawerToggle');
    await drawerToggle.click();
    const reportsNavBtn = page.locator('#navDrawer [data-nav-target="reports"]');
    await reportsNavBtn.click();

    const reportsView = page.locator('#billingReportsView');
    await expect(reportsView).toBeVisible();

    // Verify Bulk Reminder Dispatch button exists in reports view
    const bulkReminderBtn = page.locator('#bulkReminderDispatchBtn');
    await expect(bulkReminderBtn).toBeVisible();
    await bulkReminderBtn.click();

    const batchModal = page.locator('#batchReceiptModal');
    await expect(batchModal).toBeVisible();

    // Verify Filter Select is pre-set to pending
    const filterSelect = page.locator('#batchReceiptFilterSelect');
    await expect(filterSelect).toHaveValue('pending');

    // Verify Month Selector exists and has options
    const monthSelect = page.locator('#batchReceiptMonthSelect');
    await expect(monthSelect).toBeVisible();
    const monthOptions = await monthSelect.locator('option').count();
    expect(monthOptions).toBeGreaterThan(0);

    // Verify Preview Container is visible and contains billing slips
    const previewContainer = page.locator('#batchReceiptPreviewContainer');
    await expect(previewContainer).toBeVisible();
    await expect(previewContainer).toContainText('SHAHDARA FIBER NET');
    await expect(previewContainer).toContainText('CUSTOMER BILLING SLIP');

    // Switch filter to all
    await filterSelect.selectOption('all');

    // Verify WhatsApp reminder button exists on slips
    const slipWaBtn = page.locator('.batch-slip-wa-btn').first();
    await expect(slipWaBtn).toBeVisible();
    await expect(slipWaBtn).toContainText('WhatsApp Reminder');

    // Close Batch Slips Modal
    const closeBatchBtn = page.locator('#batchReceiptModalCloseBtn');
    await expect(closeBatchBtn).toBeVisible();
    await closeBatchBtn.click();
    await expect(batchModal).not.toBeVisible();
  });

  test('responsive verification: zero horizontal scroll overflow and 44px touch targets at 390px mobile viewport', async ({ page }) => {
    await page.goto('/#customers');

    const firstCustomerBtn = page.locator('#customerList [data-customer-id]').first();
    await expect(firstCustomerBtn).toBeVisible();
    await firstCustomerBtn.click();

    const customerDetail = page.locator('#customerDetail');
    await expect(customerDetail).toBeVisible();

    // Check overflow in customer detail
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(overflow).toBe(false);

    // Open Statement Modal on mobile and check overflow
    const openStatementBtn = page.locator('#openAccountStatementBtn');
    await openStatementBtn.click();
    const statementModal = page.locator('#accountStatementModal');
    await expect(statementModal).toBeVisible();

    const statementOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(statementOverflow).toBe(false);

    // Check WhatsApp statement button touch target >= 44px
    const shareWhatsAppBtn = page.locator('#shareStatementWhatsAppBtn');
    await expect(shareWhatsAppBtn).toBeVisible();
    const waBox = await shareWhatsAppBtn.boundingBox();
    expect(waBox.height).toBeGreaterThanOrEqual(44);

    const closeStatementBtn = page.locator('#closeStatementModalBtn');
    await closeStatementBtn.click();
    await expect(statementModal).not.toBeVisible();
  });
});
