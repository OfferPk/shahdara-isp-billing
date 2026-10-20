/**
 * nav-customer-search-keyboard-312.spec.mjs
 * E2E tests for Issue #312:
 * Fast Customer Search: Enter / ↓ do nothing — Enter should open Quick Collect for the single or highlighted result
 *
 * Verifies:
 * 1. enterkeyhint="go" on search input so phone keyboard displays "Go".
 * 2. When there is exactly 1 search result (e.g. typing "nazeer"), it is automatically highlighted,
 *    and pressing Enter immediately opens Quick Collect (#quickCollectModal) for that customer.
 * 3. When multiple results exist (e.g. typing "raja"), ArrowDown / ArrowUp moves the highlight ring,
 *    and pressing Enter opens Quick Collect for the highlighted customer.
 * 4. Shift+Enter opens the customer Profile instead of Quick Collect.
 * 5. Tested on mobile (390x844) and desktop (1280x800).
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

test.describe('Issue #312: Fast Customer Search Keyboard Navigation & Quick Collect', () => {
  test('single result: typing nazeer and pressing Enter opens Quick Collect (#312)', async ({ page, isMobile }) => {
    const errors = trackErrors(page);
    await page.goto('/');

    const searchModal = page.locator('#mobileCustomerSearchModal');
    const searchInput = page.locator('#fastCustomerSearchInput');
    const searchTrigger = page.locator('#mobileCustomerSearchTrigger');

    // Open Fast Customer Search
    await searchTrigger.click();

    await expect(searchModal).toBeVisible();

    // 2. Check enterkeyhint="go" and aria attributes
    await expect(searchInput).toHaveAttribute('enterkeyhint', 'go');
    await expect(searchInput).toHaveAttribute('aria-autocomplete', 'list');

    // 3. Type "nazeer"
    await searchInput.fill('nazeer');

    const results = page.locator('#fastCustomerSearchResults .fcs-card');
    await expect(results).toHaveCount(1);
    await expect(results.first()).toContainText('NAZEER');
    await expect(results.first()).toHaveClass(/is-highlighted/);
    await expect(results.first()).toHaveAttribute('aria-selected', 'true');

    // 4. Press Enter -> opens Quick Collect
    await searchInput.press('Enter');

    const quickCollectModal = page.locator('#quickCollectModal');
    await expect(quickCollectModal).toBeVisible();
    await expect(searchModal).not.toBeVisible();

    // Verify Quick Collect contains NAZEER
    await expect(quickCollectModal).toContainText('NAZEER');

    // Close Quick Collect
    await page.locator('#closeQuickCollectModalBtn').click();
    await expect(quickCollectModal).not.toBeVisible();

    expect(errors).toEqual([]);
  });

  test('multiple results: ArrowDown moves highlight and Enter opens Quick Collect (#312)', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');

    const searchModal = page.locator('#mobileCustomerSearchModal');
    const searchInput = page.locator('#fastCustomerSearchInput');
    const searchTrigger = page.locator('#mobileCustomerSearchTrigger');

    await searchTrigger.click();
    await expect(searchModal).toBeVisible();

    // Type query with multiple results
    await searchInput.fill('raja');

    const results = page.locator('#fastCustomerSearchResults .fcs-card');
    await expect(results.first()).toBeVisible();
    const count = await results.count();
    expect(count).toBeGreaterThan(1);

    // Initial state: first card is not highlighted yet
    await expect(results.nth(0)).not.toHaveClass(/is-highlighted/);

    // Press ArrowDown -> first card gets highlighted
    await searchInput.press('ArrowDown');
    await expect(results.nth(0)).toHaveClass(/is-highlighted/);
    await expect(results.nth(0)).toHaveAttribute('aria-selected', 'true');

    // Press ArrowDown again -> second card gets highlighted
    await searchInput.press('ArrowDown');
    await expect(results.nth(0)).not.toHaveClass(/is-highlighted/);
    await expect(results.nth(1)).toHaveClass(/is-highlighted/);

    // Press ArrowUp -> first card gets highlighted again
    await searchInput.press('ArrowUp');
    await expect(results.nth(0)).toHaveClass(/is-highlighted/);

    const firstCustomerName = await results.nth(0).locator('.fcs-name').textContent();
    expect(firstCustomerName).toBeTruthy();

    // Press Enter -> opens Quick Collect for the highlighted customer
    await searchInput.press('Enter');

    const quickCollectModal = page.locator('#quickCollectModal');
    await expect(quickCollectModal).toBeVisible();
    await expect(searchModal).not.toBeVisible();
    await expect(quickCollectModal).toContainText(firstCustomerName.trim());

    expect(errors).toEqual([]);
  });

  test('Shift+Enter opens customer Profile instead of Quick Collect (#312)', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');

    const searchModal = page.locator('#mobileCustomerSearchModal');
    const searchInput = page.locator('#fastCustomerSearchInput');
    const searchTrigger = page.locator('#mobileCustomerSearchTrigger');

    await searchTrigger.click();
    await expect(searchModal).toBeVisible();

    // Type "nazeer" (single result)
    await searchInput.fill('nazeer');
    const resultCard = page.locator('#fastCustomerSearchResults .fcs-card').first();
    await expect(resultCard).toBeVisible();

    // Press Shift+Enter
    await searchInput.press('Shift+Enter');

    // Expect search modal to close and Customers view / profile to open
    await expect(searchModal).not.toBeVisible();
    await expect(page.locator('body')).toHaveAttribute('data-screen', 'customers');
    await expect(page.locator('#detailName')).toHaveText('NAZEER');

    expect(errors).toEqual([]);
  });
});
