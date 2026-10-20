import { test, expect } from '@playwright/test';

test.describe('Top-to-Bottom App Functional Inventory & Browser Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Capture console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        // Log console errors for diagnosis
        console.error(`Browser console error: ${msg.text()}`);
      }
    });
  });

  test('Section 1 - Header Controls & Topbar Lifecycle (Theme, Lang, Search, Shortcuts, Pending)', async ({ page, isMobile }) => {
    await page.goto('/');

    // 1. Verify Brand and Title
    await expect(page.locator('.brand-copy h1')).toBeVisible();

    // 2. Theme Toggle (light <-> dark)
    const themeBtn = page.locator('#themeToggle');
    await expect(themeBtn).toBeVisible();
    const initialTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme') || 'light');
    await themeBtn.click();
    const newTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(newTheme).not.toBe(initialTheme);
    // Toggle back
    await themeBtn.click();
    const restoredTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(restoredTheme).toBe(initialTheme);

    // 3. Language Toggle (English <-> Urdu)
    const langBtn = page.locator('#languageToggleBtn');
    await expect(langBtn).toBeVisible();
    await langBtn.click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ur');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    // Toggle back to English
    await langBtn.click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

    // 4. Keyboard Shortcuts Modal
    const shortcutsBtn = page.locator('#shortcutsHelpButton');
    if (await shortcutsBtn.isVisible()) {
      await shortcutsBtn.click();
      const shortcutsDialog = page.locator('#keyboardShortcutsModal');
      await expect(shortcutsDialog).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(shortcutsDialog).not.toBeVisible();
    }

    // 5. Fast Search Trigger
    const searchTrigger = page.locator('#mobileCustomerSearchTrigger');
    if (await searchTrigger.isVisible()) {
      await searchTrigger.click();
      const searchModal = page.locator('#mobileCustomerSearchModal');
      await expect(searchModal).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(searchModal).not.toBeVisible();
    }

    // 6. Topbar Pending Actions Center
    const pendingBtn = page.locator('#topbarPendingActionsBtn');
    if (await pendingBtn.isVisible()) {
      await pendingBtn.click();
      const pendingModal = page.locator('#pendingActionsModal');
      await expect(pendingModal).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(pendingModal).not.toBeVisible();
    }

    // 7. Verify no overlay intercepts screen center
    const viewportSize = page.viewportSize();
    const centerX = Math.floor(viewportSize.width / 2);
    const centerY = Math.floor(viewportSize.height / 2);
    const pointElementTag = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return el ? el.tagName.toLowerCase() : null;
    }, { x: centerX, y: centerY });
    expect(pointElementTag).not.toBeNull();
    expect(pointElementTag).not.toBe('dialog');
  });

  test('Section 2 - Navigation Drawer & Mobile View Transitions', async ({ page, isMobile }) => {
    await page.goto('/');

    // 1. Off-canvas Drawer Toggle
    const drawerToggle = page.locator('#navDrawerToggle');
    await expect(drawerToggle).toBeVisible();
    await drawerToggle.click();

    const drawer = page.locator('#navDrawer');
    await expect(drawer).toBeVisible();

    // 2. Navigate via drawer to Transactions
    const txLink = page.locator('#navDrawer button[data-nav-target="transactions"]');
    await txLink.click();
    await expect(page.locator('#transactionsView')).toBeVisible();

    // 3. Open drawer again and navigate to Expenses
    await drawerToggle.click();
    await expect(drawer).toBeVisible();
    const expLink = page.locator('#navDrawer button[data-nav-target="expenses"]');
    await expLink.click();
    await expect(page.locator('#expensesView')).toBeVisible();

    // 4. Return to Customers view
    await drawerToggle.click();
    const custLink = page.locator('#navDrawer button[data-nav-target="customers"]');
    await custLink.click();
    await expect(page.locator('#customersView')).toBeVisible();

    // 5. If mobile, test bottom nav
    if (isMobile) {
      const bNav = page.locator('.mobile-bottom-nav');
      if (await bNav.isVisible()) {
        const reportsTab = page.locator('.mobile-bottom-nav button[data-mobile-nav="reports"]');
        await reportsTab.click();
        await expect(page.locator('#billingReportsView')).toBeVisible();

        const custTab = page.locator('.mobile-bottom-nav button[data-mobile-nav="customers"]');
        await custTab.click();
        await expect(page.locator('#customersView')).toBeVisible();

        const quickCollectTab = page.locator('.mobile-bottom-nav button[data-mobile-nav="collection"]');
        await quickCollectTab.click();
        const qcModal = page.locator('#quickCollectModal');
        await expect(qcModal).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(qcModal).not.toBeVisible();
      }
    }
  });

  test('Section 3 - Dashboard Quick Actions Ribbon & Modals Lifecycle', async ({ page, isMobile }) => {
    await page.goto('/');

    // Ensure we are on Customers / main view where dashboard ribbon resides
    await expect(page.locator('#billingDashboard')).toBeVisible();

    // Test quick action: Receive Payment modal
    const payBtn = page.locator('#quickActionReceivePayment');
    await expect(payBtn).toBeVisible();
    await payBtn.click();
    const payModal = page.locator('#quickCollectModal');
    await expect(payModal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(payModal).not.toBeVisible();

    // Test quick action: Add Customer modal
    const addCustBtn = page.locator('#quickActionAddCustomer');
    await expect(addCustBtn).toBeVisible();
    await addCustBtn.click();
    const addCustDialog = page.locator('#addCustomerDialog');
    await expect(addCustDialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(addCustDialog).not.toBeVisible();

    // Test quick action: Top Defaulters modal
    const topDefaultersBtn = page.locator('#quickActionTopDefaulters');
    await expect(topDefaultersBtn).toBeVisible();
    await topDefaultersBtn.click();
    const defaultersModal = page.locator('#topDefaultersModal');
    await expect(defaultersModal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(defaultersModal).not.toBeVisible();

    // Test quick action: Area Collections modal
    const areaCollBtn = page.locator('#quickActionAreaCollections');
    await expect(areaCollBtn).toBeVisible();
    await areaCollBtn.click();
    const areaCollModal = page.locator('#areaCollectionsModal');
    await expect(areaCollModal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(areaCollModal).not.toBeVisible();

    // Test quick action: Package Revenue modal
    const pkgRevBtn = page.locator('#quickActionPackageRevenue');
    await expect(pkgRevBtn).toBeVisible();
    await pkgRevBtn.click();
    const pkgRevModal = page.locator('#packageRevenueModal');
    await expect(pkgRevModal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(pkgRevModal).not.toBeVisible();

    // Test quick action: P&L Statement modal
    const pnlBtn = page.locator('#quickActionPnl');
    await expect(pnlBtn).toBeVisible();
    await pnlBtn.click();
    const pnlModal = page.locator('#pnlModal');
    await expect(pnlModal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(pnlModal).not.toBeVisible();

    // Test quick action: MoM Growth modal
    const momBtn = page.locator('#quickActionMomGrowth');
    await expect(momBtn).toBeVisible();
    await momBtn.click();
    const momModal = page.locator('#momGrowthModal');
    await expect(momModal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(momModal).not.toBeVisible();

    // Test quick action: Daily Closing modal
    const closingBtn = page.locator('#quickActionDailyClosing');
    await expect(closingBtn).toBeVisible();
    await closingBtn.click();
    const closingModal = page.locator('#dailyClosingModal');
    await expect(closingModal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(closingModal).not.toBeVisible();

    // Test Daily Register modal button
    const registerBtn = page.locator('#openDailyRegisterBtn');
    if (await registerBtn.isVisible()) {
      await registerBtn.click();
      const registerModal = page.locator('#dailyCashRegisterModal');
      await expect(registerModal).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(registerModal).not.toBeVisible();
    }
  });

  test('Section 4, 6 & 8 - Customer Master Table, Billing Details & Batch Slips', async ({ page, isMobile }) => {
    await page.goto('/#/customers');

    // 1. Verify Customers Master Roster
    const custView = page.locator('#customersView');
    await expect(custView).toBeVisible();

    // Expand toggle on desktop
    if (!isMobile) {
      const expandBtn = page.locator('#customerTableExpandBtn');
      if (await expandBtn.isVisible()) {
        await expandBtn.click();
        await expect(custView).toHaveClass(/roster-table-expanded/);
        await expandBtn.click();
        await expect(custView).not.toHaveClass(/roster-table-expanded/);
      }
    }

    // 2. Select first customer from table
    const firstRow = page.locator('#customerListTable tbody tr').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      const profileView = page.locator('#customerProfileView');
      await expect(profileView).toBeVisible();

      // 3. Verify Profile and Billing tabs
      const billingTabBtn = page.locator('#tabBtnBilling');
      if (await billingTabBtn.isVisible()) {
        await billingTabBtn.click();
        await expect(page.locator('#tabContentBilling')).toBeVisible();

        // Month cards presence
        const monthCard = page.locator('details.month-card').first();
        if (await monthCard.isVisible()) {
          const isOpen = await monthCard.getAttribute('open');
          expect(isOpen).not.toBeNull();
        }
      }

      // 4. Open Account Statement modal
      const statementBtn = page.locator('#openStatementBtn');
      if (await statementBtn.isVisible()) {
        await statementBtn.click();
        const stmtModal = page.locator('#statementModal');
        await expect(stmtModal).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(stmtModal).not.toBeVisible();
      }
    }
  });

  test('Section 10, 11 & 12 - Operations Views (Expenses, Inventory, Reports)', async ({ page, isMobile }) => {
    await page.goto('/');

    // 1. Expenses View
    const drawerToggle = page.locator('#navDrawerToggle');
    await drawerToggle.click();
    await page.locator('#navDrawer button[data-nav-target="expenses"]').click();
    await expect(page.locator('#expensesView')).toBeVisible();

    // Verify sortable headers on expense table
    const expHeaders = page.locator('#expensesView th[data-sort-expense]');
    const countExp = await expHeaders.count();
    expect(countExp).toBeGreaterThanOrEqual(4);

    // 2. Inventory View
    await drawerToggle.click();
    await page.locator('#navDrawer button[data-nav-target="inventory"]').click();
    await expect(page.locator('#inventoryView')).toBeVisible();

    // Verify stock filter dropdown and metric cards
    await expect(page.locator('#inventoryStockFilter')).toBeVisible();
    await expect(page.locator('#inventoryTotalStock')).toBeVisible();

    // 3. Reports View
    await drawerToggle.click();
    await page.locator('#navDrawer button[data-nav-target="reports"]').click();
    await expect(page.locator('#billingReportsView')).toBeVisible();

    // Open Batch Receipt Slips modal
    const batchSlipsBtn = page.locator('#batchReceiptPrintBtn');
    if (await batchSlipsBtn.isVisible()) {
      await batchSlipsBtn.click();
      const batchModal = page.locator('#batchReceiptModal');
      await expect(batchModal).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(batchModal).not.toBeVisible();
    }
  });

  test('Section 14 & 15 - Mobile Speed-Dial, Field Tools & Backup Storage Integrity', async ({ page, isMobile }) => {
    await page.goto('/');

    // 1. Mobile Speed Dial & Field Tools Sheet
    if (isMobile) {
      const speedTrigger = page.locator('#speedDialTrigger');
      if (await speedTrigger.isVisible()) {
        await speedTrigger.click();
        const speedMenu = page.locator('#speedDialMenu');
        await expect(speedMenu).toBeVisible();

        const fieldToolsBtn = page.locator('#speedDialMoreToolsBtn');
        await fieldToolsBtn.click();

        const fieldToolsModal = page.locator('#fieldToolsModal');
        await expect(fieldToolsModal).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(fieldToolsModal).not.toBeVisible();
      }
    }

    // 2. Backup & Restore Controls
    const backupBtn = page.locator('#quickActionBackupData');
    if (await backupBtn.isVisible()) {
      await backupBtn.click();
      const backupControls = page.locator('#backupControls');
      await expect(backupControls).toBeVisible();

      // Click storage integrity audit button
      const integrityBtn = page.locator('#verifyStorageIntegrityBtn');
      if (await integrityBtn.isVisible()) {
        await integrityBtn.click();
        const toast = page.locator('#toast');
        await expect(toast).toBeVisible();
      }
    }

    // 3. Viewport width assertion (zero horizontal scroll overflow)
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);
  });
});
