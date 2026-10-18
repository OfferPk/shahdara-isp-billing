import { test, expect } from '@playwright/test';

test.describe('Responsive Dialogs & Bottom-Sheet Standard (#215)', () => {
  test('all dialogs fit within 360x640 viewport with fully clickable close button', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto('/');

    // Retrieve all dialog IDs
    const dialogs = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('dialog'));
      return all.map(d => ({
        id: d.id,
        className: d.className
      })).filter(d => !!d.id);
    });

    expect(dialogs.length).toBeGreaterThanOrEqual(167);

    for (const { id } of dialogs) {
      const res = await page.evaluate((dialogId) => {
        const dialog = document.getElementById(dialogId);
        if (!dialog) return { error: `Dialog #${dialogId} not found` };

        // Ensure clean state
        document.querySelectorAll('dialog[open]').forEach(d => {
          try { d.close(); } catch { d.removeAttribute('open'); }
        });

        // Open
        try {
          if (typeof dialog.showModal === 'function') {
            dialog.showModal();
          } else {
            dialog.setAttribute('open', '');
          }
        } catch (err) {
          return { error: `Failed to open #${dialogId}: ${err.message}` };
        }

        const dRect = dialog.getBoundingClientRect();
        const closeBtn = dialog.querySelector('.close-button, .modal-close-btn, .billing-modal-close, button[aria-label*="close" i], button[aria-label*="Close" i]');
        let cRect = null;
        if (closeBtn) {
          cRect = closeBtn.getBoundingClientRect();
        }

        return {
          dRect: {
            x: dRect.x,
            y: dRect.y,
            width: dRect.width,
            height: dRect.height,
            right: dRect.x + dRect.width
          },
          hasCloseBtn: !!closeBtn,
          cRect: cRect ? {
            x: cRect.x,
            y: cRect.y,
            width: cRect.width,
            height: cRect.height,
            right: cRect.x + cRect.width
          } : null
        };
      }, id);

      expect(res.error).toBeUndefined();
      expect(res.hasCloseBtn).toBe(true);

      // Dialog container must fit inside 360px viewport
      expect(res.dRect.x).toBeGreaterThanOrEqual(-1);
      expect(res.dRect.right).toBeLessThanOrEqual(361);
      expect(res.dRect.width).toBeLessThanOrEqual(361);

      // Close button must be completely inside 360px viewport
      expect(res.cRect.x).toBeGreaterThanOrEqual(-1);
      expect(res.cRect.right).toBeLessThanOrEqual(361);

      // Close cleanly
      await page.evaluate((dialogId) => {
        const dialog = document.getElementById(dialogId);
        if (dialog && dialog.open) {
          try { dialog.close(); } catch { dialog.removeAttribute('open'); }
        }
      }, id);
    }
  });

  test('enforces only one dialog open at a time', async ({ page }) => {
    await page.goto('/');

    const openCount = await page.evaluate(() => {
      const d1 = document.getElementById('quickCollectModal');
      const d2 = document.getElementById('accountStatementModal');
      if (!d1 || !d2) return -1;

      d1.showModal();
      const count1 = document.querySelectorAll('dialog[open]').length;

      d2.showModal();
      const count2 = document.querySelectorAll('dialog[open]').length;

      const d1Open = d1.open;
      const d2Open = d2.open;

      d2.close();

      return { count1, count2, d1Open, d2Open };
    });

    expect(openCount.count1).toBe(1);
    expect(openCount.count2).toBe(1);
    expect(openCount.d1Open).toBe(false);
    expect(openCount.d2Open).toBe(true);
  });

  test('Escape key closes dialog and restores focus to opener element', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const opener = page.locator('#quickAddPaymentButton');
    await opener.focus();
    await opener.click();

    const modal = page.locator('#quickCollectModal');
    await expect(modal).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();

    // Focus must return to opener button
    await expect(opener).toBeFocused();
  });

  test('Quick Collect Cash at 390x844: close button not clipped, elements fit viewport, outside tap closes', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await page.locator('#quickAddPaymentButton').click();
    const modal = page.locator('#quickCollectModal');
    await expect(modal).toBeVisible();

    // Check close button bounding box
    const closeBtn = page.locator('#closeQuickCollectModalBtn');
    await expect(closeBtn).toBeVisible();
    const closeBox = await closeBtn.boundingBox();
    expect(closeBox).not.toBeNull();
    expect(closeBox.x).toBeGreaterThan(0);
    expect(closeBox.x + closeBox.width).toBeLessThanOrEqual(390);
    expect(closeBox.width).toBeGreaterThanOrEqual(44);
    expect(closeBox.height).toBeGreaterThanOrEqual(44);

    // Filter to "all" to inspect customer cards and badges
    await modal.locator('.quick-collect-filter-chip[data-filter="all"]').click();
    await page.waitForTimeout(200);

    const searchInput = page.locator('#quickCollectSearchInput');
    const searchBox = await searchInput.boundingBox();
    expect(searchBox.x + searchBox.width).toBeLessThanOrEqual(390);

    const cards = modal.locator('.qc-customer-card');
    const cardCount = await cards.count();
    if (cardCount > 0) {
      const firstCardBox = await cards.first().boundingBox();
      expect(firstCardBox.x + firstCardBox.width).toBeLessThanOrEqual(390);
    }

    // Backdrop tap closes the modal
    // Click outside dialog bounding box (e.g. at x=4, y=4)
    await page.mouse.click(4, 4);
    await expect(modal).not.toBeVisible();
  });
});
