/**
 * nav-field-tools-duplicate-276-281.spec.mjs - E2E browser tests for:
 * - Issue #276: Field Tools sheet transitions cleanly to tools (Route Sheet, Work Orders, OTDR) without closing
 * - Issue #277: Sidebar active highlight matches exact route (#/home, #/bills, #/backup, #/reports, #/customers)
 * - Issue #279: In-app duplicate Transaction ID warning with details (no 'undefined'), cancel & proceed flow
 * - Issue #280: Nav polish: #mobileActionSheetToggle in More menu, 21 aria-labels on technical buttons
 * - Issue #281: Quick Collect dynamic amount chips & sticky confirm button layout
 */

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

test.describe('Issue #276: Field Tools sheet transitions', () => {
  test('clicking Route Sheet in Field Tools opens Route Sheet dialog and keeps it open', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/#field-tools');

    const fieldToolsModal = page.locator('#fieldToolsModal');
    await expect(fieldToolsModal).toBeVisible();

    // Click Route Sheet tile
    const routeSheetBtn = fieldToolsModal.locator('[data-open-field-route]');
    await expect(routeSheetBtn).toBeVisible();
    await routeSheetBtn.click();

    // Field Tools sheet should close
    await expect(fieldToolsModal).toBeHidden();

    // Target modal (fieldRouteModal) must open and STAY open!
    const routeModal = page.locator('#fieldRouteModal');
    await expect(routeModal).toBeVisible();

    // Wait 500ms to ensure no async history/popstate race closes it (#276)
    await page.waitForTimeout(500);
    await expect(routeModal).toBeVisible();

    // Press Escape or Close button to close it
    await page.keyboard.press('Escape');
    await expect(routeModal).toBeHidden();

    expect(errors).toEqual([]);
  });
});

test.describe('Issue #277: Sidebar active page highlight', () => {
  test('active aria-current="page" updates accurately on router navigation', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Sidebar persistent navigation is validated on desktop');
    const errors = trackErrors(page);

    await page.goto('/#customers');

    const sidebar = page.locator('#navDrawer');
    await expect(sidebar.locator('[data-nav-target="customers"]')).toHaveAttribute('aria-current', 'page');
    await expect(sidebar.locator('[data-nav-target="home"]')).not.toHaveAttribute('aria-current', 'page');

    // Navigate to #/home
    await page.goto('/#home');
    await expect(sidebar.locator('[data-nav-target="home"]')).toHaveAttribute('aria-current', 'page');
    await expect(sidebar.locator('[data-nav-target="customers"]')).not.toHaveAttribute('aria-current', 'page');

    // Navigate to #/bills
    await page.goto('/#bills');
    await expect(sidebar.locator('[data-nav-target="bills"]')).toHaveAttribute('aria-current', 'page');
    await expect(sidebar.locator('[data-nav-target="reports"]')).not.toHaveAttribute('aria-current', 'page');

    // Navigate to #/backup
    await page.goto('/#backup');
    await expect(sidebar.locator('[data-nav-target="backup"]')).toHaveAttribute('aria-current', 'page');
    await expect(sidebar.locator('[data-nav-target="expenses"]')).not.toHaveAttribute('aria-current', 'page');

    expect(errors).toEqual([]);
  });
});

test.describe('Issue #279 & #281: Quick Collect polish & Duplicate Warning', () => {
  test('dynamic amount chips, sticky footer, and in-app duplicate ID warning', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/#customers');

    // Open Quick Collect modal
    const mobileCollectBtn = page.locator('.mobile-bottom-nav [data-mobile-nav="collection"]');
    if (await mobileCollectBtn.isVisible()) {
      await mobileCollectBtn.click();
    } else {
      await page.evaluate(() => window.quickCollectModalController.open());
    }
    const qcModal = page.locator('#quickCollectModal');
    await expect(qcModal).toBeVisible();

    // Setup packages if empty
    const setupBtn = page.locator('[data-qc-setup-packages]').first();
    if (await setupBtn.isVisible()) {
      await setupBtn.click();
      await page.locator('#collectSetupSelectAll').check();
      await page.locator('#collectSetupApplyBtn').click();
      await page.locator('#closeCollectSetupBtn').click();
    }

    // Pick first customer
    const firstCust = qcModal.locator('.qc-customer-card').first();
    await expect(firstCust).toBeVisible();
    await firstCust.click();

    // Step 2 Form is visible
    await expect(page.locator('#quickCollectStepForm')).toBeVisible();

    // Check dynamic amount chips have Rs in label (#281)
    const fullChip = page.locator('.quick-amount-chip[data-quick-amount="full"]');
    await expect(fullChip).toContainText(/Full \(Rs/);

    // Check Month & Note details are cleanly collapsed (#281)
    const moreOptions = page.locator('#quickCollectMoreOptions');
    await expect(moreOptions).toBeVisible();
    expect(await moreOptions.evaluate(el => el.open)).toBe(false);

    // Switch to JazzCash digital method
    await page.locator('.quick-method-chip[data-method="JazzCash"]').click();
    const txnInput = page.locator('#quickCollectTransactionIdInput');
    await expect(txnInput).toBeVisible();

    // Enter duplicate transaction ID: first submission
    await txnInput.fill('TXN-DUPLICATE-999');
    await page.locator('#quickCollectConfirmBtn').click();

    // Should complete first payment
    await expect(page.locator('#quickCollectStepSuccess')).toBeVisible();

    // Click "Collect Another Customer"
    await page.locator('#quickCollectAnotherBtn').click();
    await expect(page.locator('#quickCollectStepPick')).toBeVisible();

    // Pick second customer
    const secondCust = qcModal.locator('.qc-customer-card').first();
    await expect(secondCust).toBeVisible();
    await secondCust.click();

    // Switch to JazzCash and enter SAME transaction ID
    await page.locator('.quick-method-chip[data-method="JazzCash"]').click();
    await txnInput.fill('TXN-DUPLICATE-999');
    await page.locator('#quickCollectConfirmBtn').click();

    // Duplicate in-app warning card should appear (#279)
    const dupCard = page.locator('#quickCollectDuplicateWarning');
    await expect(dupCard).toBeVisible();
    await expect(page.locator('#quickCollectDuplicateMsg')).toContainText('TXN-DUPLICATE-999');
    await expect(page.locator('#quickCollectDuplicateMsg')).not.toContainText('undefined');

    // Test Cancel button on duplicate warning
    await page.locator('#quickCollectDuplicateCancelBtn').click();
    await expect(dupCard).toBeHidden();
    await expect(txnInput).toBeFocused();

    // Click Confirm again and then Proceed Anyway
    await page.locator('#quickCollectConfirmBtn').click();
    await expect(dupCard).toBeVisible();
    await page.locator('#quickCollectDuplicateProceedBtn').click();

    // Should proceed and record payment
    await expect(page.locator('#quickCollectStepSuccess')).toBeVisible();

    expect(errors).toEqual([]);
  });
});

test.describe('Issue #280: Nav Polish', () => {
  test('technical buttons have accessible aria-labels and More menu has clean Quick Actions row', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/#customers');

    // Check technical buttons in sidebar
    const techButtons = page.locator('ul.nav-drawer-sublist button');
    const count = await techButtons.count();
    expect(count).toBeGreaterThanOrEqual(20);

    for (let i = 0; i < count; i++) {
      const btn = techButtons.nth(i);
      const ariaLabel = await btn.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel.length).toBeGreaterThan(2);
    }

    // Check More menu item on mobile or desktop
    const moreMenuActionToggle = page.locator('#mobileMoreMenu #mobileActionSheetToggle');
    await expect(moreMenuActionToggle).toHaveAttribute('aria-label', /Quick Actions/);
    await expect(moreMenuActionToggle).toContainText('Quick Actions Sheet');

    expect(errors).toEqual([]);
  });
});
