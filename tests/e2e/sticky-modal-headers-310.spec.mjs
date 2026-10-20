import { test, expect } from '@playwright/test';

test.describe('Mobile Popups Sticky Header and Footer (#310)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test('Quick Collect sticky header is solid and blocks underlying content when scrolled', async ({ page }) => {
    await page.goto('/');

    // Open Quick Collect via button
    const openBtn = page.locator('#quickAddPaymentButton, #mobileActionSheetCollectBtn, [data-open-quick-collect]').first();
    await openBtn.click();

    const modal = page.locator('#quickCollectModal');
    await expect(modal).toBeVisible();

    // Ensure all customers visible if dues count is 0
    const showAllBtn = modal.locator('[data-qc-show-all], .quick-collect-filter-chip[data-filter="all"]');
    if (await showAllBtn.first().isVisible()) {
      await showAllBtn.first().click();
    }

    // Select first customer in pick list to move to Step 2 (payment form)
    const customerCard = modal.locator('.qc-customer-card').first();
    await expect(customerCard).toBeVisible();
    await customerCard.click();

    // Ensure Step 2 form is visible
    const stepForm = modal.locator('#quickCollectStepForm');
    await expect(stepForm).toBeVisible();

    // Scroll the modal down so inputs/chips scroll under the header
    await page.evaluate(() => {
      const modalEl = document.getElementById('quickCollectModal');
      const cardEl = modalEl?.querySelector('.quick-collect-card');
      if (modalEl) modalEl.scrollTop = 250;
      if (cardEl) cardEl.scrollTop = 250;
    });

    await page.waitForTimeout(100);

    // Verify modal heading background is not transparent
    const heading = modal.locator('.modal-heading');
    await expect(heading).toBeVisible();

    const bg = await heading.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        bg: style.backgroundColor,
        isSticky: style.position === 'sticky',
        boxShadow: style.boxShadow
      };
    });

    expect(bg.isSticky).toBe(true);
    expect(bg.bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(bg.bg).not.toBe('transparent');

    // Verify elementFromPoint at heading title center is inside modal-heading and NOT an underlying chip
    const titlePoint = await page.evaluate(() => {
      const title = document.getElementById('quickCollectTitle');
      if (!title) return null;
      const rect = title.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const el = document.elementFromPoint(x, y);
      const elements = document.elementsFromPoint(x, y).map(e => e.tagName + (e.className ? '.' + e.className.split(' ').join('.') : ''));
      return {
        targetTag: el?.tagName,
        targetId: el?.id,
        isInsideHeading: !!el?.closest('.modal-heading'),
        elements
      };
    });

    expect(titlePoint).not.toBeNull();
    expect(titlePoint?.isInsideHeading).toBe(true);

    // Close modal
    const closeBtn = modal.locator('#closeQuickCollectModalBtn');
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });

  test('Add Customer sticky header and footer are solid when scrolled', async ({ page }) => {
    await page.goto('/');

    // Navigate to customers screen and open Add Customer
    await page.goto('/#/customers');
    const addCustBtn = page.locator('#srPrimaryAction, #addCustomerButton, [data-open-add-customer]').first();
    await addCustBtn.click();

    const dialog = page.locator('#addCustomerDialog');
    await expect(dialog).toBeVisible();

    // Scroll form down 260px
    await dialog.evaluate((el) => {
      el.scrollTop = 260;
    });

    await page.waitForTimeout(100);

    const heading = dialog.locator('.modal-heading');
    const actions = dialog.locator('.modal-actions.add-customer-actions');

    // Header checks
    const headerInfo = await heading.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        bg: style.backgroundColor,
        isSticky: style.position === 'sticky'
      };
    });
    expect(headerInfo.isSticky).toBe(true);
    expect(headerInfo.bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(headerInfo.bg).not.toBe('transparent');

    // Footer checks
    const footerInfo = await actions.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        bg: style.backgroundColor,
        isSticky: style.position === 'sticky'
      };
    });
    expect(footerInfo.isSticky).toBe(true);
    expect(footerInfo.bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(footerInfo.bg).not.toBe('transparent');

    // Close dialog
    const cancelBtn = dialog.locator('button[data-close-dialog]').first();
    await cancelBtn.click();
    await expect(dialog).not.toBeVisible();
  });

  test('Dark mode popups have solid dark background for sticky headers', async ({ page }) => {
    await page.goto('/');

    // Toggle dark mode
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });

    const openBtn = page.locator('#quickAddPaymentButton, #mobileActionSheetCollectBtn, [data-open-quick-collect]').first();
    await openBtn.click();

    const modal = page.locator('#quickCollectModal');
    await expect(modal).toBeVisible();

    const heading = modal.locator('.modal-heading');
    const headerBg = await heading.evaluate((el) => window.getComputedStyle(el).backgroundColor);

    expect(headerBg).not.toBe('rgba(0, 0, 0, 0)');
    expect(headerBg).not.toBe('transparent');
    expect(headerBg).not.toBe('rgb(255, 255, 255)'); // must be dark surface

    const closeBtn = modal.locator('#closeQuickCollectModalBtn');
    await closeBtn.click();
  });

  test('Desktop (1280x800) popups render cleanly with no layout regression', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    const openBtn = page.locator('#quickAddPaymentButton, [data-open-quick-collect]').first();
    await openBtn.click();

    const modal = page.locator('#quickCollectModal');
    await expect(modal).toBeVisible();

    const title = modal.locator('#quickCollectTitle');
    await expect(title).toBeVisible();

    const closeBtn = modal.locator('#closeQuickCollectModalBtn');
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });
});
