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

// Bulk Collect v2 (#249 follow-up): search finds every customer, each row has its own amount
// box + Add, Enter adds and returns to a cleared search, and the batch list sits above Save.
const amountOf = (page, id) => page.locator(`.bc-row[data-bulk-row="${id}"] [data-bulk-amount]`);
const addBtnOf = (page, id) => page.locator(`.bc-row[data-bulk-row="${id}"] [data-bulk-add]`);

async function expectFitsAndNoOverflow(page) {
  const m = await page.evaluate(() => {
    const d = document.getElementById('bulkCollectModal');
    const c = d.querySelector('.bulk-collect-card');
    const r = d.getBoundingClientRect();
    return { left: r.left, right: r.right, vw: innerWidth, card: c.scrollWidth - c.clientWidth, dialog: d.scrollWidth - d.clientWidth };
  });
  expect(m.left).toBeGreaterThanOrEqual(0);
  expect(m.right).toBeLessThanOrEqual(m.vw + 1);
  expect(m.card).toBeLessThanOrEqual(1);
  expect(m.dialog).toBeLessThanOrEqual(1);
}

test.describe('Bulk Collect Cash', () => {
  test('search nazeer finds NAZEER when no fees set; manual amount; Enter adds and returns to search', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/#/bulk-collect');
    const modal = page.locator('#bulkCollectModal');
    await expect(modal).toBeVisible();
    // Nobody is pending: show every customer, never an empty list.
    await expect(modal.locator('.bc-list-caption')).toContainText('No pending dues — showing all customers');
    expect(await modal.locator('.bc-row').count()).toBeGreaterThan(10);
    // The old top "Amount 0" form + disabled Add are gone.
    await expect(page.locator('#bulkCollectAmount')).toHaveCount(0);
    await expect(page.locator('#bulkCollectAddBtn')).toHaveCount(0);

    const search = page.locator('#bulkCollectSearch');
    await search.click();
    await search.pressSequentially('nazeer');
    const rows = modal.locator('.bc-row');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('NAZEER');
    await expect(rows.first()).toContainText('#1');
    await expect(rows.first().locator('.bc-badge-nobill')).toHaveText('No bill set');
    const id = await rows.first().getAttribute('data-bulk-row');
    await expect(amountOf(page, id)).toHaveValue('');
    await expect(amountOf(page, id)).toHaveAttribute('placeholder', 'Enter amount');
    // Partial / case-insensitive / customer # also find him.
    for (const q of ['NaZ', 'azee', '#1']) {
      await search.fill(q);
      await expect(modal.locator(`.bc-row[data-bulk-row="${id}"]`)).toHaveCount(1);
    }
    await search.fill('nazeer');

    // No due: Add without an amount explains instead of silently doing nothing.
    await addBtnOf(page, id).click();
    await expect(page.locator('#bulkCollectStatus')).toHaveAttribute('data-kind', 'error');
    await expect(page.locator('#bulkCollectStatus')).toContainText('amount');

    // Enter in the search jumps to the amount; Enter again adds.
    await search.focus();
    await search.press('Enter');
    await expect(amountOf(page, id)).toBeFocused();
    await page.keyboard.type('500');
    await page.keyboard.press('Enter');
    await expect(search).toHaveValue('');
    await expect(search).toBeFocused();
    await expect(modal.locator(`.bc-row[data-bulk-row="${id}"]`)).toHaveCount(0);
    const item = page.locator('#bulkCollectReviewList .bc-review-item').first();
    await expect(item.locator('.bc-review-name')).toHaveText('NAZEER');
    await expect(item).toContainText('PKR 500');
    await expect(item).toContainText('Cash');
    await expect(item.locator('[data-bulk-remove]')).toBeVisible();
    await expect(page.locator('#bulkCollectTotal')).toHaveText('PKR 500');
    await expectFitsAndNoOverflow(page);

    await page.locator('#bulkCollectSaveBtn').click();
    await expect(page.locator('#bulkCollectStatus')).toContainText('1 payment');
    const paid = await page.evaluate(async id => {
      const core = await import('./core.js');
      const s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
      return s.customers.find(c => c.id === id).bills.flatMap(b => b.payments).reduce((t, p) => t + Number(p.amount), 0);
    }, id);
    expect(paid).toBe(500);
    expect(errors).toEqual([]);
  });

  test('batch: pending first with due prefilled, keyboard entry, any customer by search, duplicate popup, remove/undo, save', async ({ page }) => {
    const errors = trackErrors(page);
    await seedBills(page);
    const ids = await page.evaluate(async () => {
      const core = await import('./core.js');
      const s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
      return s.customers.filter(c => !c.archived).slice(0, 5).map(c => ({ id: c.id, name: c.name }));
    });
    await openQuickCollect(page);
    await page.locator('#openBulkCollectBtn').click();
    const modal = page.locator('#bulkCollectModal');
    await expect(modal).toBeVisible();
    await expect(page).toHaveURL(/#\/bulk-collect$/);
    const today = await page.evaluate(() => new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10));
    await expect(page.locator('#bulkCollectDate')).toHaveValue(today);
    await expect(page.locator('#bulkCollectMethod')).toHaveValue('Cash');
    const search = page.locator('#bulkCollectSearch');
    await expect(search).toBeFocused();

    // Empty search = pending list, highest due first, due prefilled in each row.
    const rows = modal.locator('.bc-row');
    await expect(modal.locator('.bc-list-caption')).toContainText('Pending customers (4)');
    await expect(rows).toHaveCount(4);
    await expect(rows.first()).toHaveAttribute('data-bulk-row', ids[3].id);
    await expect(rows.first().locator('.bc-badge-due')).toHaveText('Due PKR 3,000');
    await expect(amountOf(page, ids[3].id)).toHaveValue('3000');
    // Big tap targets.
    for (const el of [amountOf(page, ids[3].id), addBtnOf(page, ids[3].id), search]) {
      const b = await el.boundingBox();
      expect(b.height).toBeGreaterThanOrEqual(44);
    }

    // 1) Edit the prefilled amount, Enter adds; the row disappears, search cleared + focused.
    await page.locator('#bulkCollectNote').fill('Saad · Jia Musa round');
    await amountOf(page, ids[3].id).fill('2800');
    await amountOf(page, ids[3].id).press('Enter');
    await expect(rows).toHaveCount(3);
    await expect(search).toBeFocused();
    await expect(page.locator('#bulkCollectTotal')).toHaveText('PKR 2,800');

    // 2) A customer with no bill: found by search, marked "No bill set", amount typed by hand.
    await search.pressSequentially(ids[4].name.toLowerCase().slice(1, 5));
    await expect(modal.locator(`.bc-row[data-bulk-row="${ids[4].id}"] .bc-badge-nobill`)).toHaveText('No bill set');
    await amountOf(page, ids[4].id).fill('600');
    await page.keyboard.press('Enter');
    await expect(search).toHaveValue('');
    await expect(search).toBeFocused();

    // 3) Pure keyboard: Enter in the empty search -> first pending amount (2,500 prefilled) -> Enter adds.
    await search.press('Enter');
    await expect(amountOf(page, ids[2].id)).toBeFocused();
    await expect(amountOf(page, ids[2].id)).toHaveValue('2500');
    await page.keyboard.press('Enter');
    await expect(page.locator('#bulkCollectCount')).toHaveText('3 customers');
    await expect(page.locator('#bulkCollectTotal')).toHaveText('PKR 5,900');

    // 4) Duplicate in this batch: search them again -> flagged row -> Add -> "Already added" popup.
    await search.fill(ids[3].name);
    const again = modal.locator(`.bc-row.is-in-batch[data-bulk-row="${ids[3].id}"]`);
    await expect(again.locator('.bc-badge-added')).toBeVisible();
    await addBtnOf(page, ids[3].id).click();
    const dup = page.locator('#bulkDuplicateDialog');
    await expect(dup).toBeVisible();
    await expect(dup.getByText('Already added')).toBeVisible();
    await expect(page.locator('#bulkDuplicateName')).toHaveText(ids[3].name);
    await expect(page.locator('#bulkDuplicateArea')).not.toBeEmpty();
    await expect(page.locator('#bulkDuplicateMobile')).not.toBeEmpty();
    await expect(page.locator('#bulkDuplicateAmount')).toHaveText('PKR 2,800');
    await page.locator('#bulkDuplicateCancelBtn').click();
    await expect(dup).toBeHidden();
    await expect(page.locator('#bulkCollectCount')).toHaveText('3 customers');
    await search.fill('');

    // 5) Already paid today -> "recorded" duplicate popup; confirm adds it.
    await addBtnOf(page, ids[1].id).click();
    await expect(dup).toBeVisible();
    await expect(dup).toContainText('already has a payment recorded');
    await page.locator('#bulkDuplicateConfirmBtn').click();
    await expect(page.locator('#bulkCollectCount')).toHaveText('4 customers');
    await expect(search).toBeFocused();
    await addBtnOf(page, ids[0].id).click();
    await expect(page.locator('#bulkCollectCount')).toHaveText('5 customers');
    await expect(page.locator('#bulkCollectTotal')).toHaveText('PKR 8,900');
    // Everyone pending is in: the list still shows the other customers, never empty.
    await expect(modal.locator('.bc-list-caption')).toContainText('All pending customers are in the batch');
    expect(await rows.count()).toBeGreaterThan(0);

    // The batch list sits above Save and is on screen with name, amount, method, Remove.
    const reviewBox = await page.locator('.bc-review').boundingBox();
    const saveBox = await page.locator('#bulkCollectSaveBtn').boundingBox();
    const vp = page.viewportSize();
    expect(reviewBox.y + reviewBox.height).toBeLessThanOrEqual(saveBox.y + 1);
    expect(reviewBox.y).toBeLessThan(vp.height);
    expect(saveBox.y + saveBox.height).toBeLessThanOrEqual(vp.height + 1);
    const newest = page.locator('#bulkCollectReviewList .bc-review-item').first();
    await expect(newest.locator('.bc-review-name')).toHaveText(ids[0].name);
    await expect(newest).toContainText('PKR 1,500');
    await expect(newest).toContainText('Cash');
    await expectFitsAndNoOverflow(page);

    // Remove + undo.
    await newest.locator('[data-bulk-remove]').click();
    await expect(page.locator('#bulkCollectCount')).toHaveText('4 customers');
    await expect(page.locator('#bulkCollectTotal')).toHaveText('PKR 7,400');
    await page.locator('#bulkCollectUndoBtn').click();
    await expect(page.locator('#bulkCollectCount')).toHaveText('5 customers');
    await expect(page.locator('#bulkCollectTotal')).toHaveText('PKR 8,900');

    // Save: every entry goes through the existing payment path and persists.
    await page.locator('#bulkCollectSaveBtn').click();
    await expect(page.locator('#bulkCollectStatus')).toContainText('5 payments saved · PKR 8,900');
    await expect(page.locator('#bulkCollectCount')).toHaveText('0 customers');
    const saved = await page.evaluate(async () => {
      const core = await import('./core.js');
      const s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
      return s.customers.flatMap(c => c.bills.flatMap(b => b.payments)).filter(p => p.paidBy === 'Saad · Jia Musa round').length;
    });
    expect(saved).toBe(5);
    // Only the 2,800-of-3,000 customer still owes.
    await expect(modal.locator('.bc-list-caption')).toContainText('Pending customers (1)');
    await expect(rows.first().locator('.bc-badge-due')).toHaveText('Due PKR 200');
    // Paid customers are still findable, marked Paid.
    await search.fill(ids[2].name);
    await expect(modal.locator(`.bc-row[data-bulk-row="${ids[2].id}"] .bc-badge-paid`)).toHaveText('Paid');

    await page.locator('#closeBulkCollectBtn').click();
    await expect(modal).toBeHidden();
    await expect(page).not.toHaveURL(/bulk-collect/);
    await page.evaluate(() => window.quickCollectModalController.open());
    await expect(page.locator('#quickCollectModal')).toBeVisible();
    await expect(page.locator('#quickCollectDuesCount')).toHaveText('1');
    expect(errors).toEqual([]);
  });

  test('dark theme keeps the bulk rows, badges and batch list readable', async ({ page }) => {
    const errors = trackErrors(page);
    await seedBills(page);
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await page.goto('/#/bulk-collect');
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await expect(page.locator('#bulkCollectModal')).toBeVisible();
    await page.locator('.bc-row [data-bulk-add]').first().click();
    const ratios = await page.evaluate(() => {
      const rgb = s => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      const lum = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; const a = c.match(/[\d.]+/g); if (a && (a.length < 4 || Number(a[3]) > 0.5)) return rgb(c); } return [255, 255, 255]; };
      const ratio = sel => { const el = document.querySelector(sel); const a = lum(rgb(getComputedStyle(el).color)), b = lum(bgOf(el)); return Number(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2)); };
      return Object.fromEntries(['.bc-row-name', '.bc-row-meta', '.bc-badge-due', '.bc-amount', '#bulkCollectSearch', '.bc-review-name', '.bc-review-meta', '#bulkCollectTotal'].map(s => [s, ratio(s)]));
    });
    for (const [sel, r] of Object.entries(ratios)) expect(r, `${sel} contrast ${r}`).toBeGreaterThanOrEqual(4.5);
    await expectFitsAndNoOverflow(page);
    expect(errors).toEqual([]);
  });

  test('#/bulk-collect deep link opens the batch screen; Back closes it', async ({ page }) => {
    const errors = trackErrors(page);
    await seedBills(page);
    await page.goto('/#/customers');
    await page.goto('/#/bulk-collect');
    const modal = page.locator('#bulkCollectModal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.bc-row')).toHaveCount(4);
    await expectFitsAndNoOverflow(page);
    await page.goBack();
    await expect(modal).toBeHidden();
    expect(errors).toEqual([]);
  });
});
