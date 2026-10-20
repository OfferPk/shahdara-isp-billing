import { test, expect } from '@playwright/test';

// #287: Bills, Monthly Report, Dues Recovery and Smart Alerts share one view
// element, but each screen must show only its own sections.
const view = '#billingReportsView';
const panel = {
  reportList: '#monthlyReportList',
  rankings: 'section[aria-labelledby="customerRankingHeading"]',
  comparison: 'section[aria-labelledby="monthComparisonHeading"]',
  closings: 'section[aria-labelledby="monthlyClosingHeading"]',
  alerts: '#smartAlertsPanel',
  recovery: '#duesRecoveryPanel',
  billsActions: '#billsActionsBar'
};

async function openScreen(page, route) {
  await page.goto(`/#/${route}`);
  await expect(page.locator(view)).toBeVisible();
  await expect(page.locator(view)).toHaveAttribute('data-report-screen', route);
}

test.describe('Report screens are separate (#287)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test('Smart Alerts shows only the alerts panel', async ({ page }) => {
    await openScreen(page, 'alerts');
    await expect(page.locator(panel.alerts)).toBeVisible();
    await expect(page.locator(panel.reportList)).toBeHidden();
    await expect(page.locator(panel.recovery)).toBeHidden();
    await expect(page.locator(panel.rankings)).toBeHidden();
    await expect(page.locator(panel.billsActions)).toBeHidden();
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(height).toBeLessThan(2500); // was ~19,900 px when every section rendered
  });

  test('Dues Recovery shows only the recovery panel', async ({ page }) => {
    await openScreen(page, 'recovery');
    await expect(page.locator(panel.recovery)).toBeVisible();
    await expect(page.locator(panel.alerts)).toBeHidden();
    await expect(page.locator(panel.reportList)).toBeHidden();
    await expect(page.locator(panel.rankings)).toBeHidden();
  });

  test('Monthly Bills shows the bill list and bills actions, not the report panels', async ({ page }) => {
    await openScreen(page, 'bills');
    await expect(page.locator(panel.billsActions)).toBeVisible();
    await expect(page.locator('#generateBillsBtn')).toBeVisible();
    await expect(page.locator('#unbilledCustomersBtn')).toBeVisible();
    await expect(page.locator(panel.rankings)).toBeHidden();
    await expect(page.locator(panel.comparison)).toBeHidden();
    await expect(page.locator(panel.closings)).toBeHidden();
    await expect(page.locator(panel.alerts)).toBeHidden();
    await expect(page.locator(panel.recovery)).toBeHidden();
    // The status filters the issue asks for are on this screen.
    await expect(page.locator('[data-report-filter="paid"]')).toBeVisible();
    await expect(page.locator('[data-report-filter="pending"]')).toBeVisible();
    await expect(page.locator('[data-report-filter="partial"]')).toBeVisible();
  });

  test('Monthly Report keeps the report and rankings but hides alerts and recovery', async ({ page }) => {
    await openScreen(page, 'reports');
    await expect(page.locator(panel.rankings)).toBeVisible();
    await expect(page.locator(panel.comparison)).toBeVisible();
    await expect(page.locator(panel.alerts)).toBeHidden();
    await expect(page.locator(panel.recovery)).toBeHidden();
    await expect(page.locator(panel.billsActions)).toBeHidden();
  });

  test('switching screens restores sections (nothing is removed)', async ({ page }) => {
    await openScreen(page, 'alerts');
    await expect(page.locator(panel.reportList)).toBeHidden();
    await openScreen(page, 'reports');
    await expect(page.locator(panel.reportList)).toBeVisible();
    await openScreen(page, 'bills');
    await expect(page.locator(panel.billsActions)).toBeVisible();
  });
});

test.describe('Customer rankings are limited to the top 10 (#287)', () => {
  test('top 10 by default with a Show all toggle', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const customers = Array.from({ length: 12 }, (_, i) => ({
      id: `seed-rank-${i + 1}`,
      customerNumber: 900 + i,
      name: `Ranking Customer ${i + 1}`,
      phone: '03000000000',
      mohalla: 'Shahdara',
      packageSpeed: '10 Mbps',
      serviceStatus: 'active',
      archived: false,
      bills: [{
        id: `seed-bill-${i + 1}`,
        month,
        dueAmount: 1000,
        dueDate: `${month}-05`,
        status: 'paid',
        payments: [{ id: `seed-pay-${i + 1}`, date: `${month}-06`, amount: 500 + i * 100, method: 'Cash' }]
      }]
    }));
    await page.goto('/');
    await page.evaluate(({ customers }) => {
      localStorage.setItem('shahdara-isp-billing-v1', JSON.stringify({ customers }));
    }, { customers });
    await page.goto('/#/reports');
    await expect(page.locator(view)).toBeVisible();
    const cards = page.locator('#customerRankingResults .owner-result-card');
    await expect(cards).toHaveCount(10);
    const toggle = page.locator('#rankingShowAllBtn');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveText(/Show all \d+ rankings/);
    const total = Number((await toggle.textContent()).match(/\d+/)[0]);
    expect(total).toBeGreaterThan(10);
    await toggle.click();
    await expect(cards).toHaveCount(total);
    await expect(toggle).toHaveText(/Show top 10 only/);
  });
});
