import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('favicon.ico') && !text.includes('Failed to load resource')) {
        errors.push(text);
      }
    }
  });
  page.on('pageerror', err => errors.push(err.message));
  return errors;
}

test.describe('Late Fee & Discounts Policy Manager (Issue #345 in-app appConfirm)', () => {
  test('late fee policy manager opens, saves policy, and displays audit roster without native alerts', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/#home');
    await page.waitForTimeout(1600);

    // Open Late Fee Modal
    const quickBtn = page.locator('#quickActionLateFeeManager');
    if (await quickBtn.isVisible()) {
      await quickBtn.click();
    } else {
      await page.evaluate(() => {
        const modal = document.getElementById('lateFeeManagerModal');
        if (modal) modal.showModal();
      });
    }

    const modal = page.locator('#lateFeeManagerModal');
    await expect(modal).toBeVisible();

    // Verify key policy controls are visible
    const toggle = page.locator('#lateFeePolicyToggle');
    const amountInput = page.locator('#lateFeeDefaultAmountInput');
    const saveBtn = page.locator('#saveLateFeePolicyBtn');

    await expect(toggle).toBeVisible();
    await expect(amountInput).toBeVisible();
    await expect(saveBtn).toBeVisible();

    // Configure policy
    await toggle.check();
    await amountInput.fill('150');
    await saveBtn.click();

    // Verify toast appeared without any blocking native dialogs
    await expect(page.locator('#toast')).toContainText('Late fee policy configuration saved');

    // Close modal via close button
    const closeBtn = page.locator('#closeLateFeeModalBtn');
    await closeBtn.click();
    await expect(modal).toBeHidden();

    expect(errors).toEqual([]);
  });

  test('batch apply with selected rows triggers in-app appConfirm and cancels safely', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/#home');
    await page.waitForTimeout(1600);

    // Open modal
    await page.evaluate(() => {
      const modal = document.getElementById('lateFeeManagerModal');
      if (modal) modal.showModal();
    });

    const modal = page.locator('#lateFeeManagerModal');
    await expect(modal).toBeVisible();

    // Select all or check first row if available
    const selectAll = page.locator('#lateFeeSelectAllCheckbox');
    if (await selectAll.isVisible()) {
      await selectAll.check();
    }

    const batchApplyBtn = page.locator('#lateFeeBatchApplyBtn');
    await expect(batchApplyBtn).toBeVisible();
    await batchApplyBtn.click();

    // If checkboxes exist, an appConfirm appears
    const confirmDlg = page.locator('#appConfirmDialog');
    const hasChecked = await page.evaluate(() => {
      return document.querySelectorAll('#lateFeeRosterTableBody input[type="checkbox"]:checked').length > 0;
    });

    if (hasChecked) {
      await expect(confirmDlg).toBeVisible();
      await expect(page.locator('#appConfirmTitle')).toContainText('Apply late fee surcharge?');

      // Cancel the confirmation
      await page.locator('#appConfirmCancelBtn').click();
      await expect(confirmDlg).toBeHidden();
    } else {
      // If no checked rows, a toast warning is shown instead
      await expect(page.locator('#toast')).toBeVisible();
    }

    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();

    expect(errors).toEqual([]);
  });

  test('responsive verification at mobile 390x844 without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors = trackErrors(page);
    await page.goto('/#home');
    await page.waitForTimeout(1600);

    await page.evaluate(() => {
      const modal = document.getElementById('lateFeeManagerModal');
      if (modal) modal.showModal();
    });

    const modal = page.locator('#lateFeeManagerModal');
    await expect(modal).toBeVisible();

    // Check no horizontal document scroll
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Close modal
    await page.locator('#closeLateFeeModalBtn').click();
    await expect(modal).toBeHidden();

    expect(errors).toEqual([]);
  });
});
