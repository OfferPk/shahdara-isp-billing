// Bulk Collect Cash + Quick Collect pending-only default.
import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // Chrome's "Blocked call to navigator.vibrate" intervention (no user tap yet) is not an app error.
  page.on('console', m => { if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) errors.push(m.text()); });
  return errors;
}

// Bills for the first 4 active customers (current month): 1500, 2000, 2500, 3000; the
// second one already paid 500 today (partial).
async function seedBills(page) {
  await page.goto('/');
  await page.evaluate(async () => {
    const core = await import('./core.js');
    let s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    const now = new Date();
    const month = now.toISOString().slice(0, 7);
    const today = new Date(now.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 10);
    const ids = s.customers.filter(c => !c.archived).slice(0, 4).map(c => c.id);
    ids.forEach((id, i) => { s = core.saveBillMonth(s, id, { month, dueAmount: 1500 + i * 500, status: 'pending' }); });
    s = core.addPayment(s, ids[1], month, { date: today, amount: 500, method: 'Cash' });
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(s));
  });
  await page.reload();
}

const openQuickCollect = async page => {
  await page.locator('#quickAddPaymentButton').click();
  await expect(page.locator('#quickCollectModal')).toBeVisible();
};

test.describe('Quick Collect pending-only list', () => {
  test('lists only pending customers by default; paying in full removes the customer immediately', async ({ page }) => {
    const errors = trackErrors(page);
    await seedBills(page);
    await openQuickCollect(page);
    const modal = page.locator('#quickCollectModal');
    await expect(modal.locator('.quick-collect-filter-chip[data-filter="all-dues"]')).toHaveClass(/is-active/);
    await expect(page.locator('#quickCollectDuesCount')).toHaveText('4');
    const cards = modal.locator('.qc-customer-card');
    await expect(cards).toHaveCount(4);
    // Partial customer stays, with the remaining amount.
    await expect(modal.locator('.qc-customer-card', { hasText: 'PKR 1,500' })).toHaveCount(2);

    const first = cards.first();
    const id = await first.getAttribute('data-customer-id');
    await first.click();
    await expect(page.locator('#quickCollectAmountInput')).toHaveValue('3000.00');
    await page.locator('#quickCollectConfirmBtn').click();
    await expect(page.locator('#quickCollectStepSuccess')).toBeVisible();
    await page.locator('#quickCollectAnotherBtn').click();
    await expect(cards).toHaveCount(3);
    await expect(modal.locator(`.qc-customer-card[data-customer-id="${id}"]`)).toHaveCount(0);
    await expect(page.locator('#quickCollectDuesCount')).toHaveText('3');
    // "All" still shows paid customers.
    await modal.locator('.quick-collect-filter-chip[data-filter="all"]').click();
    await expect(modal.locator(`.qc-customer-card[data-customer-id="${id}"]`)).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('no fees yet (#248): "No pending dues" + Set packages; fee for 3, pay 1 -> exactly 2 rows', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    await openQuickCollect(page);
    const modal = page.locator('#quickCollectModal');
    await expect(modal.locator('.qc-needs-setup')).toBeVisible();
    await expect(modal.getByText('No pending dues')).toBeVisible();
    await expect(modal.locator('.qc-customer-card')).toHaveCount(0);
    // No horizontal overflow of the Quick Collect card.
    const overflow = await modal.evaluate(d => d.scrollWidth - d.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await modal.locator('[data-qc-generate-bills]').click();
    await expect(modal.locator('.qc-generate-result')).toContainText('need a package');

    await modal.locator('[data-qc-setup-packages]').click();
    const setup = page.locator('#collectSetupModal');
    await expect(setup).toBeVisible();
    for (let i = 0; i < 3; i++) await setup.locator('[data-cs-customer]').nth(i).check();
    await page.locator('#collectSetupPackage').selectOption('3mbps-100gb');
    await page.locator('#collectSetupApplyBtn').click();
    await expect(page.locator('#collectSetupStatus')).toContainText('Package set for 3 customers · 3 bills generated');
    await page.locator('#closeCollectSetupBtn').click();
    await expect(setup).toBeHidden();
    await expect(page.locator('#quickCollectDuesCount')).toHaveText('3');
    const cards = modal.locator('.qc-customer-card');
    await expect(cards).toHaveCount(3);
    // Pay one in full -> exactly 2 left.
    await cards.first().click();
    await expect(page.locator('#quickCollectAmountInput')).toHaveValue('1000.00');
    await page.locator('#quickCollectConfirmBtn').click();
    await page.locator('#quickCollectAnotherBtn').click();
    await expect(cards).toHaveCount(2);
    expect(errors).toEqual([]);
  });

  test('everyone paid: shows "Sab ka bill wusool ho gaya" with a Show all button', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    await page.evaluate(async () => {
      const core = await import('./core.js');
      let s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
      const month = new Date().toISOString().slice(0, 7);
      const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
      const id = s.customers[0].id;
      s = core.updateCustomerProfile(s, id, { monthlySellingAmount: 1000 });
      s = core.generateMonthlyBillsThroughCurrentMonth(s);
      s = core.addPayment(s, id, month, { date: today, amount: 1000, method: 'Cash' });
      s = { ...s, customers: s.customers.map((c, i) => (i === 0 ? c : { ...c, archived: true, archivedAt: today })) };
      localStorage.setItem(core.STORAGE_KEY, JSON.stringify(s));
    });
    await page.reload();
    await openQuickCollect(page);
    const modal = page.locator('#quickCollectModal');
    await expect(modal.getByText('Sab ka bill wusool ho gaya')).toBeVisible();
    await modal.locator('[data-qc-show-all]').click();
    await expect(modal.locator('.qc-customer-card')).toHaveCount(1);
    await expect(modal.locator('.qc-customer-card')).toContainText('SETTLED');
    expect(errors).toEqual([]);
  });
});

test.describe('Bulk Collect Cash', () => {
  test('batch: prefill, multi-select, totals, duplicate popup, remove/undo, save through payments', async ({ page }) => {
    const errors = trackErrors(page);
    await seedBills(page);
    await openQuickCollect(page);
    await page.locator('#openBulkCollectBtn').click();
    const modal = page.locator('#bulkCollectModal');
    await expect(modal).toBeVisible();
    await expect(page).toHaveURL(/#\/bulk-collect$/);
    const today = await page.evaluate(() => new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10));
    await expect(page.locator('#bulkCollectDate')).toHaveValue(today);
    await expect(page.locator('#bulkCollectMethod')).toHaveValue('Cash');

    const cards = modal.locator('.bc-pick-card');
    await expect(cards).toHaveCount(4);
    // Tap one: pending amount is prefilled.
    await cards.first().click();
    await expect(page.locator('#bulkCollectAmount')).toHaveValue('3000');
    await page.locator('#bulkCollectAmount').fill('2800');
    await page.locator('#bulkCollectNote').fill('Saad · Jia Musa round');
    await page.locator('#bulkCollectAddBtn').click();
    await expect(page.locator('#bulkCollectTotal')).toHaveText('PKR 2,800');
    await expect(cards).toHaveCount(3);

    // Multi-select two more.
    await cards.nth(0).click();
    await cards.nth(1).click();
    await expect(page.locator('#bulkCollectAddBtn')).toHaveText('+ Add 2 to batch');
    await page.locator('#bulkCollectAddBtn').click();
    await expect(page.locator('#bulkCollectCount')).toHaveText('3 customers');
    await expect(page.locator('#bulkCollectTotal')).toHaveText('PKR 6,800');
    await expect(cards).toHaveCount(1);

    // Duplicate: search an added customer and tap it.
    const firstName = (await modal.locator('.bc-review-item strong').first().textContent()).trim();
    await page.locator('#bulkCollectSearch').fill(firstName);
    await modal.locator('.bc-pick-card.is-in-batch').first().click();
    const dup = page.locator('#bulkDuplicateDialog');
    await expect(dup).toBeVisible();
    await expect(dup.getByText('Already added')).toBeVisible();
    await expect(page.locator('#bulkDuplicateName')).toHaveText(firstName);
    await expect(page.locator('#bulkDuplicateArea')).not.toBeEmpty();
    await expect(page.locator('#bulkDuplicateMobile')).not.toBeEmpty();
    await expect(page.locator('#bulkDuplicateAmount')).toHaveText('PKR 2,800');
    await page.locator('#bulkDuplicateCancelBtn').click();
    await expect(dup).toBeHidden();
    await expect(page.locator('#bulkCollectCount')).toHaveText('3 customers');
    await page.locator('#bulkCollectSearch').fill('');

    // The remaining one already paid today -> "Already added" (recorded) popup; confirm adds it.
    await cards.first().click();
    await page.locator('#bulkCollectAddBtn').click();
    await expect(dup).toBeVisible();
    await expect(dup).toContainText('already has a payment recorded');
    await page.locator('#bulkDuplicateConfirmBtn').click();
    await expect(page.locator('#bulkCollectCount')).toHaveText('4 customers');
    await expect(modal.getByText('Sab pending customers batch mein add ho gaye')).toBeVisible();

    // Remove + undo.
    await modal.locator('[data-bulk-remove]').last().click();
    await expect(page.locator('#bulkCollectCount')).toHaveText('3 customers');
    await page.locator('#bulkCollectUndoBtn').click();
    await expect(page.locator('#bulkCollectCount')).toHaveText('4 customers');
    await expect(page.locator('#bulkCollectTotal')).toHaveText('PKR 8,300');

    // Save: every entry goes through the existing payment path and persists.
    await page.locator('#bulkCollectSaveBtn').click();
    await expect(page.locator('#bulkCollectStatus')).toContainText('4 payments saved · PKR 8,300');
    await expect(page.locator('#bulkCollectCount')).toHaveText('0 customers');
    const saved = await page.evaluate(async () => {
      const core = await import('./core.js');
      const s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
      return s.customers.flatMap(c => c.bills.flatMap(b => b.payments)).filter(p => p.paidBy === 'Saad · Jia Musa round').length;
    });
    expect(saved).toBe(4);
    // Only the 2,800-of-3,000 customer still owes; the rest were paid in full.
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('PKR 200');

    await page.locator('#closeBulkCollectBtn').click();
    await expect(modal).toBeHidden();
    await expect(page).not.toHaveURL(/bulk-collect/);
    // Back on the previous screen (the Home dashboard button may be collapsed there).
    await page.evaluate(() => window.quickCollectModalController.open());
    await expect(page.locator('#quickCollectModal')).toBeVisible();
    await expect(page.locator('#quickCollectDuesCount')).toHaveText('1');
    expect(errors).toEqual([]);
  });

  test('#/bulk-collect deep link opens the batch screen; Back closes it', async ({ page }) => {
    const errors = trackErrors(page);
    await seedBills(page);
    await page.goto('/#/customers');
    await page.goto('/#/bulk-collect');
    const modal = page.locator('#bulkCollectModal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.bc-pick-card')).toHaveCount(4);
    // Fits the screen.
    const box = await modal.boundingBox();
    const vp = page.viewportSize();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
    await page.goBack();
    await expect(modal).toBeHidden();
    expect(errors).toEqual([]);
  });
});
