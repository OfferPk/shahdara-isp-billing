import { test, expect } from '@playwright/test';

const demoSeedState = {
  version: 1,
  nextCustomerNumber: 102,
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
              method: 'cash',
              paidBy: 'Self',
              notes: 'Full monthly payment'
            }
          ]
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

test.describe('Payment Receipt Print Layouts Verification', () => {
  test('transaction list renders A4, 80mm, and 58mm thermal print options and prints correctly', async ({ page, isMobile }) => {
    // Seed localStorage and mock window.print to capture receipt format and contents
    await page.addInitScript((seed) => {
      localStorage.setItem('shahdara-isp-billing-v1', JSON.stringify(seed));
      window.__printedFormats = [];
      window.print = () => {
        const area = document.getElementById('receiptPrintArea');
        const sheet = area?.querySelector('.receipt-sheet');
        window.__printedFormats.push({
          format: sheet?.getAttribute('data-receipt-format') || 'unknown',
          classes: document.body.className,
          html: area?.innerHTML || ''
        });
      };
    }, demoSeedState);

    await page.goto('/');

    // Navigate to Transactions view
    const drawerToggle = page.locator('#navDrawerToggle');
    if (await drawerToggle.isVisible()) {
      await drawerToggle.click();
      const txNavItem = page.locator('#navDrawer [data-nav-target="transactions"]');
      await txNavItem.click();
    } else {
      // Direct view switch or tab
      await page.evaluate(() => window.switchView?.('transactions'));
    }

    const txView = page.locator('#transactionsView');
    await expect(txView).toBeVisible();

    // #298: rows are compact; tap the row to show its print actions.
    await page.locator('#transactionsList .tx-row').first().click();
    // Verify print buttons exist on transaction card
    const printA4Btn = page.locator('.transaction-actions [data-print-receipt]').first();
    const print80Btn = page.locator('.transaction-actions [data-print-thermal-receipt]').first();
    const print58Btn = page.locator('.transaction-actions [data-print-thermal58-receipt]').first();

    await expect(printA4Btn).toBeVisible();
    await expect(print80Btn).toBeVisible();
    await expect(print58Btn).toBeVisible();

    // 1. Test 58mm Thermal Slip Print
    await print58Btn.click();
    await page.waitForFunction(() => window.__printedFormats?.length === 1);
    let printHistory = await page.evaluate(() => window.__printedFormats);
    const last58 = printHistory[0];
    expect(last58.format).toBe('thermal-58');
    expect(last58.html).toContain('data-receipt-format="thermal-58"');
    expect(last58.html).toContain('REC-');
    expect(last58.html).toContain('رسید برائے انٹرنیٹ بل ادائیگی');
    expect(last58.classes).toContain('printing-thermal-58');

    // 2. Test 80mm Thermal Slip Print
    await print80Btn.click();
    await page.waitForFunction(() => window.__printedFormats?.length === 2);
    printHistory = await page.evaluate(() => window.__printedFormats);
    const last80 = printHistory[1];
    expect(last80.format).toBe('thermal-80');
    expect(last80.html).toContain('data-receipt-format="thermal-80"');
    expect(last80.html).toContain('REC-');
    expect(last80.html).toContain('رسید برائے انٹرنیٹ بل ادائیگی');
    expect(last80.classes).toContain('printing-thermal-80');

    // 3. Test Standard A4 Receipt Print
    await printA4Btn.click();
    await page.waitForFunction(() => window.__printedFormats?.length === 3);
    printHistory = await page.evaluate(() => window.__printedFormats);
    const lastA4 = printHistory[2];
    expect(lastA4.format).toBe('a4');
    expect(lastA4.html).toContain('data-receipt-format="a4"');
    expect(lastA4.html).toContain('REC-');
    expect(lastA4.html).toContain('رسید برائے انٹرنیٹ بل ادائیگی');
    expect(lastA4.html).toContain('Collector');
    expect(lastA4.classes).toContain('printing-receipt');

    // 4. Capture screenshot of receipt in DOM
    const prefix = isMobile ? 'mobile-390x844' : 'desktop-1280x800';
    await page.screenshot({
      path: `C:/Users/Perfect/.gemini/antigravity/brain/528d6a23-e54a-4288-9b33-f00da9001e81/scratch/${prefix}-receipt-transactions.png`,
      fullPage: false
    });
  });
});
