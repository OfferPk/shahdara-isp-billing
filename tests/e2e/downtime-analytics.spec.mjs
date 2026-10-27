// SISP-16: Customer-Wise and Network-Wide Downtime Hours Analytics.
// Written to run in CI (the repo Playwright runner cannot run in the dev
// VM). Seeds the spec trio of complaints directly into
// sisp_complaints_ledger_v1, then checks the dashboard downtime card, the
// analytics modal totals (3 complaints, 8.0 h total, 6.5 h Fiber Cut),
// and 390px no-overflow.
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
      { id: 'CMP-101', customerId: 'seed-c1', customerName: 'SEED CUSTOMER', zone: 'Shahdara Town', issueCategory: 'Fiber Cut', reportedAt: '2026-10-05T10:00', resolvedAt: '2026-10-05T14:00', downtimeHours: 4, downtimeManual: false, status: 'Resolved', resolutionNote: '', createdAt: '' },
      { id: 'CMP-102', customerId: 'seed-c1', customerName: 'SEED CUSTOMER', zone: 'Shahdara Town', issueCategory: 'Fiber Cut', reportedAt: '2026-10-06T09:00', resolvedAt: '2026-10-06T11:30', downtimeHours: 2.5, downtimeManual: false, status: 'Resolved', resolutionNote: '', createdAt: '' },
      { id: 'CMP-103', customerId: 'seed-c1', customerName: 'SEED CUSTOMER', zone: 'Shahdara Town', issueCategory: 'Media Converter / Charger Off', reportedAt: '2026-10-07T08:00', resolvedAt: '2026-10-07T09:30', downtimeHours: 1.5, downtimeManual: false, status: 'Resolved', resolutionNote: '', createdAt: '' }
    ];
    localStorage.setItem('sisp_complaints_ledger_v1', JSON.stringify(complaints));
  });
}

test('dashboard downtime card and analytics modal show the spec totals', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedComplaints(page);
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });

  await expect(page.locator('#downtimeAnalyticsSummary')).toContainText('SEED CUSTOMER');
  await expect(page.locator('#dashboardDowntimeValue')).not.toHaveText('No downtime');

  await page.click('#openDowntimeAnalyticsModalBtn');
  await expect(page.locator('#downtimeAnalyticsModal')).toBeVisible();
  await page.fill('#downtimeAnalyticsMonth', '2026-10');
  await expect(page.locator('#downtimeAnalyticsSummaryLine')).toContainText('3 complaints');
  await expect(page.locator('#downtimeAnalyticsSummaryLine')).toContainText('8 h total downtime');
  await expect(page.locator('#downtimeAnalyticsCauseList')).toContainText('Fiber Cut');
  await expect(page.locator('#downtimeAnalyticsCauseList')).toContainText('6.5 h');
  await expect(page.locator('#downtimeAnalyticsCustomerList')).toContainText('SEED CUSTOMER');
  await expect(page.locator('#downtimeAnalyticsCustomerList')).toContainText('8 h');

  // No horizontal overflow at 390px in the modal.
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  expect(errors).toEqual([]);
});
