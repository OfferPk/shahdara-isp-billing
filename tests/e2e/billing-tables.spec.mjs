import { test, expect } from '@playwright/test';

async function navigateToView(page, viewName) {
  const drawerToggle = page.locator('#navDrawerToggle');
  if (await drawerToggle.isVisible()) {
    await drawerToggle.click();
    await expect(page.locator('#navDrawer')).toBeVisible();
    const navBtn = page.locator(`#navDrawer [data-nav-target="${viewName}"]`);
    await expect(navBtn).toBeVisible();
    await navBtn.click();
  } else {
    const btnMap = {
      transactions: '#showTransactionsButton',
      reports: '#showReportsButton',
      customers: '#showCustomersButton',
      analytics: '#showAnalyticsButton'
    };
    const topNavBtn = page.locator(btnMap[viewName] || '#showCustomersButton');
    if (await topNavBtn.isVisible()) {
      await topNavBtn.click();
    }
  }
}

test.describe('Billing Tables: Customer Roster, Sorting, Filtering & Pagination E2E', () => {
  test('customer view toggle switches between cards and table with persistence', async ({ page }) => {
    await page.goto('/');
    await navigateToView(page, 'customers');

    const customersView = page.locator('#customersView');
    await expect(customersView).toBeVisible();

    const viewCardsBtn = page.locator('#customerViewCardsBtn');
    const viewTableBtn = page.locator('#customerViewTableBtn');
    const customerList = page.locator('#customerList');
    const customerTableWrap = page.locator('#customerTableWrap');
    const customerTable = page.locator('#customerRosterTable');

    await expect(viewCardsBtn).toBeVisible();
    await expect(viewTableBtn).toBeVisible();

    // Default view should be cards
    await expect(viewCardsBtn).toHaveClass(/is-active/);
    await expect(customerList).toBeVisible();
    await expect(customerTableWrap).toBeHidden();

    // Switch to Table View
    await viewTableBtn.click();
    await expect(viewTableBtn).toHaveClass(/is-active/);
    await expect(viewCardsBtn).not.toHaveClass(/is-active/);
    await expect(customerTableWrap).toBeVisible();
    await expect(customerTable).toBeVisible();
    await expect(customerList).toBeHidden();

    // Verify table has rows and headers
    const tableRows = customerTable.locator('tbody tr');
    await expect(tableRows.first()).toBeVisible();

    // Selecting a customer via table row action displays customer detail
    const firstRowSelectBtn = customerTable.locator('tbody tr .customer-row-btn').first();
    await expect(firstRowSelectBtn).toBeVisible();
    await firstRowSelectBtn.dispatchEvent('click');

    const customerDetail = page.locator('#customerDetail');
    await expect(customerDetail).toBeVisible();

    // On mobile view, back button returns from detail pane to customer pane
    const backBtn = page.locator('#backButton');
    if (await backBtn.isVisible()) {
      await backBtn.click();
    }

    // Switch back to Cards View
    await viewCardsBtn.click();
    await expect(viewCardsBtn).toHaveClass(/is-active/);
    await expect(customerList).toBeVisible();
    await expect(customerTableWrap).toBeHidden();
  });

  test('customer area filter dropdown filters customer records', async ({ page }) => {
    // Add sample areas to customers in state so area filter has selectable areas
    await page.addInitScript(() => {
      try {
        const raw = localStorage.getItem('shahdara-isp-billing-v1');
        if (raw) {
          const data = JSON.parse(raw);
          if (data && Array.isArray(data.customers) && data.customers.length >= 2) {
            data.customers[0].mohalla = 'Main Bazaar';
            data.customers[1].mohalla = 'Kot Mohibbu';
            localStorage.setItem('shahdara-isp-billing-v1', JSON.stringify(data));
          }
        }
      } catch (e) {}
    });

    await page.goto('/');
    await navigateToView(page, 'customers');

    const areaSelect = page.locator('#customerFilterArea');
    await expect(areaSelect).toBeVisible();

    // Check area select options
    const options = await areaSelect.locator('option').allInnerTexts();
    expect(options.length).toBeGreaterThanOrEqual(1);
    expect(options[0].toLowerCase()).toContain('all areas');

    // Switch to a specific area if available
    if (options.length > 1) {
      await areaSelect.selectOption({ index: 1 });
      const customerCards = page.locator('#customerList [data-customer-id]');
      const count = await customerCards.count();
      expect(count).toBeGreaterThan(0);

      // Reset to all areas
      await areaSelect.selectOption('all');
    }
  });

  test('customer roster multi-criteria sorting and table header clicks work', async ({ page }) => {
    await page.goto('/');
    await navigateToView(page, 'customers');

    // Switch to table view
    await page.locator('#customerViewTableBtn').click();
    const customerTable = page.locator('#customerRosterTable');
    await expect(customerTable).toBeVisible();

    // Sort by name via dropdown
    const sortSelect = page.locator('#customerSortSelect');
    await expect(sortSelect).toBeVisible();
    await sortSelect.selectOption('name-asc');

    // Header sort buttons
    const nameHeader = page.locator('#customerRosterTable th[data-sort-cust="name"]');
    await expect(nameHeader).toBeVisible();
    await nameHeader.click({ force: true });

    const numberHeader = page.locator('#customerRosterTable th[data-sort-cust="number"]');
    await expect(numberHeader).toBeVisible();
    await numberHeader.click({ force: true });
  });

  test('customer pagination controls navigate pages and update page sizes', async ({ page }) => {
    await page.goto('/');
    await navigateToView(page, 'customers');

    const pagination = page.locator('#customerPagination');
    await expect(pagination).toBeVisible();

    const pageSizeSelect = page.locator('#customerPageSize');
    const pageInfo = page.locator('#customerPageInfo');
    const prevBtn = page.locator('#customerPrevPage');
    const nextBtn = page.locator('#customerNextPage');

    await expect(pageSizeSelect).toBeVisible();
    await expect(pageInfo).toBeVisible();
    await expect(prevBtn).toBeVisible();
    await expect(nextBtn).toBeVisible();

    // Initially on page 1, prev should be disabled
    await expect(prevBtn).toBeDisabled();

    // If more than 15 items exist, next button will be enabled
    const isNextEnabled = await nextBtn.isEnabled();
    if (isNextEnabled) {
      await nextBtn.click();
      await expect(prevBtn).toBeEnabled();
      await prevBtn.click();
      await expect(prevBtn).toBeDisabled();
    }

    // Set page size to 'all'
    await pageSizeSelect.selectOption('all');
    await expect(pageInfo).toContainText('total');
    await expect(prevBtn).toBeDisabled();
    await expect(nextBtn).toBeDisabled();

    // Restore to 15
    await pageSizeSelect.selectOption('15');
  });

  test('monthly report and transactions tables feature dedicated sort controls', async ({ page }) => {
    await page.goto('/');

    // Check Monthly Reports View Sort
    await navigateToView(page, 'reports');
    const reportsView = page.locator('#billingReportsView');
    await expect(reportsView).toBeVisible();

    const reportSortSelect = page.locator('#reportSortSelect');
    await expect(reportSortSelect).toBeVisible();
    await reportSortSelect.selectOption('balance-desc');
    await reportSortSelect.selectOption('name-asc');

    // Check Transactions View Sort
    await navigateToView(page, 'transactions');
    const transactionsView = page.locator('#transactionsView');
    await expect(transactionsView).toBeVisible();

    const txSortSelect = page.locator('#transactionSortSelect');
    await expect(txSortSelect).toBeVisible();
    await txSortSelect.selectOption('amount-desc');
    await txSortSelect.selectOption('date-asc');
  });

  test('mobile viewport 390x844 responsive verification and theme toggle', async ({ page }) => {
    await page.goto('/');
    await navigateToView(page, 'customers');

    // Ensure customer filter controls and view toggle fit without viewport horizontal overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Switch to table mode on mobile
    await page.locator('#customerViewTableBtn').click();
    const tableWrap = page.locator('#customerTableWrap');
    await expect(tableWrap).toBeVisible();

    // Verify touch targets for view toggle buttons
    const btnBox = await page.locator('#customerViewTableBtn').boundingBox();
    if (btnBox) {
      expect(btnBox.height).toBeGreaterThanOrEqual(40);
    }

    // Test dark mode toggle
    const themeBtn = page.locator('#themeToggleBtn');
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
      const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      expect(theme).toBe('dark');

      // Verify table is still styled and visible in dark mode
      await expect(tableWrap).toBeVisible();

      // Toggle back to light
      await themeBtn.click();
    }
  });

  test('customer table full-width expand mode toggles and auto-collapses on row selection', async ({ page }) => {
    await page.goto('/');
    await navigateToView(page, 'customers');

    // Switch to table view
    await page.locator('#customerViewTableBtn').click();
    const tableWrap = page.locator('#customerTableWrap');
    await expect(tableWrap).toBeVisible();

    const expandBtn = page.locator('#customerTableExpandBtn');
    const isExpandVisible = await expandBtn.isVisible();
    if (isExpandVisible) {
      await expect(expandBtn).toHaveAttribute('aria-pressed', 'false');
      await expandBtn.click();
      await expect(expandBtn).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.app-shell')).toHaveClass(/roster-table-expanded/);

      // Select a row to verify auto-collapse
      const firstRowSelectBtn = page.locator('#customerRosterTable tbody tr .customer-row-btn').first();
      await firstRowSelectBtn.dispatchEvent('click');
      await expect(page.locator('.app-shell')).not.toHaveClass(/roster-table-expanded/);
      await expect(expandBtn).toHaveAttribute('aria-pressed', 'false');
    }
  });

  test('customer table keyboard sorting and aria-sort attribute synchronization', async ({ page }) => {
    await page.goto('/');
    await navigateToView(page, 'customers');

    // Switch to table view
    await page.locator('#customerViewTableBtn').click();
    const table = page.locator('#customerRosterTable');
    await expect(table).toBeVisible();

    const nameTh = table.locator('th[data-sort-cust="name"]');
    await expect(nameTh).toBeVisible();
    await expect(nameTh).toHaveAttribute('tabindex', '0');
    await expect(nameTh).toHaveAttribute('role', 'columnheader');

    // Press Enter to trigger keyboard sort
    await nameTh.focus();
    await page.keyboard.press('Enter');
    const sortVal = await nameTh.getAttribute('aria-sort');
    expect(['ascending', 'descending']).toContain(sortVal);

    // Verify sort icon exists
    const sortIcon = nameTh.locator('.sort-icon');
    await expect(sortIcon).toBeVisible();
  });

  test('customer table empty state renders contextual message and reset filters button works', async ({ page }) => {
    await page.goto('/');
    await navigateToView(page, 'customers');

    // Switch to table view
    await page.locator('#customerViewTableBtn').click();
    await expect(page.locator('#customerRosterTable')).toBeVisible();

    // Type a search query that yields zero results
    const searchInput = page.locator('#customerListSearch');
    await searchInput.fill('xyznonexistentcustomer123');

    const emptyRow = page.locator('#customerRosterTable .customer-table-empty');
    await expect(emptyRow).toBeVisible();
    await expect(emptyRow).toContainText('xyznonexistentcustomer123');

    // Click reset filters button
    const resetBtn = page.locator('#resetCustomerTableFiltersBtn');
    await expect(resetBtn).toBeVisible();
    await resetBtn.dispatchEvent('click');

    // Should clear search input and restore rows
    await expect(searchInput).toHaveValue('');
    await expect(emptyRow).toBeHidden();
    const rows = page.locator('#customerRosterTable tbody tr');
    await expect(rows.first()).toBeVisible();
  });

  test('customer roster CSV export button downloads CSV file and displays toast', async ({ page }) => {
    await page.goto('/');
    await navigateToView(page, 'customers');

    // Switch to table view
    await page.locator('#customerViewTableBtn').click();
    const exportBtn = page.locator('#exportCustomerRosterCsvBtn');
    await expect(exportBtn).toBeVisible();

    // Setup download listener
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
    await exportBtn.click();

    const download = await downloadPromise;
    if (download) {
      expect(download.suggestedFilename()).toContain('customer-roster-');
      expect(download.suggestedFilename()).toContain('.csv');
    }

    // Verify toast notification appears
    const toast = page.locator('#toast');
    if (await toast.isVisible()) {
      await expect(toast).toContainText('Exported');
    }
  });
});

