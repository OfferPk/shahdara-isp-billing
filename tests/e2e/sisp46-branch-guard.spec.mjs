// SISP-46: Multi-Branch Merge Guard (restore preview).
// Written to run in CI (the repo Playwright runner cannot run in the dev
// VM). Seeds a one-customer ledger plus a local branch-guard record
// (lineage e2e-lineage-local), then feeds the restore file input a
// backup exported by a DIFFERENT lineage and checks, at a real 360px
// viewport:
//   - the preview shows the foreign-branch warning, the Apply button
//     stays disabled, and the override checkbox is revealed;
//   - ticking the override re-computes the preview: the override-active
//     warning replaces the block text and Apply becomes enabled;
//   - unticking blocks the merge again.
import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) errors.push(m.text()); });
  return errors;
}

const CUSTOMER_SHAPE = {
  mohalla: '', zone: '', address: '', phone: '', ispProvider: '', serviceStatus: 'not-set',
  serviceStatusHistory: [], packageSpeed: '', monthlyPurchaseCost: null, monthlySellingAmount: null,
  monthlyPriceSchedule: [], billingStartMonth: null, connectionDate: null, expiryDate: null,
  cancellationDate: null, packageHistory: [], relocationLog: [], archived: false, archivedAt: null,
  bills: [], incidents: []
};

async function boot(page) {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/#/home');
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  await page.evaluate(({ customerShape }) => {
    localStorage.clear();
    localStorage.setItem('shahdara-isp-billing-v1', JSON.stringify({
      version: 1, nextCustomerNumber: 2,
      customers: [{ id: 'seed-001', customerNumber: 1, name: 'E2E LOCAL CUSTOMER', ...customerShape }],
      inventoryItems: [], inventoryMovements: [], expenses: [], saadAttendanceDays: [], umairWorkdays: [], monthlyClosings: []
    }));
    localStorage.setItem('sisp_branch_guard_v1', JSON.stringify({
      version: 1, branchId: 'e2e-branch-local', instanceId: 'e2e-instance-local',
      lineageId: 'e2e-lineage-local', createdAt: '2026-10-29T09:00:00.000Z',
      headSeq: 1, headStampId: '1:e2e-instance-local', headInstanceId: 'e2e-instance-local',
      headFingerprint: '', events: []
    }));
  }, { customerShape: CUSTOMER_SHAPE });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

function foreignBackupText() {
  return JSON.stringify({
    format: 'shahdara-isp-billing-backup',
    formatVersion: 1,
    exportedAt: '2026-10-29T10:00:00.000Z',
    state: {
      version: 1, nextCustomerNumber: 3,
      customers: [{ id: 'e2e-foreign-1', customerNumber: 2, name: 'E2E FOREIGN CUSTOMER', ...CUSTOMER_SHAPE }],
      inventoryItems: [], inventoryMovements: [], expenses: [], saadAttendanceDays: [], umairWorkdays: [], monthlyClosings: []
    },
    settings: {
      branchGuard: {
        lineageId: 'e2e-lineage-foreign', seq: 1, instanceId: 'e2e-instance-foreign',
        stampId: '1:e2e-instance-foreign', parentStampId: '0:e2e-instance-foreign',
        exportedAt: '2026-10-29T10:00:00.000Z', fingerprint: '', prevFingerprint: ''
      }
    }
  });
}

test('foreign backup is blocked in the preview until the operator arms the override', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);

  await page.setInputFiles('#jsonBackupFileInput', {
    name: 'foreign-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(foreignBackupText())
  });

  await expect(page.locator('#jsonBackupDialog')).toBeVisible();
  const note = page.locator('#jsonBackupBranchGuardNote');
  await expect(note).toBeVisible();
  await expect(note).toContainText('Different ledger branch');
  await expect(page.locator('#branchGuardOverrideWrap')).toBeVisible();
  await expect(page.locator('#applyJsonBackupButton')).toBeDisabled();

  // Arming the override re-computes the preview: block text is replaced
  // by the override warning and the merge (one new customer) can apply.
  await page.check('#branchGuardOverrideCheckbox');
  await expect(note).toContainText('override is ON');
  await expect(page.locator('#applyJsonBackupButton')).toBeEnabled();

  // Disarming blocks it again — the guard, not the checkbox, decides.
  await page.uncheck('#branchGuardOverrideCheckbox');
  await expect(note).toContainText('Different ledger branch');
  await expect(page.locator('#applyJsonBackupButton')).toBeDisabled();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
