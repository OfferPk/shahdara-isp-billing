// SISP-52: 1-Tap Off-Device Backup File Share (navigator.share) to
// WhatsApp / Google Drive. CI-only Playwright spec (the repo's Playwright
// runner cannot run in the VM; written for CI, not claimed as run
// locally). Seeds a minimal synthetic ledger and checks, at a real 360px
// viewport:
//   - the Backup Health panel carries the [📤 Share Backup to WhatsApp /
//     Drive] button;
//   - on a share-capable browser (stubbed navigator.canShare/share) one
//     tap hands the system sheet the checksum-stamped backup file and the
//     top-bar badge resets to "Backup: Safe" (sisp_backup_health_v1
//     written);
//   - without Web Share the same tap downloads the same backup file and
//     still marks Backup Health Safe — never a dead end;
//   - no horizontal overflow at 360px.
import { test, expect } from '@playwright/test';

const SEED_KEY = 'shahdara-isp-billing-v1';
const HEALTH_KEY = 'sisp_backup_health_v1';

async function seed(page, { shareCapable }) {
  await page.addInitScript(([seedKey, capable]) => {
    const state = {
      version: 1,
      nextCustomerNumber: 2,
      customers: [
        { id: 'c1', customerNumber: 1, name: 'E2E Test Customer', bills: [
          { month: '2026-10', dueAmount: 3000, payments: [
            { id: 'p1', date: '2026-10-05', amount: 3000, method: 'Cash' }
          ] }
        ] }
      ],
      expenses: [],
      monthlyClosings: []
    };
    window.localStorage.setItem(seedKey, JSON.stringify(state));
    if (capable) {
      window.__shareCalls = [];
      Object.defineProperty(window.navigator, 'canShare', {
        configurable: true,
        value: data => Boolean(data && Array.isArray(data.files) && data.files.length === 1)
      });
      Object.defineProperty(window.navigator, 'share', {
        configurable: true,
        value: async data => { window.__shareCalls.push(data); }
      });
    }
  }, [SEED_KEY, shareCapable]);
}

async function openBackupPanel(page) {
  await page.goto('/');
  await page.locator('#backupControlsToggle').click();
  await expect(page.locator('#shareBackupHealthButton')).toBeVisible();
}

test('share-capable phone: one tap shares the stamped backup and Backup Health turns Safe', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await seed(page, { shareCapable: true });
  await openBackupPanel(page);
  await expect(page.locator('#backupHealthLabel')).toHaveText('Backup: Never');

  await page.locator('#shareBackupHealthButton').click();

  const calls = await page.evaluate(() => window.__shareCalls.length);
  expect(calls).toBe(1);
  const fileName = await page.evaluate(() => window.__shareCalls[0].files[0].name);
  expect(fileName).toMatch(/^shahdara-isp-billing-backup-.*\.json$/);
  const fileText = await page.evaluate(() => window.__shareCalls[0].files[0].text());
  expect(JSON.parse(fileText).checksum).toMatch(/^crc32:[0-9a-f]{8}$/);

  await expect(page.locator('#backupHealthLabel')).toHaveText('Backup: Safe');
  const record = await page.evaluate(key => JSON.parse(window.localStorage.getItem(key)), HEALTH_KEY);
  expect(record.lastExportAt).toBeTruthy();
  expect(record.paymentCountAtExport).toBe(1);
});

test('no Web Share: one tap downloads the same backup and still marks Safe (360px, no overflow)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await seed(page, { shareCapable: false });
  await openBackupPanel(page);

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#shareBackupHealthButton').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^shahdara-isp-billing-backup-.*\.json$/);

  await expect(page.locator('#backupHealthLabel')).toHaveText('Backup: Safe');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
