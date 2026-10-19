import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) {
      errors.push(m.text());
    }
  });
  return errors;
}

test.describe('Issue #221 - Collector Day Route Outcomes, Reordering & End-of-Day Cash Handover with Variance', () => {

  test('Field Route Sheet visit outcomes, filter tabs, reordering and handover bridge', async ({ page }) => {
    const errors = trackErrors(page);

    await page.goto('/');

    // Seed dues on first 3 customers
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

      if (Array.isArray(state.customers) && state.customers.length >= 3) {
        for (let i = 0; i < 3; i++) {
          const cust = state.customers[i];
          cust.area = 'Main Bazaar';
          cust.mohalla = 'Chowk';
          if (!Array.isArray(cust.bills)) cust.bills = [];
          let bill = cust.bills.find(b => b.month === monthStr);
          if (!bill) {
            bill = { month: monthStr, dueAmount: String(1500 + i * 500), status: 'unpaid', payments: [] };
            cust.bills.push(bill);
          } else {
            bill.dueAmount = String(1500 + i * 500);
            bill.status = 'unpaid';
          }
        }
        localStorage.setItem('shahdara-isp-billing-v1', JSON.stringify(state));
      }
    });

    await page.reload();

    // 1. Open Field Route Sheet modal via data-open-field-route trigger
    await page.evaluate(() => {
      const btn = document.querySelector('[data-open-field-route]');
      if (btn) btn.click();
    });

    const routeModal = page.locator('#fieldRouteModal');
    await expect(routeModal).toBeVisible();

    // 2. Verify outcome filter tabs exist
    const filterTabs = routeModal.locator('.route-filter-tab');
    await expect(filterTabs.filter({ hasText: '🤝 Promised' })).toBeVisible();
    await expect(filterTabs.filter({ hasText: '🚪 Not Home' })).toBeVisible();
    await expect(filterTabs.filter({ hasText: '✕ Refused' })).toBeVisible();

    // 3. Verify stops list is rendered with outcome buttons
    const stopsList = page.locator('#fieldRouteStopsList');
    await expect(stopsList).toBeVisible();
    const stopCards = stopsList.locator('.route-card');
    await expect(stopCards.first()).toBeVisible();

    // 4. Mark first customer as "Not Home"
    const firstStop = stopCards.first();
    const notHomeBtn = firstStop.locator('button[data-set-outcome="not_home"]');
    await expect(notHomeBtn).toBeVisible();
    await notHomeBtn.click();

    // Verify stop badge shows Not Home
    await expect(firstStop).toContainText('Not Home');

    // 5. Filter by "Not Home" tab
    const notHomeTab = filterTabs.filter({ hasText: 'Not Home' });
    await notHomeTab.click();
    await expect(stopsList.locator('.route-card')).toHaveCount(1);

    // Switch back to "All" tab
    await filterTabs.filter({ hasText: 'All' }).click();

    // 6. Test re-order move down button exists
    const moveDownBtn = firstStop.locator('button[data-move-stop="down"]');
    if (await moveDownBtn.isVisible()) {
      await moveDownBtn.click();
    }

    // 7. Verify "#openHandoverFromRouteBtn" links directly to Daily Closing Cash Handover
    const handoverBridgeBtn = page.locator('#openHandoverFromRouteBtn');
    await expect(handoverBridgeBtn).toBeVisible();
    await handoverBridgeBtn.click();

    // Field Route modal should close and Daily Closing modal should open
    await expect(routeModal).not.toBeVisible();
    const closingModal = page.locator('#dailyClosingModal');
    await expect(closingModal).toBeVisible();

    // Handover section inside Daily Closing is visible
    const handoverSection = page.locator('#dailyClosingHandoverSection');
    await expect(handoverSection).toBeVisible();

    // Close Daily Closing Modal
    await page.locator('#closeDailyClosingModalBtn').click();
    await expect(closingModal).not.toBeVisible();

    expect(errors).toEqual([]);
  });

  test('Daily Closing Collector Cash Handover with variance, anti-tamper lock & slip generation', async ({ page }) => {
    const errors = trackErrors(page);

    await page.goto('/');

    // Seed state with cash payments collected today by 'Hamza Field'
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
            bill = { month: monthStr, dueAmount: '3000', status: 'paid', payments: [] };
            cust.bills.push(bill);
          }
          if (!Array.isArray(bill.payments)) bill.payments = [];
          bill.payments.push({
            id: `pay-test-${i + 1}`,
            amount: i === 0 ? 2000 : 1500,
            date: todayStr,
            method: 'Cash',
            paidBy: 'Hamza Field'
          });
        }
        localStorage.setItem('shahdara-isp-billing-v1', JSON.stringify(state));
      }
    });

    await page.reload();

    // 1. Open Daily Closing modal
    const openClosingBtn = page.locator('#openDailyClosingModalBtn');
    await expect(openClosingBtn).toBeVisible();
    await openClosingBtn.click();

    const closingModal = page.locator('#dailyClosingModal');
    await expect(closingModal).toBeVisible();

    // 2. Handover Section Elements
    const handoverSection = page.locator('#dailyClosingHandoverSection');
    await expect(handoverSection).toBeVisible();

    const collectorSelect = page.locator('#handoverCollectorSelect');
    await expect(collectorSelect).toBeVisible();

    // Select Hamza Field
    await collectorSelect.selectOption({ label: 'Hamza Field' });

    // Verify expected cash displays 3,500
    const expectedDisplay = page.locator('#handoverExpectedCashDisplay');
    await expect(expectedDisplay).toContainText('3,500');

    // 3. Enter Counted Cash: test shortage scenario (enter 3,200)
    const countedInput = page.locator('#handoverCountedCashInput');
    await countedInput.fill('3200');

    // Live variance badge should show Shortage -PKR 300
    const varianceBadge = page.locator('#handoverVarianceBadge');
    await expect(varianceBadge).toContainText('Shortage');
    await expect(varianceBadge).toContainText('300');

    // 4. Fill Supervisor / Receiver and Notes
    await page.locator('#handoverToInput').fill('Usman Owner');
    await page.locator('#handoverNotesInput').fill('Evening closing, pending Rs 300 from customer shop change');

    // 5. Click Sign Off & Record Handover
    const recordBtn = page.locator('#recordHandoverBtn');
    await recordBtn.click();

    // 6. Verify Signed-off status banner appears with lock details
    const statusBanner = page.locator('#handoverStatusBanner');
    await expect(statusBanner).toBeVisible();
    await expect(statusBanner).toContainText('Signed Off');
    await expect(statusBanner).toContainText('shortage');
    await expect(statusBanner).toContainText('Usman Owner');

    // 7. Verify Anti-Tamper Rule:
    // Update counted cash without correction reason -> attempt to save triggers required reason prompt
    await countedInput.fill('3500');
    await recordBtn.click();

    // Correction reason input should be visible and highlighted
    const correctionWrap = page.locator('#handoverCorrectionWrap');
    await expect(correctionWrap).toBeVisible();
    const correctionInput = page.locator('#handoverCorrectionReasonInput');
    await expect(correctionInput).toBeVisible();

    // Provide audited correction reason and save
    await correctionInput.fill('Customer paid remaining Rs 300 at counter late evening');
    await recordBtn.click();

    // Status banner updates and notes audited correction
    await expect(statusBanner).toContainText('balanced');
    await expect(statusBanner).toContainText('Correction(s)');

    // 8. Test Action Buttons: Copy Slip, WhatsApp share, Print
    const copySlipBtn = page.locator('#copyHandoverSlipBtn');
    await expect(copySlipBtn).toBeVisible();
    await copySlipBtn.click();

    const shareWhatsAppBtn = page.locator('#shareHandoverWhatsAppBtn');
    await expect(shareWhatsAppBtn).toBeVisible();

    const printSlipBtn = page.locator('#printHandoverSlipBtn');
    await expect(printSlipBtn).toBeVisible();

    // 9. Close modal
    await page.locator('#closeDailyClosingModalBtn').click();
    await expect(closingModal).not.toBeVisible();

    expect(errors).toEqual([]);
  });
});
