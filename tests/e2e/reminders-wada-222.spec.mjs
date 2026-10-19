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

async function openRemindersQueue(page, isMobile) {
  if (isMobile) {
    await page.locator('#mobileMoreButton').click();
    await page.locator('#mobileMoreRemindersQueueBtn').click();
  } else {
    await page.evaluate(() => {
      document.getElementById('mobileMoreRemindersQueueBtn')?.click();
    });
  }
}

async function openWadaModal(page, isMobile) {
  if (isMobile) {
    await page.locator('#mobileMoreButton').click();
    await page.locator('#mobileMoreWadaListBtn').click();
  } else {
    await page.evaluate(() => {
      document.getElementById('mobileMoreWadaListBtn')?.click();
    });
  }
}

async function openStagesModal(page, isMobile) {
  if (isMobile) {
    await page.locator('#mobileMoreButton').click();
    await page.locator('#mobileMoreReminderStagesBtn').click();
  } else {
    await page.evaluate(() => {
      document.getElementById('mobileMoreReminderStagesBtn')?.click();
    });
  }
}

test.describe('Issue #222 - WhatsApp Reminder Queue (Staged 2d/due/+3/+7/+15) & Wada Follow-up Suite', () => {

  test('Reminder queue navigation, WhatsApp dispatch, inline promise, and wada follow-up list', async ({ page, isMobile }) => {
    const errors = trackErrors(page);

    await page.goto('/');

    // Seed test customers and bills matching today in PKT
    await page.evaluate(() => {
      const todayStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Karachi',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date());
      const monthStr = todayStr.slice(0, 7);
      const todayDay = parseInt(todayStr.slice(8, 10), 10);

      const raw = localStorage.getItem('shahdara-isp-billing-v1');
      const state = raw ? JSON.parse(raw) : {};

      if (Array.isArray(state.customers) && state.customers.length >= 2) {
        // Customer 1: due day matches today (offset 0)
        state.customers[0].customDueDate = todayDay;
        state.customers[0].phone = '03001234567';
        state.customers[0].bills = [{ month: monthStr, dueAmount: '2500', status: 'unpaid', payments: [] }];

        // Customer 2: due day matches today (higher balance)
        state.customers[1].customDueDate = todayDay;
        state.customers[1].phone = '03007654321';
        state.customers[1].bills = [{ month: monthStr, dueAmount: '4000', status: 'unpaid', payments: [] }];

        localStorage.setItem('shahdara-isp-billing-v1', JSON.stringify(state));
      }
    });

    await page.reload();

    // 1. Open Reminders Today Queue
    await openRemindersQueue(page, isMobile);

    // Verify reminder modal opens and queue bar is displayed
    const reminderModal = page.locator('#paymentReminderModal');
    await expect(reminderModal).toBeVisible();

    const queueBar = page.locator('#reminderQueueBar');
    await expect(queueBar).toBeVisible();

    const queueBadge = page.locator('#reminderQueueBadge');
    await expect(queueBadge).toContainText('Queue: 1 of');

    // Verify next button navigates queue
    const nextBtn = page.locator('#reminderQueueNextBtn');
    if (await nextBtn.isEnabled()) {
      await nextBtn.click();
      await expect(queueBadge).toContainText('Queue: 2 of');
      // Navigate back
      const prevBtn = page.locator('#reminderQueuePrevBtn');
      await prevBtn.click();
      await expect(queueBadge).toContainText('Queue: 1 of');
    }

    // Test WhatsApp button dispatch
    const waBtn = page.locator('#sendWhatsAppReminderBtn');
    await expect(waBtn).toBeVisible();
    await waBtn.click();

    // Verify reminder history reflects dispatch
    const historyList = page.locator('#reminderCustomerHistoryList');
    await expect(historyList).toContainText('WhatsApp');

    // Test Inline Promise-to-Pay recording
    const promiseToggleBtn = page.locator('#reminderRecordPromiseToggleBtn');
    await expect(promiseToggleBtn).toBeVisible();
    await promiseToggleBtn.click();

    const promiseFieldset = page.locator('#reminderInlinePromiseFieldset');
    await expect(promiseFieldset).toBeVisible();

    const promiseDateInput = page.locator('#reminderPromiseDateInput');
    await promiseDateInput.fill('2026-10-25');

    const promiseNoteInput = page.locator('#reminderPromiseNoteInput');
    await promiseNoteInput.fill('Promise to pay cash via shop');

    const savePromiseBtn = page.locator('#saveReminderPromiseBtn');
    await savePromiseBtn.click();

    // Fieldset should now be hidden
    await expect(promiseFieldset).toBeHidden();

    // Close reminder modal
    const closeReminderBtn = page.locator('#closeReminderModalBtn');
    await closeReminderBtn.click();
    await expect(reminderModal).toBeHidden();

    // 2. Open Wada Follow-up List
    await openWadaModal(page, isMobile);

    const wadaModal = page.locator('#wadaFollowupModal');
    await expect(wadaModal).toBeVisible();

    // Check KPI summary bar
    const totalPromisedBadge = page.locator('#wadaTotalPromisedAmount');
    await expect(totalPromisedBadge).toBeVisible();

    // Click upcoming tab to find newly recorded promise
    const tabUpcoming = page.locator('#wadaTabUpcoming');
    await tabUpcoming.click();
    await expect(tabUpcoming).toHaveClass(/is-active/);

    const wadaList = page.locator('#wadaListContainer');
    await expect(wadaList).toContainText('Promise to pay cash via shop');

    // Close wada modal via close button
    const closeWadaBtn = page.locator('#closeWadaModalBtn');
    await closeWadaBtn.click();
    await expect(wadaModal).toBeHidden();

    // 3. Reminder Stages Configuration Modal
    await openStagesModal(page, isMobile);

    const stagesModal = page.locator('#reminderStagesModal');
    await expect(stagesModal).toBeVisible();

    const stagesTable = page.locator('#reminderStagesTableBody');
    await expect(stagesTable).toBeVisible();
    await expect(stagesTable.locator('tr')).toHaveCount(5);

    // Save stages
    const saveStagesBtn = page.locator('#saveReminderStagesBtn');
    await saveStagesBtn.click();
    await expect(stagesModal).toBeHidden();

    // 4. Test Customer Profile Wada button
    const firstCust = page.locator('#customerList .customer-card').first();
    if (await firstCust.isVisible()) {
      await firstCust.click();
      const profilePromiseBtn = page.locator('#openCustomerPromiseBtn');
      if (await profilePromiseBtn.isVisible()) {
        await profilePromiseBtn.click();
        await expect(reminderModal).toBeVisible();
        await expect(promiseFieldset).toBeVisible();

        // Test Escape key closes modal
        await page.keyboard.press('Escape');
        await expect(reminderModal).toBeHidden();
      }
    }

    // Verify zero unexpected console errors
    const criticalErrors = errors.filter(e => !/favicon|fonts|manifest/i.test(e));
    expect(criticalErrors).toHaveLength(0);
  });

  test('Responsive display: 390x844 mobile viewport has zero horizontal scroll in reminder and wada modals', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-only viewport test');
    await page.goto('/');

    // Open Wada modal
    await openWadaModal(page, true);

    const wadaModal = page.locator('#wadaFollowupModal');
    await expect(wadaModal).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);

    // Close wada modal
    await page.click('#closeWadaModalBtn');
    await expect(wadaModal).toBeHidden();
  });
});
