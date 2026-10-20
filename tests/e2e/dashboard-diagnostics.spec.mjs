import { test, expect } from '@playwright/test';

const DIAGNOSTICS_BUTTONS = [
  { btnId: '#dashboardOpenY1731ModalBtn', modalId: '#dashboardY1731Modal', title: 'Y.1731 SLA' },
  { btnId: '#dashboardOpenPseudowireModalBtn', modalId: '#dashboardPseudowireModal', title: 'Pseudowire' },
  { btnId: '#dashboardOpenBfdModalBtn', modalId: '#dashboardBfdModal', title: 'BFD Peering' },
  { btnId: '#dashboardOpenVplsModalBtn', modalId: '#dashboardVplsModal', title: 'VPLS Mesh' },
  { btnId: '#dashboardOpenCgnatModalBtn', modalId: '#dashboardCgnatModal', title: 'CGNAT Pool' },
  { btnId: '#dashboardOpenOltChassisModalBtn', modalId: '#dashboardOltChassisModal', title: 'OLT Chassis' },
  { btnId: '#dashboardOpenSrv6ModalBtn', modalId: '#dashboardSrv6Modal', title: 'SRv6 Policy' },
  { btnId: '#dashboardOpenOpticalEvmModalBtn', modalId: '#dashboardOpticalEvmModal', title: 'Constellation EVM' }
];

test.describe('Dashboard Diagnostics Modals Suite (#237)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#billingDashboard')).toBeVisible();
    const chartsCollapsible = page.locator('#homeChartsCollapsible');
    if (await chartsCollapsible.isVisible()) {
      await page.evaluate(() => {
        document.getElementById('homeChartsCollapsible')?.setAttribute('open', '');
      });
    }
  });

  for (const item of DIAGNOSTICS_BUTTONS) {
    test(`opens and closes ${item.title} diagnostics dialog (${item.btnId})`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));

      const btn = page.locator(item.btnId);
      await expect(btn).toBeAttached();

      // Scroll into view and click
      await btn.scrollIntoViewIfNeeded();
      await btn.click();

      const modal = page.locator(item.modalId);
      await expect(modal).toBeVisible();
      await expect(modal).toHaveAttribute('open', '');

      // Verify close via Escape key
      await page.keyboard.press('Escape');
      await expect(modal).not.toBeVisible();

      // Verify re-opening and closing via close button
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
      await expect(modal).toBeVisible();

      // Find close button inside modal
      const closeBtn = modal.locator('button.close-btn, button.modal-close-btn, [id$="ModalCloseBtn"]').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await expect(modal).not.toBeVisible();
      } else {
        await page.keyboard.press('Escape');
        await expect(modal).not.toBeVisible();
      }

      expect(errors).toEqual([]);
    });
  }
});
