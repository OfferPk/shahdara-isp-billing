// SISP-17: Monthly Complaint and Outage Report Generator.
// Written to run in CI (the repo Playwright runner cannot run in the dev
// VM). Seeds October complaints directly into sisp_complaints_ledger_v1,
// then checks the dashboard report card, the report modal's 4 sections for
// the selected month, the CSV/print/copy actions, and 390px no-overflow.
import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) errors.push(m.text()); });
  return errors;
}

async function boot(page) {
  await page.goto('/#/home');
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

async function seedComplaints(page) {
  await page.evaluate(() => {
    const complaints = [
      { id: 'CMP-101', customerId: 'seed-c1', customerName: 'SEED CUSTOMER', zone: 'Shahdara Town', issueCategory: 'Fiber Cut', reportedAt: '2026-10-05T10:00', resolvedAt: '2026-10-05T14:00', downtimeHours: 4, downtimeManual: false, status: 'Resolved', resolutionNote: 'Splice repaired', createdAt: '' },
      { id: 'CMP-102', customerId: 'seed-c1', customerName: 'SEED CUSTOMER', zone: 'Shahdara Town', issueCategory: 'Fiber Cut', reportedAt: '2026-10-06T09:00', resolvedAt: '2026-10-06T11:30', downtimeHours: 2.5, downtimeManual: false, status: 'Resolved', resolutionNote: '', createdAt: '' },
      { id: 'CMP-103', customerId: 'seed-c2', customerName: 'SEED SECOND', zone: 'Barrian', issueCategory: 'WAPDA / Power Outage', reportedAt: '2026-10-08T18:00', resolvedAt: '', downtimeHours: null, downtimeManual: false, status: 'Open', resolutionNote: '', createdAt: '' },
      { id: 'CMP-090', customerId: 'seed-c1', customerName: 'SEED CUSTOMER', zone: 'Shahdara Town', issueCategory: 'Fiber Cut', reportedAt: '2026-09-20T10:00', resolvedAt: '2026-09-20T12:00', downtimeHours: 2, downtimeManual: false, status: 'Resolved', resolutionNote: '', createdAt: '' }
    ];
    localStorage.setItem('sisp_complaints_ledger_v1', JSON.stringify(complaints));
  });
}

test('dashboard report card and modal show the October 4-part report', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedComplaints(page);
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });

  await expect(page.locator('#dashboardMonthlyReportValue')).toContainText('3 complaints');
  await page.click('#openMonthlyComplaintReportModalBtn');
  await expect(page.locator('#monthlyComplaintReportModal')).toBeVisible();
  await page.fill('#monthlyComplaintReportMonth', '2026-10');
  await page.locator('#monthlyComplaintReportMonth').dispatchEvent('change');
  await expect(page.locator('#monthlyReportSummaryLine')).toContainText('3 complaints');
  await expect(page.locator('#monthlyReportSummaryCards')).toContainText('6.5 h');
  await expect(page.locator('#monthlyReportCustomerTable')).toContainText('SEED CUSTOMER');
  await expect(page.locator('#monthlyReportCustomerTable')).toContainText('Pending (1)');
  await expect(page.locator('#monthlyReportCauseTable')).toContainText('Fiber Cut');
  await expect(page.locator('#monthlyReportLogTable')).toContainText('CMP-101');
  await expect(page.locator('#monthlyReportLogTable')).not.toContainText('CMP-090');
  await expect(page.locator('#monthlyReportSummaryText')).toHaveValue(/Kul 3 shikayat/);
  await expect(page.locator('#monthlyReportPrintBtn')).toBeVisible();
  await expect(page.locator('#monthlyReportCsvBtn')).toBeVisible();
  await expect(page.locator('#monthlyReportCopyBtn')).toBeVisible();
  expect(errors).toEqual([]);
});

test('report modal has no horizontal overflow at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page);
  await seedComplaints(page);
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  await page.click('#openMonthlyComplaintReportModalBtn');
  await expect(page.locator('#monthlyComplaintReportModal')).toBeVisible();
  const overflow = await page.evaluate(() => {
    const dialog = document.getElementById('monthlyComplaintReportModal');
    return dialog.scrollWidth > dialog.clientWidth + 1;
  });
  expect(overflow).toBe(false);
});
