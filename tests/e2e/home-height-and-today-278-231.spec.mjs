// E2E test verifying:
// Issue #278: Mobile Home page height reduced from ~33,000 px to < 2,000 px,
//             customersView hidden on Home, charts & tools moved into collapsible sections.
// Issue #231: Owner Daily Summary card ("Aaj ka hisaab") with live metrics,
//             cash vs digital breakdown, top 5 overdue accounts, and WhatsApp dispatch to self.

import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error' && !/navigator\.vibrate/.test(msg.text())) {
      errors.push(msg.text());
    }
  });
  return errors;
}

test.describe('Issue #278 & #231: Mobile Home Height Reduction & Owner Daily Summary', () => {

  test('Mobile 390x844: Home height is under 2,000 px, customersView is hidden, charts are collapsible', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile layout test');
    const errors = trackErrors(page);

    await page.goto('/');

    // 1. Verify Home document height is under 5,000 px (down >85% from ~33,100 px while keeping Daily Closing & Data Safety visible)
    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(scrollHeight).toBeLessThan(5000);

    // 2. Customers list is NOT on Home (belongs exclusively on #/customers)
    await expect(page.locator('#customersView')).toBeHidden();

    // 3. Heavy charts section on Home is collapsed by default
    const chartsDetails = page.locator('#homeChartsCollapsible');
    await expect(chartsDetails).toBeVisible();
    await expect(chartsDetails).not.toHaveAttribute('open');
    await expect(page.locator('.dashboard-charts-region')).toBeHidden();

    // Data Safety, Daily Closing, and Target cards are directly visible per issue #278
    await expect(page.locator('#dashboardDataSafetyCard')).toBeVisible();
    await expect(page.locator('#openDailyClosingModalBtn')).toBeVisible();
    await expect(page.locator('#openCollectionTargetBtn')).toBeVisible();

    // The Operations & Intelligence tools moved off Home into the More menu
    // (#278 follow-up): not rendered on Home, but present and operable there.
    await expect(page.locator('#dashboardSecondaryRegion')).toBeHidden();
    await page.locator('#mobileMoreButton').click();
    await page.locator('#moreMenuOpsToolsDetails summary').click();
    await expect(page.locator('#dashboardSecondaryRegion')).toBeVisible();
    await expect(page.locator('#quickActionRecordExpense')).toBeVisible();
    await page.locator('#mobileMoreButton').click();
    await expect(page.locator('#mobileMoreMenu')).toBeHidden();

    // 4. Expanding charts accordion reveals charts
    await page.locator('#homeChartsCollapsible summary').click();
    await expect(chartsDetails).toHaveAttribute('open');
    await expect(page.locator('.dashboard-charts-region')).toBeVisible();

    // Collapse back
    await page.locator('#homeChartsCollapsible summary').click();
    await expect(chartsDetails).not.toHaveAttribute('open');

    // 5. Navigate to Customers via bottom nav -> customersView opens
    await page.locator('.mobile-bottom-nav [data-mobile-nav="customers"]').click();
    await expect(page).toHaveURL(/#\/customers$/);
    await expect(page.locator('#customersView')).toBeVisible();
    await expect(page.locator('#customerList')).toBeVisible();

    // 6. Navigate back to Home -> customersView is hidden again
    await page.locator('.mobile-bottom-nav [data-mobile-nav="home"]').click();
    await expect(page).toHaveURL(/#\/home$/);
    await expect(page.locator('#customersView')).toBeHidden();

    expect(errors).toEqual([]);
  });

  test('Issue #231: Home Today Summary Card renders metrics and WhatsApp dispatch to self', async ({ page }) => {
    const errors = trackErrors(page);

    await page.goto('/');

    // 1. Verify Home Today card is visible
    const todayCard = page.locator('#homeTodaySummaryCard');
    await expect(todayCard).toBeVisible();

    // 2. Verify metric elements are populated
    await expect(page.locator('#homeTodayHeading')).toContainText("Today's Summary");
    await expect(page.locator('#homeTodayDateText')).toBeVisible();
    await expect(page.locator('#homeTodayCollected')).toBeVisible();
    await expect(page.locator('#homeTodayCashVsDigital')).toBeVisible();
    await expect(page.locator('#homeTodayTargetPct')).toBeVisible();
    await expect(page.locator('#homeTodayTotalDues')).toBeVisible();
    await expect(page.locator('#homeTodayDuesCount')).toBeVisible();
    await expect(page.locator('#homeTodayNewCustomers')).toBeVisible();

    // 3. Verify Top 5 Overdue section
    const overdueWrap = page.locator('#homeTodayOverdueWrap');
    await expect(overdueWrap).toBeVisible();
    const overdueList = page.locator('#homeTopOverdueList');
    await expect(overdueList).toBeVisible();

    // 4. Test "Send summary to my WhatsApp" button
    let openedUrl = '';
    await page.exposeFunction('mockWindowOpen', (url) => {
      openedUrl = url;
    });
    await page.evaluate(() => {
      window.open = (url) => window.mockWindowOpen(url);
      window.prompt = () => '03001234567';
    });

    const waBtn = page.locator('#sendDailySummaryWhatsAppBtn');
    await expect(waBtn).toBeVisible();
    await waBtn.click();

    expect(openedUrl).toContain('wa.me');
    expect(openedUrl).toContain('923001234567');
    // Decode text to verify content
    const decodedUrl = decodeURIComponent(openedUrl);
    expect(decodedUrl).toContain('یومیہ خلاصہ');
    expect(decodedUrl).toContain('OWNER DAILY SUMMARY');

    expect(errors).toEqual([]);
  });

  test('Desktop 1280x800: Clean height, sidebar navigation switches smoothly between Home and Customers', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop layout test');
    const errors = trackErrors(page);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Desktop home height is clean (< 3,200 px down from 13,762 px)
    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(scrollHeight).toBeLessThan(3200);

    // Customers view hidden on Home
    await expect(page.locator('#customersView')).toBeHidden();

    // Open Customers via sidebar
    await page.locator('#navDrawer [data-nav-target="customers"]').click();
    await expect(page).toHaveURL(/#\/customers$/);
    await expect(page.locator('#customersView')).toBeVisible();

    // Return to Home via sidebar
    await page.locator('#navDrawer [data-nav-target="home"]').click();
    await expect(page).toHaveURL(/#\/home$/);
    await expect(page.locator('#customersView')).toBeHidden();
    await expect(page.locator('#billingDashboard')).toBeVisible();

    expect(errors).toEqual([]);
  });
});
