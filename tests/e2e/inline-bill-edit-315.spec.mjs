import { test, expect } from '@playwright/test';

test.describe('Inline bill edit (#315)', () => {
  test('mobile 390x844: click "Bill not set" opens modal, quick pick chip sets fee, save updates badge and allows undo', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/customers');

    // Wait for customer list to load
    const unsetBadge = page.locator('.customer-billing-badge[data-inline-bill-edit][data-bill-unset="true"]').first();
    await expect(unsetBadge).toBeVisible();
    await expect(unsetBadge).toContainText('Bill not set');

    // Click "Bill not set" badge
    await unsetBadge.click();

    const dialog = page.locator('#inlineBillEditDialog');
    await expect(dialog).toBeVisible();
    await expect(page.locator('#inlineBillEditTitle')).toHaveText('Set monthly bill');

    // Test quick pick chip
    const chip2500 = dialog.locator('button[data-fee="2500"]');
    await expect(chip2500).toBeVisible();
    await chip2500.click();

    const feeInput = dialog.locator('#inlineBillFeeInput');
    await expect(feeInput).toHaveValue('2500');

    // Submit form
    await dialog.locator('#inlineBillSaveBtn').click();

    // Dialog should close
    await expect(dialog).toBeHidden();

    // The badge should now display the monthly fee
    const updatedBadge = page.locator('.customer-billing-badge[data-inline-bill-edit]').first();
    await expect(updatedBadge).toContainText('2500');
    await expect(updatedBadge).not.toHaveAttribute('data-bill-unset', 'true');

    // Undo via toast
    const undoBtn = page.locator('#toast .toast-action-btn').getByText('Undo');
    await expect(undoBtn).toBeVisible();
    await undoBtn.click();

    // Badge reverts back to 'Bill not set'
    await expect(updatedBadge).toContainText('Bill not set');
    await expect(updatedBadge).toHaveAttribute('data-bill-unset', 'true');
  });

  test('desktop 1280x800: validation on 0/empty fee, package selector fills fee, and cancel button closes dialog', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/#/customers');

    const unsetBadge = page.locator('.customer-billing-badge[data-inline-bill-edit][data-bill-unset="true"]').first();
    await expect(unsetBadge).toBeVisible();
    await unsetBadge.click();

    const dialog = page.locator('#inlineBillEditDialog');
    await expect(dialog).toBeVisible();

    const feeInput = dialog.locator('#inlineBillFeeInput');
    const saveBtn = dialog.locator('#inlineBillSaveBtn');
    const errorBox = dialog.locator('#inlineBillError');

    // Empty submission or 0
    await feeInput.fill('0');
    await saveBtn.click();
    await expect(errorBox).toBeVisible();
    await expect(errorBox).toContainText('greater than zero');

    // Package selector fills fee
    const pkgSelect = dialog.locator('#inlineBillPackageSelect');
    await pkgSelect.selectOption({ index: 1 }); // Select first real package option
    const selectedFee = await feeInput.inputValue();
    expect(Number(selectedFee)).toBeGreaterThan(0);
    await expect(errorBox).toBeHidden();

    // Cancel closes dialog without saving
    await dialog.locator('#inlineBillCancelBtn').click();
    await expect(dialog).toBeHidden();
    await expect(unsetBadge).toContainText('Bill not set');
  });
});
