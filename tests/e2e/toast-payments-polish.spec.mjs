// Follow-up polish: toast placement over dialogs (#296), typed toasts (#297), compact payments list with
// delete Undo (#298), Customer section remainder (#293), in-app confirm for expenses / inventory / attendance.
import { test, expect } from '@playwright/test';

function track(page) {
  const errors = [];
  const native = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) errors.push(m.text()); });
  page.on('dialog', async d => { native.push(d.message()); await d.dismiss(); });
  return { errors, native };
}

async function customerIds(page, n) {
  await page.goto('/#/customers');
  await expect(page.locator('#customerList [data-customer-id]').first()).toBeVisible();
  return page.evaluate(n => window.quickCollectModalController.getState().customers.slice(0, n).map(c => c.id), n);
}

async function collect(page, id, amount, method = 'Cash') {
  await page.evaluate(id => window.quickCollectModalController.open(id), id);
  await expect(page.locator('#quickCollectModal')).toBeVisible();
  await page.locator(`.quick-method-chip[data-method="${method}"]`).click();
  await page.locator('#quickCollectAmountInput').fill(String(amount));
  if (method !== 'Cash') await page.locator('#quickCollectTransactionIdInput').fill(`T-${amount}-${Math.random().toString(36).slice(2, 7)}`);
  await page.locator('#quickCollectConfirmBtn').click();
  await expect(page.locator('#quickCollectUndoBtn')).toBeVisible();
}

const overlaps = (a, b) => !(a.y + a.height <= b.y || b.y + b.height <= a.y || a.x + a.width <= b.x || b.x + b.width <= a.x);

test.describe('Toast placement, toast types, payments list and customer polish', () => {
  test('#296: Transaction ID error stays inline and Confirm is still the top element and clickable', async ({ page }) => {
    const { errors, native } = track(page);
    const [id] = await customerIds(page, 1);
    await page.evaluate(id => window.quickCollectModalController.open(id), id);
    await page.locator('.quick-method-chip[data-method="JazzCash"]').click();
    await page.locator('#quickCollectAmountInput').fill('700');
    await page.locator('#quickCollectConfirmBtn').click();
    await expect(page.locator('#quickCollectTxnError')).toBeVisible();
    const onTop = await page.evaluate(() => {
      const b = document.getElementById('quickCollectConfirmBtn').getBoundingClientRect();
      return Boolean(document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)?.closest('#quickCollectConfirmBtn'));
    });
    expect(onTop).toBe(true);
    await page.locator('#quickCollectConfirmBtn').click({ trial: true, timeout: 1000 });
    await page.locator('#quickCollectTransactionIdInput').fill('TXN-296');
    await page.locator('#quickCollectConfirmBtn').click({ timeout: 2000 });
    await expect(page.locator('#quickCollectUndoBtn')).toBeVisible();
    expect(native).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('#296/#297: no-phone WhatsApp is a warning toast at the top, never over Undo / Print / Done, with "Add phone"', async ({ page }) => {
    const { errors } = track(page);
    const [id] = await customerIds(page, 1);
    await collect(page, id, 1000);
    await page.locator('#quickCollectWhatsAppBtn').click();
    const toast = page.locator('#toast');
    await expect(toast).toBeVisible();
    await expect(toast).toHaveAttribute('data-type', 'warning');
    await expect(toast.locator('.tsx-title')).toHaveText('No phone number');
    await expect(page.locator('#toastStack')).toHaveClass(/tsx-in-dialog/);
    expect(await page.locator('#toastStack .tsx-old').count()).toBe(0);
    const tb = await toast.boundingBox();
    for (const sel of ['#quickCollectUndoBtn', '#quickCollectPrintReceiptBtn', '#quickCollectDoneCloseBtn', '#quickCollectWhatsAppBtn']) {
      const el = page.locator(sel);
      if (!(await el.isVisible())) continue;
      expect(overlaps(tb, await el.boundingBox()), `${sel} is not covered`).toBe(false);
    }
    await toast.locator('.toast-action-btn', { hasText: 'Add phone' }).click();
    await expect(page.locator('#quickCollectModal')).toBeHidden();
    await expect(page.locator('#phoneInput')).toBeVisible();
    await expect(page.locator('#phoneInput')).toBeFocused();
    expect(errors).toEqual([]);
  });

  test('a toast already showing moves above a dialog that opens', async ({ page }) => {
    const { errors } = track(page);
    await page.goto('/#/customers');
    await page.evaluate(() => window.toast('Customer profile saved on this device.', { type: 'success' }));
    await expect(page.locator('#toast')).toBeVisible();
    await page.locator('#srPrimaryAction').click();
    await expect(page.locator('#addCustomerDialog')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.getElementById('toastStack').parentElement?.id)).toBe('addCustomerDialog');
    const top = await page.evaluate(() => {
      const r = document.getElementById('toast').getBoundingClientRect();
      return Boolean(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('#toast'));
    });
    expect(top).toBe(true);
    expect(errors).toEqual([]);
  });

  test('#298: compact payment rows grouped by day; tap to expand; delete asks a reason and can be undone', async ({ page }) => {
    const { errors, native } = track(page);
    const ids = await customerIds(page, 9);
    const amounts = [1000, 1500, 800, 1200, 900, 1100, 1300, 700, 600];
    for (let i = 0; i < ids.length; i++) {
      await collect(page, ids[i], amounts[i], i === 1 ? 'JazzCash' : 'Cash');
      await page.locator('#quickCollectDoneCloseBtn').click();
      await expect(page.locator('#quickCollectModal')).toBeHidden();
    }
    await page.goto('/#/transactions');
    const rows = page.locator('#transactionsList > .transaction-card');
    await expect(rows).toHaveCount(9);
    await expect(page.locator('#transactionsList > .tx-day-header').first()).toHaveText(/^Today · 9 payments · PKR 9,100 \(Cash 7,600, JazzCash 1,500\)$/);
    const vp = page.viewportSize();
    const heights = await rows.evaluateAll(els => els.map(e => e.getBoundingClientRect().height));
    for (const h of heights) expect(h).toBeLessThanOrEqual(72);
    // At least 8 payments fit in one phone screen of the list.
    const listTop = await page.locator('#transactionsList').evaluate(el => el.getBoundingClientRect().top + window.scrollY);
    const navH = vp.width < 900 ? 64 : 0;
    const fit = await rows.evaluateAll((els, { listTop, h }) => els.filter(e => { const r = e.getBoundingClientRect(); return r.bottom + window.scrollY - listTop <= h; }).length, { listTop, h: vp.height - navH });
    expect(fit).toBeGreaterThanOrEqual(8);
    // No "Manual service: Not set" noise, details hidden until tapped.
    const first = rows.first();
    await expect(first.locator('.tx-details')).toBeHidden();
    await expect(first.locator('.tx-method-chip')).toBeVisible();
    await first.locator('.tx-row').click();
    await expect(first.locator('.tx-row')).toHaveAttribute('aria-expanded', 'true');
    await expect(first.locator('[data-print-receipt]')).toBeVisible();
    await expect(first.locator('.transaction-context')).not.toContainText('Manual service: Not set');
    await expect(first.locator('.transaction-actions')).toContainText('WhatsApp receipt');
    await expect(first.locator('.transaction-actions')).not.toContainText('Add WhatsApp number');
    const name = (await first.locator('.transaction-customer').textContent()).trim();
    await first.locator('[data-transaction-delete]').click();
    const dlg = page.locator('#appConfirmDialog');
    await expect(dlg).toBeVisible();
    await expect(page.locator('#appConfirmInput')).toBeVisible();
    await page.locator('#appConfirmInput').fill('entered twice');
    await page.locator('#appConfirmOkBtn').click();
    await expect(rows).toHaveCount(8);
    const toast = page.locator('#toast');
    await expect(toast.locator('.tsx-title')).toHaveText('Payment deleted');
    const log = await page.evaluate(() => JSON.parse(localStorage.getItem('shahdara_payment_deletion_log') || '[]'));
    expect(log.at(-1).reason).toBe('entered twice');
    await toast.locator('.toast-action-btn', { hasText: 'Undo' }).click();
    await expect(rows).toHaveCount(9);
    await expect(page.locator('#transactionsList')).toContainText(name.replace(/^#\d+/, '').trim());
    const log2 = await page.evaluate(() => JSON.parse(localStorage.getItem('shahdara_payment_deletion_log') || '[]'));
    expect(log2.at(-1).undone).toBe(true);
    expect(native).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('#293: no floating + on Customers, new customers default to Active, sticky submit, bill summary above the fold', async ({ page }) => {
    const { errors, native } = track(page);
    await page.goto('/#/customers');
    await expect(page.locator('#customerList [data-customer-id]').first()).toBeVisible();
    await expect(page.locator('#speedDialTrigger')).toBeHidden();
    await page.locator('#srPrimaryAction').click();
    const dlg = page.locator('#addCustomerDialog');
    await expect(dlg).toBeVisible();
    await expect(page.locator('#newCustomerServiceStatus')).toHaveValue('active');
    const vp = page.viewportSize();
    const submit = page.locator('#addCustomerSubmit');
    await expect(submit).toBeInViewport();
    let sb = await submit.boundingBox();
    expect(sb.y + sb.height).toBeLessThanOrEqual(vp.height);
    await page.locator('#newCustomerName').fill('POLISH TEST CUSTOMER');
    await page.locator('#newCustomerName').focus();
    await expect(submit).toBeInViewport();
    await submit.click();
    await expect(dlg).toBeHidden();
    await expect(page.locator('#detailName')).toHaveText('POLISH TEST CUSTOMER');
    const status = await page.evaluate(() => window.quickCollectModalController.getState().customers.at(-1).serviceStatus);
    expect(status).toBe('active');
    await expect(page.locator('#profileServiceStatusBadge')).toContainText(/Active/);
    const bill = page.locator('#customerCurrentBillSummary');
    const bb = await bill.boundingBox();
    expect(bb.y).toBeLessThan(vp.height * 0.6);
    // Existing customers keep their saved status.
    const first = await page.evaluate(() => window.quickCollectModalController.getState().customers[0].serviceStatus);
    expect(first).toBe('not-set');
    expect(native).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('expenses use the in-app confirm for delete and correction', async ({ page }) => {
    const { errors, native } = track(page);
    await page.goto('/#/expenses');
    await page.locator('#expenseAmount').fill('2500');
    await page.locator('#expenseCategory').selectOption({ index: 2 });
    if (!(await page.locator('#expenseDate').inputValue())) await page.locator('#expenseDate').fill('2026-10-01');
    await page.locator('#expenseForm [type="submit"]').first().click();
    const del = page.locator('#expenseTable [data-delete-expense]').first();
    await expect(del).toBeVisible();
    await del.click();
    await expect(page.locator('#appConfirmDialog')).toBeVisible();
    await expect(page.locator('#appConfirmTitle')).toHaveText('Delete this expense?');
    await page.locator('#appConfirmCancelBtn').click();
    await expect(page.locator('#expenseTable [data-delete-expense]')).toHaveCount(1);
    await del.click();
    await page.locator('#appConfirmOkBtn').click();
    await expect(page.locator('#expenseTable [data-delete-expense]')).toHaveCount(0);
    expect(native).toEqual([]);
    expect(errors).toEqual([]);
  });
});
