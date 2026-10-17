import { test, expect } from '@playwright/test';

test.describe('Main Billing Workflow E2E Audit & Verification', () => {
  test('walks full flow: add customer -> edit package -> record bill -> partial payment -> receipt print -> WhatsApp draft -> reports view -> backup controls', async ({ page, isMobile }) => {
    // Intercept window.print so no native print modal blocks Playwright
    await page.addInitScript(() => {
      window.__printed = [];
      window.print = () => {
        const area = document.getElementById('receiptPrintArea');
        const sheet = area?.querySelector('.receipt-sheet');
        window.__printed.push({
          format: sheet?.getAttribute('data-receipt-format') || 'unknown',
          html: area?.innerHTML || ''
        });
      };
    });

    await page.goto('/');

    // 1. Open Add Customer Dialog from Dashboard Quick Actions
    const addCustBtn = page.locator('#quickActionAddCustomer');
    await expect(addCustBtn).toBeVisible();
    await addCustBtn.click();

    const addDialog = page.locator('#addCustomerDialog');
    await expect(addDialog).toBeVisible();

    // Fill in customer registration form
    await page.locator('#newCustomerName').fill('Zubair Ahmed');
    await page.locator('#newCustomerPhone').fill('03011234567');
    await page.locator('#newCustomerCnic').fill('35202-7654321-1');
    await page.locator('#newCustomerMohalla').fill('Niazi Chowk');
    await page.locator('#newCustomerAddress').fill('House 12, Street 3');

    // Submit form
    const submitBtn = page.locator('#addCustomerSubmit');
    await submitBtn.click();

    // Dialog should close automatically and customer detail view opens
    await expect(addDialog).not.toBeVisible();

    const detailName = page.locator('#detailName');
    await expect(detailName).toBeVisible();
    await expect(detailName).toContainText('Zubair Ahmed');

    // 2. Switch to Info tab to edit Profile Package and Selling Rate
    const infoTab = page.locator('#profileTabInfo');
    await expect(infoTab).toBeVisible();
    await infoTab.click();

    const editProfileBtn = page.locator('#editProfileButton');
    await expect(editProfileBtn).toBeVisible();
    await editProfileBtn.click();

    const profileForm = page.locator('#customerProfileForm');
    await expect(profileForm).toBeVisible();

    await page.locator('#packageSpeedInput').fill('20 Mbps Fiber');
    await page.locator('#monthlySellingAmountInput').fill('2000');
    await page.locator('#saveMohallaButton').click();

    // Profile form should collapse and profile view shows updated data
    await expect(profileForm).not.toBeVisible();
    await expect(page.locator('#customerProfileView')).toContainText('20 Mbps Fiber');

    // 3. Switch back to Billing tab for Monthly Bills & Payments
    const billingTab = page.locator('#profileTabBilling');
    await expect(billingTab).toBeVisible();
    await billingTab.click();

    const historyContainer = page.locator('#historyContainer');
    await expect(historyContainer).toBeVisible();

    const currentMonthCard = historyContainer.locator('.month-card').first();
    await expect(currentMonthCard).toBeVisible();

    // Payment form is visible in expanded month card
    const paymentForm = currentMonthCard.locator('form[data-kind="payment"]');
    await expect(paymentForm).toBeVisible();

    // Record partial payment of 1200 PKR
    await paymentForm.locator('input[name="date"]').fill('2026-10-05');
    await paymentForm.locator('input[name="amount"]').fill('1200');
    await paymentForm.locator('select[name="method"]').selectOption('Cash');
    await paymentForm.locator('button[type="submit"]').click();
    await page.waitForTimeout(400);

    // Verify payment record appears in payment list
    const paymentItem = page.locator('#historyContainer .payment-list li').first();
    await expect(paymentItem).toBeVisible();
    await expect(paymentItem).toContainText('1,200');

    // Verify 58mm mini slip print button works
    const print58Btn = paymentItem.locator('[data-print-thermal58-receipt]');
    await expect(print58Btn).toBeVisible();
    await print58Btn.click();
    await page.waitForFunction(() => window.__printed?.length >= 1);

    const printedData = await page.evaluate(() => window.__printed[0]);
    expect(printedData.format).toBe('thermal-58');
    expect(printedData.html).toContain('رسید برائے انٹرنیٹ بل ادائیگی');

    // Verify WhatsApp draft link format
    const waLink = paymentItem.locator('a.receipt-whatsapp-link, a[data-whatsapp-draft]').first();
    if (await waLink.isVisible()) {
      const href = await waLink.getAttribute('href');
      expect(href).toMatch(/^https:\/\/api\.whatsapp\.com\/send\?/);
      expect(href).toContain('phone=923011234567');
      expect(href).toContain('text=');
    }

    // 4. Navigate to Monthly Reports view
    const drawerToggle = page.locator('#navDrawerToggle');
    if (await drawerToggle.isVisible()) {
      await drawerToggle.click();
      await page.locator('#navDrawer [data-nav-target="reports"]').click();
    } else {
      await page.evaluate(() => window.switchView?.('reports'));
    }

    const reportsView = page.locator('#billingReportsView');
    await expect(reportsView).toBeVisible();

    // 5. Open and verify Backup & Restore panel
    await page.evaluate(() => {
      const toggle = document.getElementById('backupControlsToggle');
      if (toggle) toggle.click();
    });

    const backupControls = page.locator('#backupControls');
    await expect(backupControls).toBeVisible();

    // Verify download JSON backup button exists
    const downloadJsonBtn = page.locator('#downloadJsonBackupButton');
    await expect(downloadJsonBtn).toBeVisible();

    // 6. Capture full verification screenshot
    const prefix = isMobile ? 'mobile-390x844' : 'desktop-1280x800';
    await page.screenshot({
      path: `C:/Users/Perfect/.gemini/antigravity/brain/528d6a23-e54a-4288-9b33-f00da9001e81/scratch/${prefix}-billing-flow.png`,
      fullPage: false
    });
  });
});
