// Repro / regression spec for the user-reported Quick Collect bug:
//   Record a payment -> dismiss the "Payment recorded" toast popup BEFORE its
//   5s Undo window ends -> the Quick Collect window then refuses to close.
// The dialog must ALWAYS close (header ×, success-step Done, Escape) whatever
// state the toast / undo timers are in, and the recorded payment must stay.
import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) errors.push(m.text());
  });
  return errors;
}

async function openQuickCollectWithDues(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('#quickAddPaymentButton').click();
  const modal = page.locator('#quickCollectModal');
  await expect(modal).toBeVisible();
  const setupBtn = page.locator('[data-qc-setup-packages]').first();
  if (await setupBtn.isVisible()) {
    await setupBtn.click();
    await page.locator('#collectSetupSelectAll').check();
    await page.locator('#collectSetupApplyBtn').click();
    await page.locator('#closeCollectSetupBtn').click();
  }
  return modal;
}

async function recordPayment(page, modal) {
  const card = modal.locator('.qc-customer-card').first();
  await expect(card).toBeVisible();
  const customerId = await card.getAttribute('data-customer-id');
  await card.click();
  await page.locator('#quickCollectConfirmBtn').click();
  await expect(page.locator('#quickCollectStepSuccess')).toBeVisible();
  // The "Payment recorded" toast with Undo is up, with its own close (×) button.
  const toast = page.locator('#toast');
  await expect(toast).toBeVisible();
  await expect(toast).toContainText('Payment recorded');
  return customerId;
}

async function dismissToastEarly(page) {
  const toast = page.locator('#toast');
  await toast.locator('.tsx-close').click();
  await expect(toast).toBeHidden();
}

async function expectDialogClosedAndScreenUsable(page, modal) {
  await expect(modal).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.getElementById('quickCollectModal').open)).toBe(false);
  // The screen underneath must be interactive again: Quick Collect reopens.
  await page.locator('#quickAddPaymentButton').click();
  await expect(modal).toBeVisible();
  await page.locator('#closeQuickCollectModalBtn').click();
  await expect(modal).toBeHidden();
}

test.describe('Quick Collect: close after dismissing the Payment-recorded toast early', () => {
  // Full setup (seed + package setup + a payment) is slow on shared CI
  // hardware; give these multi-step flows more than the default 30s.
  test.setTimeout(120000);
  test('toast dismissed early -> header × closes the dialog', async ({ page }) => {
    const errors = trackErrors(page);
    const modal = await openQuickCollectWithDues(page);
    await recordPayment(page, modal);
    await dismissToastEarly(page);
    await page.locator('#closeQuickCollectModalBtn').click();
    await expectDialogClosedAndScreenUsable(page, modal);
    expect(errors).toEqual([]);
  });

  test('toast dismissed early -> success-step Done closes the dialog', async ({ page }) => {
    const errors = trackErrors(page);
    const modal = await openQuickCollectWithDues(page);
    await recordPayment(page, modal);
    await dismissToastEarly(page);
    await page.locator('#quickCollectDoneCloseBtn').click();
    await expectDialogClosedAndScreenUsable(page, modal);
    expect(errors).toEqual([]);
  });

  test('toast dismissed early -> Escape closes the dialog', async ({ page }) => {
    const errors = trackErrors(page);
    const modal = await openQuickCollectWithDues(page);
    await recordPayment(page, modal);
    await dismissToastEarly(page);
    await page.keyboard.press('Escape');
    await expectDialogClosedAndScreenUsable(page, modal);
    expect(errors).toEqual([]);
  });

  test('undo button counts down live from 5s', async ({ page }) => {
    const errors = trackErrors(page);
    const modal = await openQuickCollectWithDues(page);
    await recordPayment(page, modal);
    const undoBtn = page.locator('#quickCollectUndoBtn');
    await expect(undoBtn).toBeVisible();
    const secondsLeft = async () => Number(((await undoBtn.textContent()) || '').match(/\((\d+)s\)/)?.[1] ?? NaN);
    const start = await secondsLeft();
    expect(start).toBeGreaterThan(0);
    expect(start).toBeLessThanOrEqual(5);
    // The label must tick DOWN (it is no longer a static "(5s)" label).
    await expect.poll(secondsLeft, { timeout: 5000 }).toBeLessThan(start);
    await page.locator('#quickCollectDoneCloseBtn').click();
    await expect(modal).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('closing during the undo window confirms "Payment saved" and keeps the payment', async ({ page }) => {
    const errors = trackErrors(page);
    const modal = await openQuickCollectWithDues(page);
    const customerId = await recordPayment(page, modal);
    await dismissToastEarly(page);
    await page.locator('#quickCollectDoneCloseBtn').click();
    await expect(modal).toBeHidden();
    const savedToast = page.locator('#toast');
    await expect(savedToast).toBeVisible();
    await expect(savedToast).toContainText('Payment saved');
    await expect(savedToast).toContainText('saved.');
    // No Undo on the confirmation toast.
    await expect(savedToast.locator('.toast-action-btn')).toHaveCount(0);
    // The payment stayed recorded.
    await page.locator('#quickAddPaymentButton').click();
    await expect(modal).toBeVisible();
    await expect(modal.locator(`.qc-customer-card[data-customer-id="${customerId}"]`)).toHaveCount(0);
    await page.locator('#closeQuickCollectModalBtn').click();
    await expect(modal).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('a close that bypasses the QC close handler still cleans up timers and confirms the save', async ({ page }) => {
    const errors = trackErrors(page);
    const modal = await openQuickCollectWithDues(page);
    await recordPayment(page, modal);
    await dismissToastEarly(page);
    // The universal dialog controller / backdrop / native cancel paths call
    // dialog.close() directly, without going through the QC close handler.
    // Cleanup (undo timer + context + step reset) must still happen.
    await page.evaluate(() => document.getElementById('quickCollectModal').close());
    await expect(modal).toBeHidden();
    await expect(page.locator('#toast')).toContainText('Payment saved');
    // Reopening starts clean on the picker, and a fresh collection works.
    await page.locator('#quickAddPaymentButton').click();
    await expect(modal).toBeVisible();
    await expect(page.locator('#quickCollectStepPick')).toBeVisible();
    await expect(page.locator('#quickCollectStepSuccess')).toBeHidden();
    await recordPayment(page, modal);
    await page.locator('#quickCollectDoneCloseBtn').click();
    await expect(modal).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('dialog closed during the undo window -> payment is kept, QC reopens and can collect again', async ({ page }) => {
    const errors = trackErrors(page);
    const modal = await openQuickCollectWithDues(page);
    const customerId = await recordPayment(page, modal);
    // Close with the toast (and its Undo) still on screen, well before 5s.
    await page.locator('#quickCollectDoneCloseBtn').click();
    await expect(modal).toBeHidden();
    // Payment must NOT have been undone by the close: the customer is no
    // longer pending for the amount just paid.
    await page.locator('#quickAddPaymentButton').click();
    await expect(modal).toBeVisible();
    const paidCard = modal.locator(`.qc-customer-card[data-customer-id="${customerId}"]`);
    await expect(paidCard).toHaveCount(0);
    // A second collection in the reopened dialog works end to end.
    await recordPayment(page, modal);
    await page.locator('#closeQuickCollectModalBtn').click();
    await expect(modal).toBeHidden();
    expect(errors).toEqual([]);
  });
});
