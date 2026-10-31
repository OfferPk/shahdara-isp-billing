// Regression spec for the user-reported Quick Collect bug (Top 5 entry point):
//   Home -> "Top 5 Overdue Accounts" -> tap a due account's "Collect" link ->
//   the Quick Collect window opens and its x (cross) does NOT close it.
// Root cause: the link's hash #quick-collect/<id> was pushed as a history entry
// and then recorded by the #263 collect route as `collectFrom`; closing the
// sheet navigated Back onto that very hash, whose PWA-shortcut handler
// immediately reopened the dialog. The fix opens through the controller on the
// canonical #/collect route (preselected to the tapped customer) and treats
// #quick-collect/<id> as a collect-route deep link that is replaced on open —
// never a Back target. (The after-payment close paths are covered by
// quick-collect-close-after-toast-dismiss.spec.mjs / PR #333.)
import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) errors.push(m.text());
  });
  return errors;
}

// Seed pending bills (1500 / 2000 / 2500) for the first three active customers
// so the Home "Top 5 Overdue Accounts" list renders Collect links.
async function seedOverdue(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate(async () => {
    const core = await import('./core.js');
    let s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    const month = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 7); // PKT — app billing month is Asia/Karachi; UTC ISO lags on the 1st 00:00–05:00 PKT
    const ids = s.customers.filter(c => !c.archived).slice(0, 3).map(c => c.id);
    ids.forEach((id, i) => { s = core.saveBillMonth(s, id, { month, dueAmount: 1500 + i * 500, status: 'pending' }); });
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(s));
  });
  await page.reload();
  const firstLink = page.locator('#homeTopOverdueList .overdue-collect-link').first();
  await expect(firstLink).toBeVisible();
  return firstLink;
}

const modal = page => page.locator('#quickCollectModal');

// Tap the first Top 5 Collect link (highest dues). Quick Collect must open on
// the canonical route, preselected to that customer (payment form, not the
// picker) — the link's own aria-label promises "Collect from {name}".
async function openFromTop5(page, isMobile) {
  const link = page.locator('#homeTopOverdueList .overdue-collect-link').first();
  const href = await link.getAttribute('href');
  const name = (await link.getAttribute('aria-label')).replace(/^Collect from /, '');
  await link.scrollIntoViewIfNeeded();
  if (isMobile) await link.tap();
  else await link.click();
  await expect(modal(page)).toBeVisible();
  await expect(page.locator('#quickCollectStepForm')).toBeVisible();
  await expect(page.locator('#quickCollectStepPick')).toBeHidden();
  await expect(modal(page).locator('.qc-head-name')).toHaveText(name);
  await expect(page).toHaveURL(/#\/collect$/);
  return { href, name, customerId: href.replace('#quick-collect/', '') };
}

// The reported bug reopened the dialog in the same instant it closed, so
// "closed" must be proven stable, on a sane (non-collect) URL, with Home
// usable underneath.
async function expectStaysClosed(page) {
  await expect(modal(page)).toBeHidden();
  await page.waitForTimeout(900);
  await expect(modal(page)).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.getElementById('quickCollectModal').open)).toBe(false);
  await expect(page).not.toHaveURL(/collect/);
  await expect(page.locator('#homeTopOverdueList .overdue-collect-link').first()).toBeVisible();
}

test.describe('Quick Collect opened from Home Top 5 Overdue Accounts', () => {
  // Seeding + full dialog flows are slow on shared hardware (cf. #333 spec).
  test.setTimeout(120000);

  test('x closes the dialog and it stays closed', async ({ page, isMobile }) => {
    const errors = trackErrors(page);
    await seedOverdue(page);
    await openFromTop5(page, isMobile);
    await page.locator('#closeQuickCollectModalBtn').click();
    await expectStaysClosed(page);
    expect(errors).toEqual([]);
  });

  test('Escape closes the dialog and it stays closed', async ({ page, isMobile }) => {
    const errors = trackErrors(page);
    await seedOverdue(page);
    await openFromTop5(page, isMobile);
    await page.keyboard.press('Escape');
    await expectStaysClosed(page);
    expect(errors).toEqual([]);
  });

  test('backdrop tap closes the dialog and it stays closed', async ({ page, isMobile }) => {
    const errors = trackErrors(page);
    await seedOverdue(page);
    await openFromTop5(page, isMobile);
    const box = await modal(page).boundingBox();
    expect(box).not.toBeNull();
    expect(box.y).toBeGreaterThan(16);
    // Tap the backdrop above the sheet (outside the dialog's own rect).
    await page.mouse.click(box.x + box.width / 2, box.y - 16);
    await expectStaysClosed(page);
    expect(errors).toEqual([]);
  });

  test('the #quick-collect/<id> deep link opens preselected and closes for good', async ({ page }) => {
    const errors = trackErrors(page);
    const firstLink = await seedOverdue(page);
    const href = await firstLink.getAttribute('href');
    const name = (await firstLink.getAttribute('aria-label')).replace(/^Collect from /, '');
    // Cold load straight onto the deep link (shared / pasted link, new tab).
    await page.goto(`/${href}`);
    await expect(modal(page)).toBeVisible();
    await expect(page.locator('#quickCollectStepForm')).toBeVisible();
    await expect(modal(page).locator('.qc-head-name')).toHaveText(name);
    // Normalised to the canonical route; the deep-link entry is replaced, so
    // there is no opener hash left in history to fall back onto.
    await expect(page).toHaveURL(/#\/collect$/);
    await page.locator('#closeQuickCollectModalBtn').click();
    await expect(modal(page)).toBeHidden();
    await expect(page).toHaveURL(/#\/home$/);
    await page.waitForTimeout(900);
    await expect(modal(page)).toBeHidden();
    // Forward must not resurrect it either.
    await page.goForward();
    await page.waitForTimeout(700);
    await expect(modal(page)).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('collecting from Top 5 records the payment for the tapped customer', async ({ page, isMobile }) => {
    const errors = trackErrors(page);
    await seedOverdue(page);
    const { customerId } = await openFromTop5(page, isMobile);
    // The form is prefilled with the amount due; confirming records it.
    await expect(page.locator('#quickCollectAmountInput')).not.toHaveValue('');
    await page.locator('#quickCollectConfirmBtn').click();
    await expect(page.locator('#quickCollectStepSuccess')).toBeVisible();
    await page.locator('#quickCollectDoneCloseBtn').click();
    await expectStaysClosed(page);
    // Paid in full: the customer leaves the Top 5 overdue list.
    await expect(page.locator(`#homeTopOverdueList li[data-customer-id="${customerId}"]`)).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
