// #300 "+ Add Payment" always opens Quick Collect; #301 every profile action opens its dialog (Dispute threw);
// #302 desktop profile action grid never clips; #303 payments-list polish (totals bar, dark details, scoped Undo toast).
// Plan 492: #301/#302 open the "More actions" disclosure first — the 12 actions moved behind it (Archive left
// for Row 1 in the Profile Archive Button Visibility item), and the QA tools (which also carry
// aria-haspopup="dialog") must not be swept into #301's enumeration.
import { test, expect } from '@playwright/test';
import { installSyntheticRoster } from './seed-roster.mjs';

function track(page) {
  const errors = [];
  const native = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) errors.push(m.text()); });
  page.on('dialog', async d => { native.push(d.message()); await d.dismiss(); });
  return { errors, native };
}

async function openCustomer(page, index = 1) {
  await page.goto('/#/customers');
  const row = page.locator('#customerList [data-customer-id]').nth(index);
  const name = (await row.locator('.customer-name').first().textContent()).trim();
  await row.click();
  await expect(page.locator('#detailName')).toHaveText(name);
  return name;
}

async function collect(page, index, amount) {
  const id = await page.evaluate(i => window.quickCollectModalController.getState().customers[i].id, index);
  await page.evaluate(id => window.quickCollectModalController.open(id), id);
  await expect(page.locator('#quickCollectModal')).toBeVisible();
  await page.locator('.quick-method-chip[data-method="Cash"]').click();
  await page.locator('#quickCollectAmountInput').fill(String(amount));
  await page.locator('#quickCollectConfirmBtn').click();
  await expect(page.locator('#quickCollectUndoBtn')).toBeVisible();
}

const contrast = (fg, bg) => {
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const [a, b] = [lum(fg), lum(bg)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

test.describe('Profile + payments follow-up (#300 #301 #302 #303)', () => {
  test.beforeEach(async ({ page }) => {
    // Opens customer rows by index and records payments on them: needs
    // the roster the old built-in seed provided (PR #478 emptied it).
    await installSyntheticRoster(page);
  });

  test('#300: + Add Payment opens Quick Collect after a profile was opened (Transactions, Bills, Report, Home)', async ({ page }) => {
    const { errors, native } = track(page);
    await openCustomer(page, 1);
    for (const route of ['transactions', 'bills', 'reports']) {
      await page.goto(`/#/${route}`);
      const btn = page.locator('#srPrimaryAction');
      await expect(btn).toHaveText('+ Add Payment');
      await btn.click();
      await expect(page.locator('#quickCollectModal'), route).toBeVisible();
      expect(page.url(), route).not.toMatch(/#\/customers/);
      await page.keyboard.press('Escape');
      await expect(page.locator('#quickCollectModal')).toBeHidden();
    }
    // Home's dashboard button runs the same handler.
    await page.goto('/#/home');
    await page.evaluate(() => document.getElementById('quickAddPaymentButton').click());
    await expect(page.locator('#quickCollectModal')).toBeVisible();
    expect(page.url()).not.toMatch(/#\/customers/);
    expect(native).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('#301: every profile action button opens its dialog with no console error (incl. Dispute)', async ({ page }) => {
    const { errors, native } = track(page);
    await openCustomer(page, 1);
    // Plan 492: the 12 quick actions live behind the "More actions"
    // disclosure — open it first (a closed <details> hides its buttons),
    // and scope to the disclosure grid so the 29 QA tools (which also
    // carry aria-haspopup="dialog") are not swept in.
    await page.locator('#profileMoreActionsDetails').evaluate(el => { el.open = true; });
    const ids = await page.locator('.profile-more-actions-grid button[aria-haspopup="dialog"]').evaluateAll(els => els.filter(e => !e.hidden).map(e => e.id));
    expect(ids).toContain('openDisputeClaimBtn');
    for (const id of ids) {
      await page.locator(`#${id}`).scrollIntoViewIfNeeded();
      await page.locator(`#${id}`).click();
      await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('dialog[open]')].length), { message: id }).toBeGreaterThan(0);
      if (id === 'openDisputeClaimBtn') await expect(page.locator('#customerDisputeModal')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('dialog[open]')].length), { message: `${id} closes` }).toBe(0);
    }
    expect(native).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('#302: profile actions never clip at 1024 / 1280 / 1440; Record payment shares its row with Archive, half-width at 360px', async ({ page }) => {
    const { errors } = track(page);
    for (const width of [1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await openCustomer(page, 1);
      // Profile Archive Button Visibility (user report 2026-11-13):
      // Archive left More Actions > Payments for Row 1 beside Record
      // payment, and Record payment no longer spans the full row —
      // so the grid-measure below now also checks the two buttons
      // share one row, with Record well under the full row width.
      await page.locator('#profileMoreActionsDetails').evaluate(el => { el.open = true; });
      const r = await page.evaluate(() => {
        const g = document.querySelector('.profile-more-actions-grid');
        const buttons = [...g.querySelectorAll('button')].filter(b => !b.hidden);
        const clipped = buttons.filter(b => b.scrollWidth > b.clientWidth + 1 || b.getBoundingClientRect().width < 100).map(b => b.id);
        const rects = buttons.map(b => b.getBoundingClientRect());
        let overlaps = 0;
        for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i], b = rects[j];
          if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) overlaps++;
        }
        const group = document.querySelector('.profile-action-group').getBoundingClientRect();
        const primary = document.getElementById('currentBillPaymentShortcut').getBoundingClientRect();
        const archive = document.getElementById('archiveCustomerButton').getBoundingClientRect();
        const name = document.getElementById('detailName').getBoundingClientRect();
        return {
          clipped, overlaps,
          ratio: primary.width / group.width,
          archiveSameRow: Math.abs(archive.top - primary.top) < 1,
          archiveBeside: archive.left >= primary.right - 1,
          archiveOverlap: archive.left < primary.right - 1 && primary.left < archive.right - 1 && archive.top < primary.bottom - 1 && primary.top < archive.bottom - 1,
          nameLines: Math.round(name.height / parseFloat(getComputedStyle(document.getElementById('detailName')).lineHeight)),
        };
      });
      expect(r.clipped, `${width}`).toEqual([]);
      expect(r.overlaps, `${width}`).toBe(0);
      expect(r.ratio, `${width} Record no longer spans the row`).toBeLessThan(0.6);
      expect(r.archiveSameRow, `${width} Archive shares Record's row`).toBe(true);
      expect(r.archiveBeside, `${width} Archive sits beside Record`).toBe(true);
      expect(r.archiveOverlap, `${width} Archive does not overlap Record`).toBe(false);
      expect(r.nameLines, `${width} name`).toBeLessThanOrEqual(2);
    }
    // Half-width pin: at 360px the action group is two equal columns,
    // so Record payment takes about half the row next to Archive.
    await page.setViewportSize({ width: 360, height: 800 });
    await openCustomer(page, 1);
    const phone = await page.evaluate(() => {
      const group = document.querySelector('.profile-action-group').getBoundingClientRect();
      const primary = document.getElementById('currentBillPaymentShortcut').getBoundingClientRect();
      const archive = document.getElementById('archiveCustomerButton').getBoundingClientRect();
      return {
        ratio: primary.width / group.width,
        archiveSameRow: Math.abs(archive.top - primary.top) < 1,
        archiveBeside: archive.left >= primary.right - 1,
      };
    });
    expect(phone.ratio, '360px Record is about half the row').toBeGreaterThan(0.4);
    expect(phone.ratio, '360px Record is about half the row').toBeLessThan(0.6);
    expect(phone.archiveSameRow, '360px Archive shares Record's row').toBe(true);
    expect(phone.archiveBeside, '360px Archive sits beside Record').toBe(true);
    expect(errors).toEqual([]);
  });

  test('#303: totals bar fits at 360 and 390 px; dark expanded details are readable', async ({ page }) => {
    const { errors } = track(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/customers');
    await expect(page.locator('#customerList [data-customer-id]').first()).toBeVisible();
    await collect(page, 1, 1000);
    await page.locator('#quickCollectDoneCloseBtn').click();
    await collect(page, 2, 1000);
    await page.locator('#quickCollectDoneCloseBtn').click();
    for (const width of [360, 390]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/#/transactions');
      await expect(page.locator('#transactionsList > .transaction-card')).toHaveCount(2);
      const bar = await page.locator('#transactionSummaryBar').evaluate(el => ({ sw: el.scrollWidth, cw: el.clientWidth, right: Math.max(...[...el.querySelectorAll('.tx-summary-item')].map(k => k.getBoundingClientRect().right)), barRight: el.getBoundingClientRect().right }));
      expect(bar.sw, `${width}`).toBeLessThanOrEqual(bar.cw + 1);
      expect(bar.right, `${width}`).toBeLessThanOrEqual(bar.barRight + 1);
      expect(bar.right, `${width}`).toBeLessThanOrEqual(width);
    }
    await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark'); document.body.setAttribute('data-theme', 'dark'); });
    const card = page.locator('#transactionsList > .transaction-card').first();
    await card.locator('.tx-row').click();
    await expect(card.locator('.tx-details')).toBeVisible();
    const samples = await card.locator('.tx-details').evaluate(det => {
      const parse = c => (c.match(/[\d.]+/g) || []).map(Number);
      const bgOf = el => { while (el) { const a = parse(getComputedStyle(el).backgroundColor); if (a.length === 3 || (a.length === 4 && a[3] > 0.5)) return a.slice(0, 3); el = el.parentElement; } return [255, 255, 255]; };
      return [...det.querySelectorAll('.transaction-meta, .transaction-context, .payment-allocation, .receipt-phone-help, .receipt-whatsapp-action')]
        .filter(el => el.getClientRects().length)
        .map(el => ({ cls: el.className, fg: parse(getComputedStyle(el).color).slice(0, 3), bg: bgOf(el) }));
    });
    expect(samples.length).toBeGreaterThanOrEqual(3);
    for (const s of samples) {
      expect(contrast(s.fg, s.bg), s.cls).toBeGreaterThanOrEqual(4.5);
      const bgLum = (s.bg[0] * 299 + s.bg[1] * 587 + s.bg[2] * 114) / 1000;
      expect(bgLum, `${s.cls} has a dark surface`).toBeLessThan(110);
    }
    expect(errors).toEqual([]);
  });

  test('#303: the Quick Collect Undo toast closes with its sheet and never moves into the Delete-payment dialog', async ({ page }) => {
    const { errors, native } = track(page);
    await page.goto('/#/customers');
    await expect(page.locator('#customerList [data-customer-id]').first()).toBeVisible();
    await collect(page, 1, 1000);
    await page.locator('#quickCollectDoneCloseBtn').click();
    await collect(page, 2, 1500);
    const toast = page.locator('#toast');
    await expect(toast.locator('.tsx-title')).toHaveText('Payment recorded');
    await page.locator('#quickCollectDoneCloseBtn').click();
    await expect(page.locator('#quickCollectModal')).toBeHidden();
    await expect(toast).toBeHidden();
    await page.goto('/#/transactions');
    const card = page.locator('#transactionsList > .transaction-card').nth(1);
    await card.locator('.tx-row').click();
    await card.locator('[data-transaction-delete]').click();
    await expect(page.locator('#appConfirmDialog')).toBeVisible();
    await expect(page.locator('#appConfirmDialog .toast-action-btn')).toHaveCount(0);
    await expect(page.locator('.tsx:not([hidden]) .toast-action-btn', { hasText: 'Undo' })).toHaveCount(0);
    await page.locator('#appConfirmCancelBtn').click();
    await expect(page.locator('#appConfirmDialog')).toBeHidden();
    await expect(page.locator('#transactionsList > .transaction-card')).toHaveCount(2);
    // A plain (no-action) toast still follows into a dialog that opens (#292 behaviour kept).
    await page.evaluate(() => window.toast('Saved on this device.', { type: 'success' }));
    await card.locator('[data-transaction-delete]').click();
    await expect.poll(() => page.evaluate(() => document.getElementById('toastStack').parentElement?.id)).toBe('appConfirmDialog');
    expect(native).toEqual([]);
    expect(errors).toEqual([]);
  });
});
