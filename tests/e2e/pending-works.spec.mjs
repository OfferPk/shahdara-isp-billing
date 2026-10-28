// Pending works: owner notes & reminders with customer-count thresholds.
// Written to run in CI (the repo Playwright runner cannot run in the dev
// VM). Adds a threshold note (due at 100 customers) and a plain note,
// checks the card shows the nearest progress, toggles done/pending, edits
// a note, deletes one after the confirm dialog, and checks no horizontal
// overflow at 390px. The list starts empty — no example notes are seeded.
import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) errors.push(m.text()); });
  return errors;
}

async function boot(page) {
  await page.goto('/#/home');
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

test('pending works: threshold note, plain note, toggle, edit, delete with confirm', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await expect(page.locator('#dashboardPendingWorksValue')).toContainText('Nothing pending');
  await page.locator('#openPendingWorksModalBtn').click();
  await expect(page.locator('#pendingWorksModal')).toBeVisible();
  // Threshold note: due when non-archived customers reach 100.
  await page.locator('#pendingWorksNote').fill('Nasir se splicing machine mangwani hai');
  await page.locator('#pendingWorksSource').fill('Nasir');
  await page.locator('#pendingWorksThreshold').fill('100');
  await page.locator('#pendingWorksForm button[type="submit"]').click();
  let listText = await page.locator('#pendingWorksList').innerText();
  expect(listText).toContain('Nasir se splicing machine mangwani hai');
  expect(listText).toContain('Nasir');
  expect(listText).toContain('/100');
  // Plain note: never auto-due, no threshold line.
  await page.locator('#pendingWorksNote').fill('OLT lagwani hai pull side');
  await page.locator('#pendingWorksSource').fill('');
  await page.locator('#pendingWorksThreshold').fill('');
  await page.locator('#pendingWorksForm button[type="submit"]').click();
  listText = await page.locator('#pendingWorksList').innerText();
  expect(listText).toContain('OLT lagwani hai pull side');
  // Toggle the plain note to done and back.
  await page.locator('[data-pending-toggle]').nth(1).click();
  listText = await page.locator('#pendingWorksList').innerText();
  expect(listText).toContain('Done');
  await page.locator('[data-pending-toggle]').nth(1).click();
  // Edit the threshold note's text.
  await page.locator('[data-pending-edit]').first().click();
  await expect(page.locator('#pendingWorksSubmitBtn')).toContainText('Save changes');
  await page.locator('#pendingWorksNote').fill('Nasir se splicing machine le aani hai');
  await page.locator('#pendingWorksForm button[type="submit"]').click();
  listText = await page.locator('#pendingWorksList').innerText();
  expect(listText).toContain('Nasir se splicing machine le aani hai');
  // Delete the plain note after the confirm dialog.
  await page.locator('[data-pending-delete]').nth(1).click();
  await page.locator('#appConfirmOkBtn').click();
  listText = await page.locator('#pendingWorksList').innerText();
  expect(listText).not.toContain('OLT lagwani hai pull side');
  expect(errors).toEqual([]);
});

test('pending works: no horizontal overflow at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = trackErrors(page);
  await boot(page);
  await page.locator('#openPendingWorksModalBtn').click();
  await expect(page.locator('#pendingWorksModal')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  expect(errors).toEqual([]);
});
