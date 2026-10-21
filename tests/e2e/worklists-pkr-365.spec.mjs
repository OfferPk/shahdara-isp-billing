import { test, expect } from '@playwright/test';

// Issue #365: Worklists showed doubled currency "PKR PKR 73,000" because
// formatPKR() already returns "PKR 1,000" and the worklist code prefixed
// another "PKR ". Pin single-PKR rendering on the Home card and in the modal.

test.describe('Issue #365: Worklists single-PKR currency', () => {
  // The app is heavy on shared CI hosts (initial load + modal open can take
  // >30s under parallel load); the assertions below are the gate, not speed.
  test.setTimeout(120000);

  test('Home worklists card shows a single PKR in the disconnect amount', async ({ page }) => {
    await page.goto('/');
    const amt = page.locator('#worklistsSummaryDiscAmount');
    await expect(amt).toBeVisible();
    const text = (await amt.textContent())?.trim() || '';
    expect(text).not.toContain('PKR PKR');
    expect(text).toMatch(/^PKR [\d,]+ dues \(> \d+d\)$/);
  });

  test('Worklists modal rows and dispatch graphic show a single PKR', async ({ page }) => {
    await page.goto('/');
    await page.locator('#openWorklistsModalBtn').click();
    const modal = page.locator('#workListModal');
    await expect(modal).toBeVisible();

    const modalText = (await modal.textContent()) || '';
    expect(modalText).not.toContain('PKR PKR');

    // Dispatch graphic line: "PKR 73,000 dues (> 10d)"
    const svgText = await modal.locator('svg text').allTextContents();
    const duesLine = svgText.find(t => /dues \(> \d+d\)/.test(t));
    if (duesLine) {
      expect(duesLine).toMatch(/PKR [\d,]+ dues \(> \d+d\)/);
      expect(duesLine).not.toContain('PKR PKR');
    }

    // Disconnect rows: amount is exactly "PKR <amount>"
    const dueAmounts = page.locator('#worklistDisconnectList .amount-val-due');
    if (await dueAmounts.count()) {
      const first = (await dueAmounts.first().textContent())?.trim() || '';
      expect(first).toMatch(/^PKR [\d,]+$/);
    }

    // Reconnect rows: "Paid PKR <amount> on <date>" with a single PKR.
    // The desktop modal's nested-scroll layout (issue #366) can obstruct the
    // physical tab click under load; fall back to the tab's own DOM click
    // handler — this spec pins rendered text, not click mechanics.
    const recTab = page.locator('.worklist-tab-btn[data-tab="reconnect"]');
    await expect(recTab).toBeVisible();
    await recTab.click({ timeout: 10000 }).catch(async () => {
      await recTab.evaluate(el => el.click());
    });
    await expect(page.locator('#worklistReconnectPane')).toBeVisible();
    const recText = (await page.locator('#worklistReconnectList').textContent()) || '';
    expect(recText).not.toContain('PKR PKR');
    if (recText.includes('Paid')) {
      expect(recText).toMatch(/Paid PKR [\d,]+ on \d{4}-\d{2}-\d{2}/);
    }
  });
});
