// Pending Actions pills: on narrow phones all four filter pills must be
// fully readable — no mid-word truncation. ALEX's phone screenshot showed
// "All Pend" / "WhatsAp" / "Promi" / "Offlin": the tab row let its flex
// items shrink (no flex-shrink control) inside a modal that clips
// overflow, so the long runtime i18n labels ("All Pending",
// "📱 WhatsApp Receipts", "🤝 Promises Due", "💾 Offline Queue") were cut
// mid-word. This spec pins every pill's full label inside its own box and
// inside the visible row, at 360px and 390px widths, and confirms tab
// switching still works. Pattern follows tests/e2e/worklist-tabs-381.spec.mjs.
import { test, expect } from '@playwright/test';

const TABS = [
  { key: 'all', label: 'All Pending' },
  { key: 'receipts', label: 'WhatsApp Receipts' },
  { key: 'promises', label: 'Promises Due' },
  { key: 'offline', label: 'Offline Queue' },
];

async function openModal(page) {
  await page.goto('/');
  await page.locator('#topbarPendingActionsBtn').click();
  await expect(page.locator('#pendingActionsModal')).toBeVisible();
}

async function pillGeometry(page) {
  return page.evaluate(() => {
    const row = document.querySelector('.pending-actions-tabs');
    const rowRect = row.getBoundingClientRect();
    const tabs = [...document.querySelectorAll('.pending-actions-tab')].map((tab) => {
      const rect = tab.getBoundingClientRect();
      const label = tab.querySelector('span[data-i18n]');
      const labelRect = label ? label.getBoundingClientRect() : null;
      return {
        key: tab.dataset.pendingTab,
        text: tab.textContent.trim(),
        clientWidth: tab.clientWidth,
        scrollWidth: tab.scrollWidth,
        rect: { left: rect.left, right: rect.right },
        labelRect: labelRect ? { left: labelRect.left, right: labelRect.right } : null,
      };
    });
    return {
      rowRect: { left: rowRect.left, right: rowRect.right },
      rowScrollWidth: row.scrollWidth,
      rowClientWidth: row.clientWidth,
      tabs,
    };
  });
}

test.describe('Pending Actions pills fully readable on narrow phones', () => {
  test.setTimeout(180000);

  for (const width of [360, 390]) {
    test(`all four pills fully readable at ${width}px, no clipping or scrolling needed`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await openModal(page);
      const geo = await pillGeometry(page);
      expect(geo.tabs.map((t) => t.key)).toEqual(['all', 'receipts', 'promises', 'offline']);
      for (const tab of geo.tabs) {
        const want = TABS.find((t) => t.key === tab.key).label;
        expect(tab.text).toContain(want);
        // No internal clipping: the pill is at least as wide as its content.
        expect(tab.scrollWidth - tab.clientWidth).toBeLessThanOrEqual(1);
        // Label text stays inside its pill.
        expect(tab.labelRect.left).toBeGreaterThanOrEqual(tab.rect.left - 1);
        expect(tab.labelRect.right).toBeLessThanOrEqual(tab.rect.right + 1);
        // Pill stays inside the visible row — nothing cut by the row edge.
        expect(tab.rect.left).toBeGreaterThanOrEqual(geo.rowRect.left - 1);
        expect(tab.rect.right).toBeLessThanOrEqual(geo.rowRect.right + 1);
      }
      // The row itself needs no horizontal scrolling at these widths.
      expect(geo.rowScrollWidth - geo.rowClientWidth).toBeLessThanOrEqual(1);
    });
  }

  test('tabs still switch panes after the pills fix', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 844 });
    await openModal(page);
    await page.locator('.pending-actions-tab[data-pending-tab="receipts"]').click();
    await expect(page.locator('.pending-actions-tab[data-pending-tab="receipts"]')).toHaveClass(/active/);
    await page.locator('.pending-actions-tab[data-pending-tab="promises"]').click();
    await expect(page.locator('.pending-actions-tab[data-pending-tab="promises"]')).toHaveClass(/active/);
    await page.locator('.pending-actions-tab[data-pending-tab="all"]').click();
    await expect(page.locator('.pending-actions-tab[data-pending-tab="all"]')).toHaveClass(/active/);
  });
});
