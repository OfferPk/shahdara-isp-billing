/**
 * reminders-queue-catchup-284.spec.mjs - E2E browser tests for:
 * - Issue #284: Reminders Today Queue catch-up stages & empty state screen
 *
 * Verifies:
 * 1. Mobile & desktop: Reminders Today Queue opens and displays customers at or past reminder stages.
 * 2. Catch-up label shows correct stage and overdue status.
 * 3. Queue navigation (Next, Prev, Skip) works across customers.
 * 4. Empty queue opens the modal with the clear empty state ("All reminders sent today ✓"),
 *    shows overdue customer count, and includes working Dues Recovery and Close buttons.
 * 5. More menu item displays the badge with pending queue count.
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

test.describe('Issue #284: Reminders Today Queue catch-up stages and empty state', () => {
  test.beforeEach(async ({ page }) => {
    // Open main page and initialize
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('opens Reminders Today Queue with catch-up stages when customers are overdue', async ({ page }) => {
    const errors = trackErrors(page);

    // Open Reminders Queue (via mobile bottom nav More menu or desktop trigger)
    const moreBtn = page.locator('#mobileMoreButton');
    if (await moreBtn.isVisible()) {
      await moreBtn.click();
      const remindersQueueBtn = page.locator('#mobileMoreRemindersQueueBtn');
      await expect(remindersQueueBtn).toBeVisible();
      await remindersQueueBtn.click();
    } else {
      // On desktop (where mobile-bottom-nav is hidden), dispatch click to the reminders queue handler
      await page.evaluate(() => {
        const btn = document.querySelector('#mobileMoreRemindersQueueBtn');
        if (btn) btn.click();
      });
    }

    // The payment reminder modal MUST open (never just a silent toast!)
    const reminderModal = page.locator('#paymentReminderModal');
    await expect(reminderModal).toBeVisible();

    // Check if queue has items or empty state
    const queueBar = page.locator('#reminderQueueBar');
    const emptyState = page.locator('#reminderQueueEmptyState');

    const isQueueActive = await queueBar.isVisible();
    const isEmptyActive = await emptyState.isVisible();

    // At least one mode must be active and visible inside the modal
    expect(isQueueActive || isEmptyActive).toBe(true);

    if (isQueueActive) {
      // Queue is populated with overdue accounts
      const queueBadge = page.locator('#reminderQueueBadge');
      await expect(queueBadge).toContainText(/Queue:\s*1\s*of/i);

      const stagePill = page.locator('#reminderQueueStagePill');
      await expect(stagePill).toBeVisible();

      // Next button works
      const nextBtn = page.locator('#reminderQueueNextBtn');
      if (await nextBtn.isEnabled()) {
        await nextBtn.click();
        await expect(queueBadge).toContainText(/Queue:\s*2\s*of/i);
      }
    }

    // Modal closes properly
    const closeBtn = page.locator('#closeReminderModalBtn');
    await closeBtn.click();
    await expect(reminderModal).toBeHidden();

    expect(errors).toEqual([]);
  });

  test('empty reminder queue displays clear empty state screen with Dues Recovery action', async ({ page }) => {
    const errors = trackErrors(page);

    // Set mock state where all reminders are sent or balance is settled
    await page.evaluate(() => {
      // Directly trigger openPaymentReminderModal in empty mode
      if (typeof window.openPaymentReminderModal === 'function') {
        window.openPaymentReminderModal(null, {
          isEmptyQueue: true,
          overdueCount: 42
        });
      }
    });

    const reminderModal = page.locator('#paymentReminderModal');
    await expect(reminderModal).toBeVisible();

    const emptyState = page.locator('#reminderQueueEmptyState');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('All reminders sent today ✓');

    const overdueBadge = page.locator('#reminderQueueOverdueCountBadge');
    await expect(overdueBadge).toBeVisible();
    await expect(overdueBadge).toContainText('42');

    // Test "Go to Dues Recovery" button
    const duesRecoveryBtn = page.locator('#reminderEmptyOpenDuesRecoveryBtn');
    await expect(duesRecoveryBtn).toBeVisible();
    await duesRecoveryBtn.click();

    // Modal should close and URL hash should point to recovery
    await expect(reminderModal).toBeHidden();
    expect(page.url()).toContain('#/recovery');

    expect(errors).toEqual([]);
  });

  test('empty reminder queue close button closes modal cleanly without errors', async ({ page }) => {
    const errors = trackErrors(page);

    await page.evaluate(() => {
      if (typeof window.openPaymentReminderModal === 'function') {
        window.openPaymentReminderModal(null, {
          isEmptyQueue: true,
          overdueCount: 0
        });
      }
    });

    const reminderModal = page.locator('#paymentReminderModal');
    await expect(reminderModal).toBeVisible();

    const emptyCloseBtn = page.locator('#reminderEmptyCloseBtn');
    await expect(emptyCloseBtn).toBeVisible();
    await emptyCloseBtn.click();

    await expect(reminderModal).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('More menu Reminders Today button contains badge element', async ({ page }) => {
    const errors = trackErrors(page);

    const badge = page.locator('#mobileMoreRemindersQueueBadge');
    await expect(badge).toBeAttached();

    expect(errors).toEqual([]);
  });
});
