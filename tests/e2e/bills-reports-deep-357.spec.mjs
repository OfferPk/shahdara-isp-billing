/**
 * bills-reports-deep-357.spec.mjs
 * Issue #357: deep functional test of Bills, Reports, Recovery and
 * Alerts. Seeds fees for everyone plus one payment, then exercises:
 * monthly report totals/search/sort/CSV, Generate bills, bill
 * invoices dialog, bulk reminder dispatch, Smart Alerts, the Dues
 * Recovery panel + #/recovery route + WhatsApp draft links, and the
 * profile bill form (due date save) + account statement dialog.
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

async function qcPayFirst(page) {
  await page.locator('#quickAddPaymentButton').click();
  const modal = page.locator('#quickCollectModal');
  await expect(modal).toBeVisible();
  await modal.locator('.qc-customer-card', { hasText: 'Test Customer 01' }).first().click();
  await page.locator('#quickCollectConfirmBtn').click();
  await expect(page.locator('#quickCollectStepSuccess')).toBeVisible();
  await page.locator('#quickCollectDoneCloseBtn').click();
  await expect(modal).toBeHidden();
}

test.describe('Issue 357: Bills, Reports, Recovery, Alerts deep test', () => {
  test.setTimeout(150000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/#/home');
    await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached' });
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('#quickAddPaymentButton', { state: 'attached' });
  });

  test('reports: totals, search, sort, CSV, generate bills, dialogs', async ({ page }) => {
    const errors = trackErrors(page);
    await seedFees(page);
    await qcPayFirst(page);

    await page.goto('/#/reports');
    const view = page.locator('#billingReportsView');
    await expect(view).toBeVisible();
    // 74 customers x Rs 1,000 billed; Test Customer 01 paid 1,000.
    await expect(page.locator('#reportSummaryBilled')).toContainText('74,000');
    await expect(page.locator('#reportSummaryBalance')).toContainText('73,000');

    // Search narrows to one customer.
    await page.locator('#reportCustomerSearch').fill('Test Customer 01');
    await expect(page.locator('#monthlyReportList')).toContainText('Test Customer 01');
    await expect(page.locator('#monthlyReportCount')).toContainText('1');
    await page.locator('#reportCustomerSearch').fill('');
    await expect(page.locator('#monthlyReportCount')).not.toContainText('1 customer');

    // Sort select cycles without errors.
    const sort = page.locator('#reportSortSelect');
    for (const v of await sort.evaluate(el => [...el.options].map(o => o.value))) {
      await sort.selectOption(v);
    }

    // CSV export downloads.
    const [dl] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#exportMonthlyReportCsvBtn').click()
    ]);
    expect(dl.suggestedFilename()).toMatch(/\.csv$/i);

    // Bulk reminder opens the batch slips modal (pending slips mode).
    const batchModal = page.locator('#batchReceiptModal');
    await page.locator('#bulkReminderDispatchBtn').click();
    await expect(batchModal).toBeVisible();
    await expect(page.locator('#toast')).toContainText('pending customer slips');
    await page.locator('#batchReceiptModalCloseBtn').click();
    await expect(batchModal).toBeHidden();

    expect(errors).toEqual([]);
  });

  test('bills screen: generate bills + invoices modal + unbilled filter', async ({ page }) => {
    const errors = trackErrors(page);
    await seedFees(page);

    // The bills actions bar only exists on the #/bills screen (#287:
    // bills / reports / recovery / alerts are separate screens over
    // one shared view, gated by data-report-screen).
    await page.goto('/#/bills');
    await expect(page.locator('#billingReportsView')).toHaveAttribute('data-report-screen', 'bills');
    await page.locator('#generateBillsBtn').click();
    await expect(page.locator('#billsActionsNote')).toContainText('up to date for 74 customer(s)');
    await expect(page.locator('#toast')).toContainText('up to date');

    await page.locator('#billsInvoicesBtn').click();
    const batchModal = page.locator('#batchReceiptModal');
    await expect(batchModal).toBeVisible();
    await expect(page.locator('#batchReceiptModalTitle')).toContainText('Customer Billing Slips');
    await page.locator('#batchReceiptModalCloseBtn').click();
    await expect(batchModal).toBeHidden();

    // Unbilled customers: with fees set for everyone this is an empty
    // filter result, and switching back restores the full list.
    await page.locator('#unbilledCustomersBtn').click();
    await expect(page.locator('#monthlyReportEmpty')).toBeVisible();
    await page.locator('[data-report-filter="all"]').click();
    await expect(page.locator('#monthlyReportEmpty')).toBeHidden();

    expect(errors).toEqual([]);
  });

  test('recovery + alerts: dues groups, WhatsApp drafts, smart alerts render', async ({ page }) => {
    const errors = trackErrors(page);
    await seedFees(page);
    await qcPayFirst(page);

    await page.goto('/#/recovery');
    await expect(page.locator('#billingReportsView')).toBeVisible();
    const groups = page.locator('#duesRecoveryGroups');
    await expect(groups).toContainText('Test Customer 02');
    await expect(groups).not.toContainText('Test Customer 01');
    // Without a saved phone the card explains what is missing; give
    // Test Customer 02 a phone via his profile, then the WhatsApp draft appears.
    await expect(groups).toContainText('A saved full international WhatsApp number is required.');
    await page.goto('/#/customers');
    await page.waitForSelector('#customerList [data-customer-id]');
    await page.locator('#customerList [data-customer-id]', { hasText: 'Test Customer 02' }).first().click();
    await page.locator('#profileTabInfo').click();
    await page.locator('#editProfileButton').click();
    await page.locator('#phoneInput').fill('+923001234567');
    await page.locator('#saveMohallaButton').click();
    await page.waitForTimeout(600);
    await page.goto('/#/recovery');
    const waLinks = page.locator('#duesRecoveryGroups a[href*="wa.me"]');
    expect(await waLinks.count()).toBeGreaterThan(0);

    // Smart Alerts live on their own #/alerts screen (same shared view).
    await page.goto('/#/alerts');
    await expect(page.locator('#billingReportsView')).toHaveAttribute('data-report-screen', 'alerts');
    const alerts = page.locator('#smartAlertsPanel');
    await expect(alerts).toBeVisible();
    const summary = await page.locator('#smartAlertsSummary').textContent();
    const items = await page.locator('#smartAlertsList > *').count();
    expect((summary || '').trim().length + items).toBeGreaterThan(0);
    await page.goto('/#/recovery');

    // Worklists dialog opens from the recovery panel.
    await page.locator('#openWorklistsFromDuesBtn').click();
    await expect(page.locator('#workListModal')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#workListModal')).toBeHidden();

    expect(errors).toEqual([]);
  });

  test('bills: profile bill form saves a due date; statement dialog opens', async ({ page }) => {
    const errors = trackErrors(page);
    await seedFees(page);

    await page.goto('/#/customers');
    await page.waitForSelector('#customerList [data-customer-id]');
    await page.locator('#customerList [data-customer-id]', { hasText: 'Test Customer 02' }).first().click();
    await expect(page.locator('#detailName')).toHaveText('Test Customer 02');

    // Current month section: the bill form saves a due date.
    const billForm = page.locator('form.bill-form').first();
    await expect(billForm).toBeVisible();
    const due = billForm.locator('input[name="dueDate"]');
    await due.fill('2026-10-25');
    await billForm.locator('button[type="submit"]').click();
    await expect(page.locator('#toast')).toContainText(/bill/i);

    // Statement dialog opens and closes.
    await page.locator('#openAccountStatementBtn').click();
    await page.waitForTimeout(500);
    const stmt = page.locator('dialog[open]');
    await expect(stmt).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(stmt).toHaveCount(0);

    expect(errors).toEqual([]);
  });
});
