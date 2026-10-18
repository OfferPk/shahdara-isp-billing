// Regression for #241: "+ Add payment" must never open Quick Collect on an empty, broken-looking
// list. Updated for the pending-only default: Quick Collect lists only customers with a pending
// balance; when nobody owes anything it shows an explanatory empty state ("Sab ka bill wusool ho
// gaya", or "No pending dues" + Set packages when no fee is set, #248) with a "Show all" button
// instead of the old automatic fall back to "All", and the payment form stays reachable.
import { test, expect } from '@playwright/test';

for (const opener of ['#quickAddPaymentButton', '#quickActionReceivePayment']) {
  test(`${opener} opens a picker with customers or the all-collected state, and reaches the payment form`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/');
    await page.locator(opener).click();
    const modal = page.locator('#quickCollectModal');
    await expect(modal).toBeVisible();

    const duesCount = Number(await page.locator('#quickCollectDuesCount').textContent());
    const allCount = Number(await page.locator('#quickCollectAllCount').textContent());
    expect(allCount).toBeGreaterThan(0);
    // Pending is always the default filter.
    await expect(modal.locator('.quick-collect-filter-chip[data-filter="all-dues"]')).toHaveClass(/is-active/);
    await expect(modal.getByText('No matching accounts found')).toBeHidden();
    if (duesCount === 0) {
      // Either "Sab ka bill wusool ho gaya" (all paid) or, with no packages/fees yet (#248),
      // "No pending dues" with Set packages / Generate bills; both offer "Show all".
      await expect(modal.locator('.qc-all-collected, .qc-needs-setup')).toBeVisible();
      await modal.locator('[data-qc-show-all]').click();
      await expect(modal.locator('.quick-collect-filter-chip[data-filter="all"]')).toHaveAttribute('aria-selected', 'true');
    }
    const cards = modal.locator('.qc-customer-card');
    await expect(cards.first()).toBeVisible();

    await cards.first().click();
    await expect(page.locator('#quickCollectAmountInput')).toBeVisible();
    await expect(page.locator('#quickCollectConfirmBtn')).toBeVisible();
    expect(errors).toEqual([]);
  });
}
