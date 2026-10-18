// Regression for #241: "+ Add payment" opened Quick Collect on an empty "With Dues (0)" list,
// so the payment form looked unreachable.
import { test, expect } from '@playwright/test';

for (const opener of ['#quickAddPaymentButton', '#quickActionReceivePayment']) {
  test(`${opener} opens a picker with customers and reaches the payment form`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/');
    await page.locator(opener).click();
    const modal = page.locator('#quickCollectModal');
    await expect(modal).toBeVisible();

    const duesCount = Number(await page.locator('#quickCollectDuesCount').textContent());
    const allCount = Number(await page.locator('#quickCollectAllCount').textContent());
    expect(allCount).toBeGreaterThan(0);
    if (duesCount === 0) {
      await expect(modal.locator('.quick-collect-filter-chip[data-filter="all"]')).toHaveClass(/is-active/);
      await expect(modal.locator('.quick-collect-filter-chip[data-filter="all"]')).toHaveAttribute('aria-selected', 'true');
    }
    await expect(modal.getByText('No matching accounts found')).toBeHidden();
    const cards = modal.locator('.qc-customer-card');
    await expect(cards.first()).toBeVisible();

    await cards.first().click();
    await expect(page.locator('#quickCollectAmountInput')).toBeVisible();
    await expect(page.locator('#quickCollectConfirmBtn')).toBeVisible();
    expect(errors).toEqual([]);
  });
}
