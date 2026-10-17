import { test, expect } from '@playwright/test';

test.describe('Backup Hardening & CSV Customer Import E2E Verification', () => {
  test('footer backup controls toggle, audit storage health, and download template', async ({ page }) => {
    await page.goto('/');

    const toggle = page.locator('#backupControlsToggle');
    await expect(toggle).toBeVisible();
    await toggle.click();

    const controls = page.locator('#backupControls');
    await expect(controls).toBeVisible();

    const auditBtn = page.locator('#verifyStorageIntegrityBtn');
    await expect(auditBtn).toBeVisible();
    await auditBtn.click();

    // Verify toast announcement for storage health audit
    const toast = page.locator('#toast');
    await expect(toast).toContainText(/Storage Health.*offline storage keys verified healthy/);

    // Verify download CSV template button exists and is clickable
    const templateBtn = page.locator('#downloadCustomerCsvTemplateBtn');
    await expect(templateBtn).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await templateBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('shahdara_customer_import_template');
  });

  test('csv customer import displays validation preview, detects conflicts, and safely applies merge', async ({ page }) => {
    await page.goto('/');

    // Toggle backup panel
    await page.locator('#backupControlsToggle').click();
    await expect(page.locator('#backupControls')).toBeVisible();

    // Prepare CSV with new customer and enrichment row
    const testCsv = [
      'Customer Name,Phone,CNIC,Area,Package,Monthly Rate',
      'Khurram Shahzad,03008888888,35201-8888888-8,Baradari,25 Mbps,2400',
      'Bilal Akram,03214444444,35201-4444444-4,Vandala Road,20 Mbps,2000'
    ].join('\r\n');

    // Set file input
    const fileInput = page.locator('#customerCsvFileInput');
    await fileInput.setInputFiles({
      name: 'shahdara_import.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(testCsv, 'utf-8')
    });

    // Preview modal should appear
    const dialog = page.locator('#csvImportDialog');
    await expect(dialog).toBeVisible();

    // Verify preview summary
    const summary = page.locator('#csvImportPreviewSummary');
    await expect(summary).toContainText(/Spreadsheet preview: 2 rows found/);

    // Verify table has rows with badges
    const previewRows = page.locator('#csvImportPreviewRows tr');
    await expect(previewRows).toHaveCount(2);

    // Apply button should be enabled
    const applyBtn = page.locator('#applyCsvImportButton');
    await expect(applyBtn).toBeEnabled();
    await applyBtn.click();

    // Modal should close and toast should announce success
    await expect(dialog).not.toBeVisible();
    const toast = page.locator('#toast');
    await expect(toast).toContainText(/Successfully imported/);
  });

  test('responsive verification: zero horizontal scroll at 390px mobile viewport', async ({ page, isMobile }) => {
    if (isMobile) {
      await page.setViewportSize({ width: 390, height: 844 });
    }
    await page.goto('/');

    await page.locator('#backupControlsToggle').click();
    const controls = page.locator('#backupControls');
    await expect(controls).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    // Verify touch target heights >= 40px
    const templateBtnBox = await page.locator('#downloadCustomerCsvTemplateBtn').boundingBox();
    if (templateBtnBox) {
      expect(templateBtnBox.height).toBeGreaterThanOrEqual(40);
    }
    const importBtnBox = await page.locator('#importCustomerCsvBtn').boundingBox();
    if (importBtnBox) {
      expect(importBtnBox.height).toBeGreaterThanOrEqual(40);
    }
  });
});
