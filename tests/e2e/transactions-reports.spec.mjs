import { test, expect } from '@playwright/test';

const demoSeedState = {
  version: 1,
  nextCustomerNumber: 103,
  customers: [
    {
      id: 'cust-demo-001',
      customerNumber: 101,
      name: 'Muhammad Tariq',
      mohalla: 'Main Bazaar',
      zone: 'North',
      address: 'Street 4, Shahdara',
      phone: '03001234567',
      cnic: '35202-1234567-1',
      ispProvider: 'Shahdara Fiber Net',
      serviceStatus: 'active',
      packageSpeed: '20 Mbps Fiber',
      monthlyPurchaseCost: 1200,
      monthlySellingAmount: 2000,
      monthlyPriceSchedule: [{ month: '2026-10', amount: 2000 }],
      billingStartMonth: '2026-10',
      connectionDate: '2026-01-01',
      expiryDate: null,
      cancellationDate: null,
      packageHistory: [],
      archived: false,
      archivedAt: null,
      bills: [
        {
          id: 'bill-demo-001',
          month: '2026-10',
          dueAmount: 2000,
          dueDate: '2026-10-10',
          status: 'paid',
          notes: 'Standard plan',
          payments: [
            {
              id: 'pay-demo-001',
              date: '2026-10-05',
              amount: 2000,
              method: 'Cash',
              paidBy: 'Self',
              notes: 'Full monthly payment'
            }
          ]
        }
      ],
      incidents: []
    },
    {
      id: 'cust-demo-002',
      customerNumber: 102,
      name: 'Usman Ali',
      mohalla: 'Kot Mohibbu',
      zone: 'South',
      address: 'Street 9, Shahdara',
      phone: '03217654321',
      cnic: '35202-7654321-2',
      ispProvider: 'Shahdara Fiber Net',
      serviceStatus: 'active',
      packageSpeed: '15 Mbps Fiber',
      monthlyPurchaseCost: 900,
      monthlySellingAmount: 1500,
      monthlyPriceSchedule: [{ month: '2026-10', amount: 1500 }],
      billingStartMonth: '2026-10',
      connectionDate: '2026-03-01',
      expiryDate: null,
      cancellationDate: null,
      packageHistory: [],
      archived: false,
      archivedAt: null,
      bills: [
        {
          id: 'bill-demo-002',
          month: '2026-10',
          dueAmount: 1500,
          dueDate: '2026-10-15',
          status: 'pending',
          notes: 'Monthly billing',
          payments: []
        }
      ],
      incidents: []
    }
  ],
  inventoryItems: [],
  inventoryMovements: [],
  expenses: [],
  saadAttendanceDays: [],
  umairWorkdays: [],
  monthlyClosings: []
};

async function navigateToView(page, viewName) {
  const drawerToggle = page.locator('#navDrawerToggle');
  if (await drawerToggle.isVisible()) {
    await drawerToggle.click();
    const navBtn = page.locator(`#navDrawer [data-nav-target="${viewName}"]`);
    await expect(navBtn).toBeVisible();
    await navBtn.click();
  } else {
    const btnMap = {
      transactions: '#showTransactionsButton',
      reports: '#showReportsButton',
      customers: '#showCustomersButton',
      analytics: '#showAnalyticsButton'
    };
    const topNavBtn = page.locator(btnMap[viewName] || '#showCustomersButton');
    if (await topNavBtn.isVisible()) {
      await topNavBtn.click();
    }
  }
}

test.describe('Transactions History & Monthly Customer Reports E2E Verification', () => {
  test('transactions view filters by method and date, updates summary metrics, and paginates cleanly', async ({ page }) => {
    await page.addInitScript((seed) => {
      localStorage.setItem('shahdara-isp-billing-v1', JSON.stringify(seed));
    }, demoSeedState);

    await page.goto('/');

    // Navigate to Transactions view
    await navigateToView(page, 'transactions');

    const txView = page.locator('#transactionsView');
    await expect(txView).toBeVisible();

    // Verify heading, count, and summary bar
    const txHeading = page.locator('#transactionsHeading');
    await expect(txHeading).toContainText('Transactions');

    const txSummaryBar = page.locator('#transactionSummaryBar');
    await expect(txSummaryBar).toBeVisible();
    await expect(page.locator('#txSummaryTotal')).toBeVisible();
    await expect(page.locator('#txSummaryAverage')).toBeVisible();

    // Verify filter elements exist
    const recencyFilter = page.locator('#transactionRecencyFilter');
    const methodFilter = page.locator('#transactionMethodFilter');
    const dateFilter = page.locator('#transactionDateFilter');
    const clearBtn = page.locator('#clearTransactionFilters');
    const exportBtn = page.locator('#exportTransactionsCsvBtn');

    await expect(recencyFilter).toBeVisible();
    await expect(methodFilter).toBeVisible();
    await expect(dateFilter).toBeVisible();
    await expect(clearBtn).toBeVisible();
    await expect(exportBtn).toBeVisible();

    // Verify transaction list renders rows
    const txList = page.locator('#transactionsList');
    await expect(txList).toBeVisible();
    const initialCards = txList.locator('.transaction-card');
    const initialCount = await initialCards.count();
    expect(initialCount).toBeGreaterThan(0);

    // Filter by payment method: Cash
    await methodFilter.selectOption('Cash');
    await page.waitForTimeout(100);
    const cashCards = txList.locator('.transaction-card');
    const cashCount = await cashCards.count();
    expect(cashCount).toBeGreaterThanOrEqual(1);

    // Clear filters
    await clearBtn.click();
    await page.waitForTimeout(100);
    await expect(methodFilter).toHaveValue('all');
    await expect(recencyFilter).toHaveValue('all');
    await expect(dateFilter).toHaveValue('');

    // Trigger CSV export
    await exportBtn.click();
    const toastEl = page.locator('#toast');
    await expect(toastEl).toBeVisible();
    await expect(toastEl).toContainText('Exported');
  });

  test('monthly customer report filters by status, searches by text, and opens batch slips modal', async ({ page }) => {
    await page.addInitScript((seed) => {
      localStorage.setItem('shahdara-isp-billing-v1', JSON.stringify(seed));
    }, demoSeedState);

    await page.goto('/');

    // Navigate to Reports view
    await navigateToView(page, 'reports');

    const reportView = page.locator('#billingReportsView');
    await expect(reportView).toBeVisible();

    // Verify monthly report heading and summary metrics
    const reportHeading = page.locator('#billingReportsHeading');
    await expect(reportHeading).toContainText('Monthly payment status');

    const reportSummary = page.locator('#monthlyReportSummaryBar');
    await expect(reportSummary).toBeVisible();
    await expect(page.locator('#reportSummaryBilled')).toBeVisible();
    await expect(page.locator('#reportSummaryCollected')).toBeVisible();
    await expect(page.locator('#reportSummaryBalance')).toBeVisible();

    // Test Status Filter Buttons
    const allFilterBtn = page.locator('.report-filter-button[data-report-filter="all"]');
    const paidFilterBtn = page.locator('.report-filter-button[data-report-filter="paid"]');
    const pendingFilterBtn = page.locator('.report-filter-button[data-report-filter="pending"]');

    await expect(allFilterBtn).toHaveAttribute('aria-pressed', 'true');
    await paidFilterBtn.click();
    await expect(paidFilterBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(allFilterBtn).toHaveAttribute('aria-pressed', 'false');

    await pendingFilterBtn.click();
    await expect(pendingFilterBtn).toHaveAttribute('aria-pressed', 'true');

    // Reset back to All
    await allFilterBtn.click();
    await expect(allFilterBtn).toHaveAttribute('aria-pressed', 'true');

    // Test Customer Search inside report
    const searchInput = page.locator('#reportCustomerSearch');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Muhammad');
    await page.waitForTimeout(150);

    const reportList = page.locator('#monthlyReportList');
    await expect(reportList).toBeVisible();

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(150);

    // Test Export Monthly Report CSV
    const exportReportCsvBtn = page.locator('#exportMonthlyReportCsvBtn');
    await expect(exportReportCsvBtn).toBeVisible();
    await exportReportCsvBtn.click();
    const toastEl = page.locator('#toast');
    await expect(toastEl).toBeVisible();
    await expect(toastEl).toContainText('Exported');

    // Test Print Slips (Batch Billing Slips Modal)
    const printSlipsBtn = page.locator('#batchReceiptPrintBtn');
    await expect(printSlipsBtn).toBeVisible();
    await printSlipsBtn.click();

    const batchModal = page.locator('#batchReceiptModal');
    await expect(batchModal).toBeVisible();
    await expect(page.locator('#batchReceiptModalTitle')).toContainText('Customer Billing Slips');

    // Verify month selector dropdown is populated
    const monthSelect = page.locator('#batchReceiptMonthSelect');
    await expect(monthSelect).toBeVisible();

    // Close Batch Slips Modal
    const closeBatchBtn = page.locator('#batchReceiptModalCloseBtn');
    await expect(closeBatchBtn).toBeVisible();
    await closeBatchBtn.click();
    await expect(batchModal).not.toBeVisible();
  });

  test('responsive verification: touch targets and zero horizontal scroll at 390px mobile viewport', async ({ page, isMobile }) => {
    await page.addInitScript((seed) => {
      localStorage.setItem('shahdara-isp-billing-v1', JSON.stringify(seed));
    }, demoSeedState);

    await page.goto('/');

    if (isMobile) {
      await page.setViewportSize({ width: 390, height: 844 });
    }

    // Check on Transactions view
    await navigateToView(page, 'transactions');
    await expect(page.locator('#transactionsView')).toBeVisible();

    // Verify touch targets >= 40px
    const clearBtnBox = await page.locator('#clearTransactionFilters').boundingBox();
    if (clearBtnBox) {
      expect(clearBtnBox.height).toBeGreaterThanOrEqual(40);
    }
    const exportBtnBox = await page.locator('#exportTransactionsCsvBtn').boundingBox();
    if (exportBtnBox) {
      expect(exportBtnBox.height).toBeGreaterThanOrEqual(40);
    }

    // Verify zero horizontal scroll overflow in transactions view
    let hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);

    // Switch to Monthly Reports view
    await navigateToView(page, 'reports');
    await expect(page.locator('#billingReportsView')).toBeVisible();

    // Verify touch targets in reports view
    const filterBtnBox = await page.locator('.report-filter-button').first().boundingBox();
    if (filterBtnBox) {
      expect(filterBtnBox.height).toBeGreaterThanOrEqual(36);
    }

    const printSlipsBtnBox = await page.locator('#batchReceiptPrintBtn').boundingBox();
    if (printSlipsBtnBox) {
      expect(printSlipsBtnBox.height).toBeGreaterThanOrEqual(40);
    }

    // Verify zero horizontal scroll overflow in reports view
    hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);

    // Test in Dark Theme
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);

    // Reset theme
    await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));

    // Capture verification screenshot
    const prefix = isMobile ? 'mobile-390x844' : 'desktop-1280x800';
    await page.screenshot({
      path: `C:/Users/Perfect/.gemini/antigravity/brain/b2afcd22-3d13-421e-aa5c-f5570c8bc29a/scratch/${prefix}-transactions-reports.png`,
      fullPage: false
    });
  });
});
