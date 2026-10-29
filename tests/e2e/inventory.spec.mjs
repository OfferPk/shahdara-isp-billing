import { test, expect } from '@playwright/test';

test.describe('Equipment Inventory & Stock Register E2E Verification', () => {
  test('navigates to inventory, adds item and movements, and verifies stock status pills', async ({ page, isMobile }) => {
    await page.goto('/');

    // Navigate to Inventory view
    if (isMobile) {
      const moreBtn = page.locator('#mobileMoreButton');
      await moreBtn.click();
      const invBtn = page.locator('#mobileMoreMenu button[data-mobile-more="inventory"]');
      await invBtn.click();
    } else {
      const invBtn = page.locator('#showInventoryButton');
      await invBtn.click();
    }

    const inventoryView = page.locator('#inventoryView');
    await expect(inventoryView).toBeVisible();

    // Verify key metric cards are visible
    await expect(page.locator('#inventoryTotalStock')).toBeVisible();
    await expect(page.locator('#inventoryLowStock')).toBeVisible();
    await expect(page.locator('#inventoryValue')).toBeVisible();

    // 1. Add new Inventory Item Definition
    await page.locator('#inventoryName').fill('ZTE Dual-Band XPON ONU');
    await page.locator('#inventoryCategory').selectOption('ONU');
    await page.locator('#inventoryUnit').fill('piece');
    await page.locator('#inventoryMinimum').fill('5');
    await page.locator('#inventoryUnitCost').fill('4500');
    await page.locator('#inventoryNotes').fill('Gigabit XPON with WiFi-5');
    await page.locator('#inventoryItemSubmit').click();

    // Verify item row appears in table with "Unrecorded" status pill
    const itemsTable = page.locator('#inventoryItemsTable');
    await expect(itemsTable).toContainText('ZTE Dual-Band XPON ONU');
    await expect(itemsTable.locator('.stock-status-pill')).toContainText(/Unrecorded/i);

    // 2. Record a "Receive / purchase" stock movement of 10 units
    const movementItemSelect = page.locator('#movementItemId');
    // Select the newly added item (it has option containing ZTE)
    const optionValue = await movementItemSelect.locator('option').filter({ hasText: 'ZTE Dual-Band XPON ONU' }).getAttribute('value');
    if (optionValue) {
      await movementItemSelect.selectOption(optionValue);
    }
    await page.locator('#movementType').selectOption('receive');
    await page.locator('#movementQuantity').fill('10');
    await page.locator('#movementDate').fill(new Date().toISOString().slice(0, 10));
    await page.locator('#inventoryMovementForm button[type="submit"]').click();

    // Verify available stock updated to 10 and status pill changed to "In stock"
    await expect(itemsTable.locator('.stock-qty')).toContainText('10');
    await expect(itemsTable.locator('.stock-status-pill')).toContainText(/In stock/i);

    // 3. Record an "Install / issue" stock movement of 7 units (leaving 3 units <= min 5)
    if (optionValue) {
      await movementItemSelect.selectOption(optionValue);
    }
    await page.locator('#movementType').selectOption('install');
    await page.locator('#movementQuantity').fill('7');
    await page.locator('#movementDate').fill(new Date().toISOString().slice(0, 10));
    await page.locator('#inventoryMovementForm button[type="submit"]').click();

    // Verify available stock is now 3 and status pill changed to "Low stock"
    await expect(itemsTable.locator('.stock-qty')).toContainText('3');
    await expect(itemsTable.locator('.stock-status-pill')).toContainText(/Low stock/i);

    // 4. Test Category Filter
    const categoryFilter = page.locator('#inventoryCategoryFilter');
    await categoryFilter.selectOption('Router');
    await expect(itemsTable.locator('tr')).toHaveCount(0);
    await expect(page.locator('#inventoryItemsFilterEmpty')).toBeVisible();

    await categoryFilter.selectOption('ONU');
    await expect(itemsTable.locator('tr')).toHaveCount(1);
    await expect(itemsTable).toContainText('ZTE Dual-Band XPON ONU');

    // 5. Test Stock Level Filter
    const stockFilter = page.locator('#inventoryStockFilter');
    await stockFilter.selectOption('in'); // > min
    await expect(itemsTable.locator('tr')).toHaveCount(0); // 3 is not > 5

    await stockFilter.selectOption('low'); // <= min
    await expect(itemsTable.locator('tr')).toHaveCount(1);
    await expect(itemsTable).toContainText('ZTE Dual-Band XPON ONU');

    // 6. Test Clear Filters button
    await page.locator('#clearInventoryFilters').click();
    await expect(categoryFilter).toHaveValue('all');
    await expect(stockFilter).toHaveValue('all');
    await expect(itemsTable.locator('tr')).toHaveCount(1);
  });

  test('touch targets and zero horizontal scroll overflow at 390px mobile viewport', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-specific responsive test');

    await page.goto('/');

    const moreBtn = page.locator('#mobileMoreButton');
    await moreBtn.click();
    const invBtn = page.locator('#mobileMoreMenu button[data-mobile-more="inventory"]');
    await invBtn.click();

    await expect(page.locator('#inventoryView')).toBeVisible();

    // Verify filter select touch target height >= 44px
    const catSelectBox = await page.locator('#inventoryCategoryFilter').boundingBox();
    expect(catSelectBox?.height).toBeGreaterThanOrEqual(44);

    const stockSelectBox = await page.locator('#inventoryStockFilter').boundingBox();
    expect(stockSelectBox?.height).toBeGreaterThanOrEqual(44);

    const searchInputBox = await page.locator('#inventorySearchInput').boundingBox();
    expect(searchInputBox?.height).toBeGreaterThanOrEqual(44);

    const clearBtnBox = await page.locator('#clearInventoryFilters').boundingBox();
    expect(clearBtnBox?.height).toBeGreaterThanOrEqual(44);

    // Check zero horizontal overflow at 390px
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  test('dark mode theme styling renders readable colors and pills', async ({ page }) => {
    await page.goto('/');

    // Toggle theme to dark
    const themeBtn = page.locator('#themeToggle');
    await themeBtn.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // Open inventory view
    const viewNav = page.locator('#showInventoryButton');
    if (await viewNav.isVisible()) {
      await viewNav.click();
    } else {
      const moreBtn = page.locator('#mobileMoreButton');
      await moreBtn.click();
      await page.locator('#mobileMoreMenu button[data-mobile-more="inventory"]').click();
    }

    await expect(page.locator('#inventoryView')).toBeVisible();

    // Verify filter toolbar background is styled dark
    const toolbar = page.locator('.table-filter-toolbar').first();
    const toolbarBg = await toolbar.evaluate(el => window.getComputedStyle(el).backgroundColor);
    expect(toolbarBg).toContain('24, 45, 39'); // rgb(24, 45, 39) == #182d27
  });

  test('phone layout: items render as cards, table hides, card Edit fills the form (redesign 2026-10-29)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-specific card layout test');

    await page.goto('/');
    const moreBtn = page.locator('#mobileMoreButton');
    await moreBtn.click();
    await page.locator('#mobileMoreMenu button[data-mobile-more="inventory"]').click();
    await expect(page.locator('#inventoryView')).toBeVisible();

    // Add one item definition
    await page.locator('#inventoryName').fill('Card Layout Test ONU');
    await page.locator('#inventoryCategory').selectOption('ONU');
    await page.locator('#inventoryUnit').fill('piece');
    await page.locator('#inventoryMinimum').fill('5');
    await page.locator('#inventoryUnitCost').fill('4500');
    await page.locator('#inventoryItemSubmit').click();

    // The wide table is hidden at phone width; one card renders instead
    const itemsSection = page.locator('.inventory-items-card');
    await expect(itemsSection.locator('.table-scroll')).toBeHidden();
    const cards = page.locator('#inventoryItemCards .inventory-item-card');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Card Layout Test ONU');
    await expect(cards.first().locator('.inventory-item-chip')).toContainText('ONU');
    await expect(cards.first().locator('.inventory-item-figure-qty')).toContainText('Not recorded');
    await expect(cards.first().locator('.stock-status-pill')).toContainText(/Unrecorded/i);
    await expect(cards.first()).toContainText('Minimum');

    // Filter toolbar no longer stacks: the two selects share a row
    const catBox = await page.locator('#inventoryCategoryFilter').boundingBox();
    const stockBox = await page.locator('#inventoryStockFilter').boundingBox();
    expect(Math.abs((catBox?.y ?? 0) - (stockBox?.y ?? 0))).toBeLessThanOrEqual(2);

    // Zero horizontal overflow with the card layout at phone width
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    // Tapping the card's Edit button fills the same item form
    await cards.first().locator('[data-edit-inventory]').click();
    await expect(page.locator('#inventoryName')).toHaveValue('Card Layout Test ONU');
    await expect(page.locator('#inventoryItemSubmit')).toContainText('Save item changes');
  });
});
