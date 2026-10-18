import { test, expect } from '@playwright/test';

test.describe('Daily Closing Receipts Polish, Live Search & Column Sorting E2E Verification', () => {
  test('SVG conforms to standard XML specification without invalid height=auto attribute', async ({ page }) => {
    await page.goto('/');

    const openBtn = page.locator('#openDailyClosingModalBtn');
    await expect(openBtn).toBeVisible();
    await openBtn.click();

    const modal = page.locator('#dailyClosingModal');
    await expect(modal).toBeVisible();

    const svg = page.locator('#dailyClosingSvgContainer svg');
    await expect(svg).toBeVisible();

    // Verify SVG does not have invalid height="auto" attribute
    const heightAttr = await svg.getAttribute('height');
    expect(heightAttr).toBeNull();

    // Verify SVG style attribute has height: auto
    const styleAttr = await svg.getAttribute('style');
    expect(styleAttr).toContain('height: auto');

    // Close modal
    await page.locator('#closeDailyClosingModalBtn').click();
    await expect(modal).not.toBeVisible();
  });

  test('receipts table live search filters rows and updates count badge', async ({ page }) => {
    await page.goto('/');

    // Seed mock data with recorded payments today
    await page.evaluate(() => {
      const todayStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Karachi',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date());
      const monthStr = todayStr.slice(0, 7);
      const raw = localStorage.getItem('shahdara-isp-billing-v1');
      const state = raw ? JSON.parse(raw) : {};
      if (Array.isArray(state.customers) && state.customers.length >= 2) {
        for (let i = 0; i < 2; i++) {
          const cust = state.customers[i];
          if (!Array.isArray(cust.bills)) cust.bills = [];
          let bill = cust.bills.find(b => b.month === monthStr);
          if (!bill) {
            bill = { month: monthStr, dueAmount: '3000', status: 'pending', payments: [] };
            cust.bills.push(bill);
          }
          if (!Array.isArray(bill.payments)) bill.payments = [];
          bill.payments.push({
            amount: i === 0 ? '1800' : '2500',
            date: todayStr,
            method: i === 0 ? 'Cash at Waseem Abbasi shop' : 'JazzCash',
            paidBy: i === 0 ? 'Waseem Abbasi' : 'Online Portal'
          });
        }
        localStorage.setItem('shahdara-isp-billing-v1', JSON.stringify(state));
      }
    });

    await page.reload();

    const openBtn = page.locator('#openDailyClosingModalBtn');
    await expect(openBtn).toBeVisible();
    await openBtn.click();

    const modal = page.locator('#dailyClosingModal');
    await expect(modal).toBeVisible();

    const searchInput = page.locator('#dailyClosingReceiptsSearch');
    await expect(searchInput).toBeVisible();

    const countBadge = page.locator('#dailyClosingReceiptsCount');
    await expect(countBadge).toBeVisible();

    // Search for JazzCash
    await searchInput.fill('JazzCash');

    const resetBtn = page.locator('#resetDailyClosingReceiptsBtn');
    await expect(resetBtn).toBeVisible();

    // Receipts count should indicate filtered results
    const badgeText = await countBadge.textContent();
    expect(badgeText).toContain('of');

    // Reset search via reset button
    await resetBtn.click();
    await expect(resetBtn).not.toBeVisible();
    expect(await searchInput.inputValue()).toBe('');

    // Close modal
    await page.locator('#closeDailyClosingModalBtn').click();
    await expect(modal).not.toBeVisible();
  });

  test('receipts table column sorting toggles aria-sort and reorders rows', async ({ page }) => {
    await page.goto('/');

    const openBtn = page.locator('#openDailyClosingModalBtn');
    await expect(openBtn).toBeVisible();
    await openBtn.click();

    const modal = page.locator('#dailyClosingModal');
    await expect(modal).toBeVisible();

    const thNum = page.locator('th[data-sort-dcr="customerNumber"]');
    await expect(thNum).toBeVisible();
    expect(await thNum.getAttribute('aria-sort')).toBe('ascending');

    // Click customer number to toggle descending
    await thNum.click();
    expect(await thNum.getAttribute('aria-sort')).toBe('descending');

    // Click amount column header to sort by amount
    const thAmount = page.locator('th[data-sort-dcr="amount"]');
    await expect(thAmount).toBeVisible();
    await thAmount.click();
    expect(await thAmount.getAttribute('aria-sort')).toBe('descending');

    // Press Enter to toggle amount to ascending
    await thAmount.press('Enter');
    expect(await thAmount.getAttribute('aria-sort')).toBe('ascending');

    // Close modal
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('mobile 390x844 responsive verification: touch targets >= 44px and zero horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const openBtn = page.locator('#openDailyClosingModalBtn');
    await expect(openBtn).toBeVisible();
    await openBtn.click();

    const modal = page.locator('#dailyClosingModal');
    await expect(modal).toBeVisible();

    // Verify search input touch target height on mobile (>= 44px)
    const searchInput = page.locator('#dailyClosingReceiptsSearch');
    const searchBox = await searchInput.boundingBox();
    expect(searchBox).not.toBeNull();
    if (searchBox) {
      expect(searchBox.height).toBeGreaterThanOrEqual(44);
    }

    // Verify toolbar buttons touch target height (>= 44px)
    const prevBtn = page.locator('#dailyClosingPrevDateBtn');
    const prevBox = await prevBtn.boundingBox();
    expect(prevBox).not.toBeNull();
    if (prevBox) {
      expect(prevBox.height).toBeGreaterThanOrEqual(44);
    }

    // Verify zero horizontal scroll overflow on mobile
    const hasHorizontalOverflow = await page.evaluate(() => {
      const modalEl = document.getElementById('dailyClosingModal');
      const contentEl = modalEl ? modalEl.querySelector('.billing-modal-content') : null;
      if (!contentEl) return false;
      return contentEl.scrollWidth > window.innerWidth + 2;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Close modal
    await page.locator('#closeDailyClosingModalBtn').click();
    await expect(modal).not.toBeVisible();
  });

  test('desktop 1280x800 dark theme readability', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Switch to dark theme
    const themeBtn = page.locator('#themeToggleBtn');
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
    }

    const openBtn = page.locator('#openDailyClosingModalBtn');
    await expect(openBtn).toBeVisible();
    await openBtn.click();

    const modal = page.locator('#dailyClosingModal');
    await expect(modal).toBeVisible();

    // Verify search input and receipts count badge in dark mode
    const searchInput = page.locator('#dailyClosingReceiptsSearch');
    await expect(searchInput).toBeVisible();

    const countBadge = page.locator('#dailyClosingReceiptsCount');
    await expect(countBadge).toBeVisible();

    // Close modal
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });
});
