// Customer + payment polish: action buttons, in-app delete confirm with undo, one toast system,
// payment form validation/feedback, and dark-mode contrast on the profile (#288).
import { test, expect } from '@playwright/test';

function track(page) {
  const errors = [];
  const native = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) errors.push(m.text()); });
  page.on('dialog', async d => { native.push(d.message()); await d.dismiss(); });
  return { errors, native };
}

async function openFirstCustomer(page) {
  await page.goto('/#/customers');
  const first = page.locator('#customerList [data-customer-id]').first();
  const name = (await first.locator('.customer-name').first().textContent()).trim();
  await first.click();
  await expect(page.locator('#detailName')).toHaveText(name);
  return name;
}

test.describe('Customer & payment polish', () => {
  test('profile actions: 48px targets, icons, Save only after a change, typed success toast', async ({ page }) => {
    const { errors, native } = track(page);
    await openFirstCustomer(page);
    await page.locator('#profileTabInfo').click();
    for (const id of ['#editProfileButton', '#archiveCustomerButton', '#deleteCustomerButton']) {
      const box = await page.locator(id).boundingBox();
      expect(box.height, id).toBeGreaterThanOrEqual(48);
    }
    await expect(page.locator('#deleteCustomerButton')).toHaveText(/Delete customer/);
    await expect(page.locator('#deleteCustomerButton')).toHaveCSS('color', 'rgb(179, 38, 30)');
    await page.locator('#editProfileButton').click();
    const save = page.locator('#saveMohallaButton');
    await expect(save).toBeDisabled();
    await expect(page.locator('#profileSaveHint')).toHaveText('No changes yet');
    await page.locator('#mohallaInput').fill('Jia Musa');
    await expect(save).toBeEnabled();
    await expect(page.locator('#profileSaveHint')).toHaveText('Unsaved changes');
    await save.click();
    const toast = page.locator('#toast');
    await expect(toast).toBeVisible();
    await expect(toast).toHaveAttribute('data-type', 'success');
    await expect(toast).toHaveAttribute('aria-live', 'polite');
    await expect(toast.locator('.tsx-title')).toHaveText('Saved');
    await expect(toast.locator('.tsx-icon')).toHaveText('✓');
    await expect(toast.locator('.tsx-progress')).toHaveCount(1);
    await expect(page.locator('#customerProfileView')).toContainText('Jia Musa');
    // Toast sits above the bottom nav and inside the screen.
    const tb = await toast.boundingBox();
    const vp = page.viewportSize();
    expect(tb.x).toBeGreaterThanOrEqual(0);
    expect(tb.x + tb.width).toBeLessThanOrEqual(vp.width);
    expect(tb.y + tb.height).toBeLessThanOrEqual(vp.height);
    expect(native).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('delete: in-app confirm with the customer name, Cancel keeps, Delete + Undo restores, Archive instead archives', async ({ page }) => {
    const { errors, native } = track(page);
    const name = await openFirstCustomer(page);
    const count = Number(await page.locator('#customerCount').textContent());
    await page.locator('#deleteCustomerButton').click();
    const dlg = page.locator('#appConfirmDialog');
    await expect(dlg).toBeVisible();
    await expect(page.locator('#appConfirmTitle')).toHaveText('Delete this customer?');
    await expect(page.locator('#appConfirmSubject')).toContainText(name);
    await expect(page.locator('#appConfirmCancelBtn')).toBeFocused();
    await expect(page.locator('#appConfirmCloseBtn')).toBeVisible();
    expect(await dlg.evaluate(d => d.scrollWidth - d.clientWidth)).toBeLessThanOrEqual(1);
    await page.locator('#appConfirmCancelBtn').click();
    await expect(dlg).toBeHidden();
    await expect(page.locator('#customerCount')).toHaveText(String(count));

    await page.locator('#deleteCustomerButton').click();
    await page.locator('#appConfirmOkBtn').click();
    await expect(page.locator('#customerCount')).toHaveText(String(count - 1));
    const toast = page.locator('#toast');
    await expect(toast.locator('.tsx-title')).toContainText(`${name} deleted`);
    await toast.locator('.toast-action-btn', { hasText: 'Undo' }).click();
    await expect(page.locator('#customerCount')).toHaveText(String(count));
    await expect(toast).toContainText('restored with all bills and payments');
    await expect(page.locator('#detailName')).toHaveText(name);

    // Escape cancels; "Archive instead" archives with an Undo.
    await page.locator('#deleteCustomerButton').click();
    await page.keyboard.press('Escape');
    await expect(dlg).toBeHidden();
    await expect(page.locator('#customerCount')).toHaveText(String(count));
    await page.locator('#deleteCustomerButton').click();
    await page.locator('#appConfirmAltBtn').click();
    await expect(page.locator('#archiveStateBadge')).toContainText(/Archived/i);
    await expect(toast.locator('.toast-action-btn')).toHaveText('Undo');
    await toast.locator('.toast-action-btn').click();
    await expect(page.locator('#archiveStateBadge')).toContainText(/Active/i);
    expect(native).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('payment form: focus order, today prefilled, inline validation, success toast with Undo + Receipt', async ({ page }) => {
    const { errors, native } = track(page);
    await page.addInitScript(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
    await openFirstCustomer(page);
    const form = page.locator('#historyContainer .month-card').first().locator('form[data-kind="payment"]');
    await expect(form).toBeVisible();
    const order = await form.locator('input, select').evaluateAll(els => els.map(e => e.name).filter(Boolean));
    expect(order.slice(0, 2)).toEqual(['amount', 'method']);
    expect(order.indexOf('date')).toBeLessThan(order.indexOf('transactionId'));
    expect(order.indexOf('discount')).toBeGreaterThan(order.indexOf('transactionId'));
    await expect(form.locator('input[name="date"]')).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);

    await form.locator('button[type="submit"]').click();
    const amount = form.locator('input[name="amount"]');
    await expect(amount).toHaveAttribute('aria-invalid', 'true');
    await expect(form.locator('.pf-error').first()).toHaveText('Enter the amount received, e.g. 1500.');
    await expect(form.locator('.pf-error', { hasText: 'Choose how it was paid' })).toBeVisible();
    await expect(amount).toBeFocused();
    await amount.fill('700');
    await expect(amount).not.toHaveAttribute('aria-invalid', 'true');
    await form.locator('select[name="method"]').selectOption('Cash');
    await form.locator('button[type="submit"]').click();

    const toast = page.locator('#toast');
    await expect(toast.locator('.tsx-title')).toHaveText('Payment recorded');
    await expect(toast).toContainText('PKR 700');
    await expect(toast.locator('.toast-action-btn')).toHaveText(['Undo', 'Receipt']);
    await expect(page.locator('#historyContainer .payment-list li').first()).toContainText('700');
    await toast.locator('.toast-action-btn', { hasText: 'Undo' }).click();
    await expect(toast).toContainText('Payment undone');
    await expect(page.locator('#historyContainer .payment-list li')).toHaveCount(0);

    // Record again and open the receipt from the toast.
    const form2 = page.locator('#historyContainer .month-card').first().locator('form[data-kind="payment"]');
    await form2.locator('input[name="amount"]').fill('500');
    await form2.locator('select[name="method"]').selectOption('Cash');
    await form2.locator('button[type="submit"]').click();
    await page.locator('#toast .toast-action-btn', { hasText: 'Receipt' }).click();
    await page.waitForFunction(() => window.__printed >= 1);
    expect(native).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('toasts stack, errors are announced assertively, × dismisses', async ({ page }) => {
    const { errors } = track(page);
    await page.goto('/#/customers');
    await page.evaluate(() => { window.toast('Customer profile saved on this device.'); window.notify.error('Could not save. Check browser storage is available.', { title: 'Not saved' }); });
    await expect(page.locator('#toastStack > .tsx:not([hidden])')).toHaveCount(2);
    const toast = page.locator('#toast');
    await expect(toast).toHaveAttribute('role', 'alert');
    await expect(toast).toHaveAttribute('data-type', 'error');
    await expect(toast.locator('.tsx-title')).toHaveText('Not saved');
    await toast.locator('.tsx-close').click();
    await expect(toast).toBeHidden();
    await expect(page.locator('#toastStack > .tsx-old')).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('#288 dark mode: customer name, headings, labels and chips are readable on the profile', async ({ page }) => {
    const { errors } = track(page);
    await openFirstCustomer(page);
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await page.waitForTimeout(600); // let colour transitions finish
    const failures = await page.evaluate(() => {
      const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r, g, b, a }; };
      const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const blend = (t, u) => ({ r: t.r * t.a + u.r * (1 - t.a), g: t.g * t.a + u.g * (1 - t.a), b: t.b * t.a + u.b * (1 - t.a), a: 1 });
      const bgOf = el => { const layers = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; } } let o = { r: 255, g: 255, b: 255, a: 1 }; for (const l of layers.reverse()) o = blend(l, o); return o; };
      const ratio = el => { const cs = getComputedStyle(el); const bg = bgOf(el); const fg = blend(parse(cs.color), bg); const a = lum(fg), b = lum(bg); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
      const out = [];
      const root = document.getElementById('customerDetail') || document.querySelector('.detail-pane');
      for (const el of root.querySelectorAll('*')) {
        if (el.closest('svg') || !el.checkVisibility?.() || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
        const cs = getComputedStyle(el); const size = parseFloat(cs.fontSize); const large = size >= 24 || (Number(cs.fontWeight) >= 700 && size >= 18.66);
        const r = ratio(el); if (r < (large ? 3 : 4.5)) out.push(`${el.id || el.className || el.tagName} ${r.toFixed(2)} "${el.textContent.trim().slice(0, 30)}"`);
      }
      const name = ratio(document.getElementById('detailName'));
      const chips = ['profileServiceStatusBadge', 'archiveStateBadge'].map(id => getComputedStyle(document.getElementById(id)).backgroundColor);
      return { out, name, chips };
    });
    expect(failures.name).toBeGreaterThanOrEqual(4.5); // was 1.34:1
    expect(failures.chips.every(c => !/255, 255, 255|24[0-9], 24[0-9], 24[0-9]/.test(c))).toBe(true);
    expect(failures.out).toEqual([]);
    expect(errors).toEqual([]);
  });
  test('#292 toasts show above an open modal (Quick Collect) and the Transaction ID error is inline', async ({ page }) => {
    const { errors, native } = track(page);
    await openFirstCustomer(page);
    await page.locator('#currentBillPaymentShortcut').click();
    const qc = page.locator('#quickCollectModal');
    await expect(qc).toBeVisible();
    await page.locator('.quick-method-chip[data-method="JazzCash"]').click();
    await page.locator('#quickCollectAmountInput').fill('500').catch(() => {});
    await page.locator('#quickCollectConfirmBtn').click();
    await expect(page.locator('#quickCollectTxnError')).toHaveText(/Transaction ID or an override reason/);
    await expect(page.locator('#quickCollectTxnError')).toHaveAttribute('role', 'alert');
    // #296: the inline error replaces the toast for this case; check the toast layer with another message.
    await page.evaluate(() => window.toast('Receipt image creation is not supported in this environment.', { type: 'warning' }));
    const toast = page.locator('#toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('not supported');
    // The toast is the top element at its own centre (not hidden behind the sheet), and its × works.
    const onTop = await toast.evaluate(t => { const r = t.getBoundingClientRect(); return t.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)); });
    expect(onTop).toBe(true);
    await toast.locator('.tsx-close').click();
    await expect(toast).toBeHidden();
    await expect(qc).toBeVisible();
    expect(native).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('#294 profile "Record payment" opens Quick Collect on this customer; Back returns to the profile', async ({ page }) => {
    const { errors } = track(page);
    const name = await openFirstCustomer(page);
    const profileHash = await page.evaluate(() => location.hash);
    await page.locator('#currentBillPaymentShortcut').click();
    const qc = page.locator('#quickCollectModal');
    await expect(qc).toBeVisible();
    await expect(page.locator('#quickCollectCustomerHeader')).toContainText(name);
    await expect(page).toHaveURL(/#\/collect$/);
    await page.goBack();
    await expect(qc).toBeHidden();
    expect(await page.evaluate(() => location.hash)).toBe(profileHash);
    await expect(page.locator('#detailName')).toHaveText(name);
    // The ledger form stays for back-dated entries, now prefilled with today and Cash, no ".00".
    await page.locator('#backdatedPaymentButton').click();
    const form = page.locator('#historyContainer .month-card').first().locator('form[data-kind="payment"]');
    await expect(form.locator('select[name="method"]')).toHaveValue('Cash');
    await expect(form.locator('input[name="date"]')).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
    expect(errors).toEqual([]);
  });

  test('#293 compact customer rows, one Add Customer button, Delete in a separate danger zone', async ({ page }) => {
    const { errors } = track(page);
    await page.goto('/#/customers');
    const rows = page.locator('#customerList > li');
    for (let i = 0; i < 3; i++) {
      const box = await rows.nth(i).boundingBox();
      expect(box.height).toBeLessThanOrEqual(80);
    }
    await expect(page.locator('#addCustomerButton')).toBeHidden();
    await expect(page.locator('#srPrimaryAction')).toBeVisible();
    await expect(page.locator('#bulkAddCustomersBtn')).toBeVisible();
    await expect(page.locator('#openEnrollmentWizardBtn')).toBeVisible();
    // "+ Add Customer" in the screen header still opens the dialog.
    await page.locator('#srPrimaryAction').click();
    await expect(page.locator('#addCustomerDialog')).toBeVisible();
    await page.keyboard.press('Escape');
    // Details are one tap away and the choice sticks.
    await page.locator('#customerDensityToggle').click();
    await expect(rows.first().locator('.customer-card-stats')).toBeVisible();
    await page.reload();
    await expect(page.locator('#customerList > li').first().locator('.customer-card-stats')).toBeVisible();
    await page.locator('#customerDensityToggle').click();
    await expect(page.locator('#customerList > li').first().locator('.customer-card-stats')).toBeHidden();
    // Delete is away from Archive, in a danger zone below the bill summary.
    await page.locator('#customerList [data-customer-id]').first().click();
    const zone = page.locator('.profile-danger-zone');
    await expect(zone).toContainText('Danger zone');
    await expect(zone.locator('#deleteCustomerButton')).toBeVisible();
    const archive = await page.locator('#archiveCustomerButton').boundingBox();
    const del = await page.locator('#deleteCustomerButton').boundingBox();
    expect(del.y - (archive.y + archive.height)).toBeGreaterThan(60);
    expect(errors).toEqual([]);
  });
});
