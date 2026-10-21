/**
 * worklist-modal-scroll-366.spec.mjs
 * Issue #366: the Disconnection & Reconnection Worklists modal had two
 * nested scroll areas (.worklist-modal-body + .worklist-list capped at
 * 380px) and the header / dispatch graphic / toolbar / footer chrome left
 * room for only ~1 customer row at 390x844 (2 at 1280x800).
 *
 * These tests MEASURE the fixed layout with fees seeded (74 customers in
 * the disconnect list): the customer list must be the modal's ONE main
 * scroll area, at least 3 rows must be fully visible when the modal
 * opens, and every chrome element (header, tabs, dispatch graphic,
 * search, area filter, footer actions) must still be present.
 */
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

async function seedFees(page) {
  await page.evaluate(() => window.collectSetup?.open());
  await page.locator('#collectSetupSelectAll').check();
  await page.locator('#collectSetupApplyBtn').click();
  await page.waitForSelector('#collectSetupModal', { state: 'hidden', timeout: 20000 });
}

async function openWorklists(page) {
  await page.locator('#openWorklistsModalBtn').click();
  await expect(page.locator('#workListModal')).toBeVisible();
  await page.waitForSelector('#worklistDisconnectList .worklist-item', { state: 'visible', timeout: 20000 });
  await page.waitForTimeout(300);
}

// Count rows fully inside the effective clip (dialog ∩ body ∩ list box)
// and list every ancestor of the list that can actually scroll.
function measureLayout(page) {
  return page.evaluate(() => {
    const dialog = document.getElementById('workListModal');
    const body = document.querySelector('.worklist-modal-body');
    const list = document.getElementById('worklistDisconnectList');
    const clips = [dialog, body, list].map(el => el.getBoundingClientRect());
    const clipTop = Math.max(...clips.map(r => r.top));
    const clipBottom = Math.min(...clips.map(r => r.bottom));
    const clipLeft = Math.max(...clips.map(r => r.left));
    const clipRight = Math.min(...clips.map(r => r.right));
    let fullyVisible = 0;
    for (const row of list.querySelectorAll('.worklist-item')) {
      const r = row.getBoundingClientRect();
      if (r.top >= clipTop - 0.5 && r.bottom <= clipBottom + 0.5 &&
          r.left >= clipLeft - 0.5 && r.right <= clipRight + 0.5) {
        fullyVisible++;
      }
    }
    const scrollers = [];
    let el = list;
    while (el && el !== document.body) {
      const cs = getComputedStyle(el);
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) {
        scrollers.push(el.id || String(el.className));
      }
      el = el.parentElement;
    }
    return {
      rowCount: list.querySelectorAll('.worklist-item').length,
      fullyVisible,
      listClientH: list.clientHeight,
      listScrollH: list.scrollHeight,
      scrollers,
      bodyOverflowY: getComputedStyle(body).overflowY
    };
  });
}

async function expectChromePresent(page) {
  const modal = page.locator('#workListModal');
  await expect(modal.locator('#workListModalTitle')).toBeVisible();
  await expect(modal.locator('.worklist-tab-btn[data-tab="disconnect"]')).toBeVisible();
  await expect(modal.locator('.worklist-tab-btn[data-tab="reconnect"]')).toBeVisible();
  await expect(modal.locator('.worklist-tab-btn[data-tab="rules"]')).toBeVisible();
  await expect(modal.locator('#worklistSvgHost svg')).toBeVisible();
  await expect(modal.locator('#worklistSearchInput')).toBeVisible();
  await expect(modal.locator('#worklistAreaFilter')).toBeVisible();
  await expect(modal.locator('#worklistExportCsvBtn')).toBeVisible();
  await expect(modal.locator('#worklistPrintBtn')).toBeVisible();
  await expect(modal.locator('#worklistCopyDispatchBtn')).toBeVisible();
}

test.describe('Issue #366: Worklists modal single scroll area + visible rows', () => {
  test.setTimeout(180000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/#/home');
    await page.waitForSelector('#quickAddPaymentButton', { state: 'attached', timeout: 20000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('#quickAddPaymentButton', { state: 'attached', timeout: 20000 });
  });

  test('Mobile 390x844: at least 3 full rows visible, list is the only scroller', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile 390x844 test');
    const errors = trackErrors(page);

    await seedFees(page);
    await openWorklists(page);
    await expectChromePresent(page);

    const m = await measureLayout(page);
    expect(m.rowCount).toBeGreaterThanOrEqual(10);
    // The regression: only ~1 row was fully visible before the fix.
    expect(m.fullyVisible).toBeGreaterThanOrEqual(3);
    // Exactly one scroll area on the path from the list up: the list itself.
    expect(m.scrollers).toEqual(['worklistDisconnectList']);
    expect(m.bodyOverflowY).toBe('hidden');
    expect(m.listScrollH).toBeGreaterThan(m.listClientH);

    // The single scroll area really scrolls: last row reachable.
    await page.evaluate(() => {
      const list = document.getElementById('worklistDisconnectList');
      list.scrollTop = list.scrollHeight;
    });
    await page.waitForTimeout(250);
    const after = await measureLayout(page);
    expect(after.fullyVisible).toBeGreaterThanOrEqual(3);

    // Tabs still work end to end (reconnect + rules panes render).
    await page.locator('.worklist-tab-btn[data-tab="reconnect"]').click();
    await expect(page.locator('#worklistReconnectPane')).toBeVisible();
    await page.locator('.worklist-tab-btn[data-tab="rules"]').click();
    await expect(page.locator('#worklistRulesPane')).toBeVisible();
    await expect(page.locator('#worklistRuleOverdueDays')).toBeVisible();
    await page.locator('.worklist-tab-btn[data-tab="disconnect"]').click();
    await expect(page.locator('#worklistDisconnectPane')).toBeVisible();

    await page.locator('#worklistCloseBtn').click();
    await expect(page.locator('#workListModal')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('Desktop 1280x800: at least 3 full rows visible, list is the only scroller', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop 1280x800 test');
    const errors = trackErrors(page);

    await seedFees(page);
    await openWorklists(page);
    await expectChromePresent(page);

    const m = await measureLayout(page);
    expect(m.rowCount).toBeGreaterThanOrEqual(10);
    // Before the fix only 2 rows were fully visible in the 720px dialog.
    expect(m.fullyVisible).toBeGreaterThanOrEqual(3);
    expect(m.scrollers).toEqual(['worklistDisconnectList']);
    expect(m.bodyOverflowY).toBe('hidden');

    await page.locator('#worklistCloseBtn').click();
    await expect(page.locator('#workListModal')).toBeHidden();
    expect(errors).toEqual([]);
  });
});
