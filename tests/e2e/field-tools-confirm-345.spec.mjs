import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('favicon.ico') && !text.includes('Failed to load resource')) {
        errors.push(text);
      }
    }
  });
  page.on('pageerror', err => errors.push(err.message));
  return errors;
}

test.describe('Issue #345: In-app confirmation dialog on field tools', () => {
  test('GPS Tracking: clearing breadcrumb trail displays in-app appConfirm dialog and cancels cleanly', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/#home');
    await page.waitForTimeout(1600); // Allow deferred field tool initializers to bind

    // Open GPS tracking modal directly
    await page.evaluate(() => {
      const modal = document.getElementById('mobileGpsBreadcrumbsModal');
      if (modal) modal.showModal();
    });

    const gpsModal = page.locator('#mobileGpsBreadcrumbsModal');
    await expect(gpsModal).toBeVisible();

    const clearBtn = gpsModal.locator('#btnGpsClearTrail');
    await expect(clearBtn).toBeVisible();

    // Click clear trail -> triggers in-app appConfirmDialog
    await clearBtn.click();

    const confirmDlg = page.locator('#appConfirmDialog');
    await expect(confirmDlg).toBeVisible();
    await expect(page.locator('#appConfirmTitle')).toContainText('Clear GPS breadcrumb trail?');

    // Click Cancel
    await page.locator('#appConfirmCancelBtn').click();
    await expect(confirmDlg).toBeHidden();

    // Close GPS modal
    await page.keyboard.press('Escape');
    await expect(gpsModal).toBeHidden();

    expect(errors).toEqual([]);
  });

  test('GPS Tracking: confirming clear trail removes data and shows toast without native popups', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/#home');
    await page.waitForTimeout(1600);

    // Populate a test breadcrumb point into localStorage
    await page.evaluate(() => {
      localStorage.setItem('shahdara_technician_gps_breadcrumbs_v1', JSON.stringify([
        { id: 'GPS-TEST-1', lat: 31.6215, lng: 74.282, timestamp: new Date().toISOString() }
      ]));
      const modal = document.getElementById('mobileGpsBreadcrumbsModal');
      if (modal) modal.showModal();
    });

    const gpsModal = page.locator('#mobileGpsBreadcrumbsModal');
    await expect(gpsModal).toBeVisible();

    const clearBtn = gpsModal.locator('#btnGpsClearTrail');
    await clearBtn.click();

    const confirmDlg = page.locator('#appConfirmDialog');
    await expect(confirmDlg).toBeVisible();

    // Click Confirm
    await page.locator('#appConfirmOkBtn').click();
    await expect(confirmDlg).toBeHidden();

    // Verify localStorage cleared
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('shahdara_technician_gps_breadcrumbs_v1');
      return raw ? JSON.parse(raw) : [];
    });
    expect(stored.length).toBe(0);

    // Verify toast appeared
    await expect(page.locator('#toast')).toContainText('GPS breadcrumb trail cleared');

    await page.keyboard.press('Escape');
    await expect(gpsModal).toBeHidden();

    expect(errors).toEqual([]);
  });

  test('Tube Shaving: clearing calibration logs uses in-app appConfirm dialog and shows toast', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/#home');
    await page.waitForTimeout(1600); // Allow deferred setupMobileTubeShavingModal (1500ms delay)

    // Populate a test record into localStorage
    await page.evaluate(() => {
      localStorage.setItem('shahdara_nav_tube_shaving_history', JSON.stringify([
        { id: 'SHV-TEST-1', tubeSize: '2.0', wallThicknessMm: 0.35, material: 'PBT', timestamp: new Date().toISOString() }
      ]));
      const modal = document.getElementById('mobileTubeShavingModal');
      if (modal) modal.showModal();
    });

    const shaveModal = page.locator('#mobileTubeShavingModal');
    await expect(shaveModal).toBeVisible();

    const clearBtn = shaveModal.locator('#shaveClearHistoryBtn');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    const confirmDlg = page.locator('#appConfirmDialog');
    await expect(confirmDlg).toBeVisible();
    await expect(page.locator('#appConfirmTitle')).toContainText('Clear buffer tube shaving calibration logs?');

    // Confirm
    await page.locator('#appConfirmOkBtn').click();
    await expect(confirmDlg).toBeHidden();

    // Verify localStorage cleared
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('shahdara_nav_tube_shaving_history');
      return raw ? JSON.parse(raw) : [];
    });
    expect(stored.length).toBe(0);

    // Verify toast appeared
    await expect(page.locator('#toast')).toContainText('Tube shaving calibration logs cleared');

    await page.keyboard.press('Escape');
    await expect(shaveModal).toBeHidden();

    expect(errors).toEqual([]);
  });

  test('Fiber Identifier: clearing audit logs triggers in-app appConfirm dialog and cancels cleanly', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/#home');
    await page.waitForTimeout(1600);

    await page.evaluate(() => {
      localStorage.setItem('shahdara_fiber_identifier_audits_v1', JSON.stringify([
        { id: 'FIA-TEST-1', wavelength: '1550 nm', timestamp: new Date().toISOString() }
      ]));
      const modal = document.getElementById('mobileFiberIdentifierModal');
      if (modal) modal.showModal();
    });

    const fiModal = page.locator('#mobileFiberIdentifierModal');
    await expect(fiModal).toBeVisible();

    const clearBtn = fiModal.locator('#identClearHistoryBtn');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    const confirmDlg = page.locator('#appConfirmDialog');
    await expect(confirmDlg).toBeVisible();
    await expect(page.locator('#appConfirmTitle')).toContainText('Clear fiber identifier audit logs?');

    // Cancel
    await page.locator('#appConfirmCancelBtn').click();
    await expect(confirmDlg).toBeHidden();

    // Verify audits still intact
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('shahdara_fiber_identifier_audits_v1');
      return raw ? JSON.parse(raw) : [];
    });
    expect(stored.length).toBe(1);

    await page.keyboard.press('Escape');
    await expect(fiModal).toBeHidden();

    expect(errors).toEqual([]);
  });
});
