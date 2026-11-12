// Dues Recovery Overhaul (2026-11-12). Written to run in CI (the repo
// Playwright runner cannot run in the dev VM — the probe that verified
// the #287 isolation ran against a local static server instead).
// Seeds THREE synthetic customers with dues and checks, at a real
// 360px viewport:
//   - the recovery screen shows ONLY the recovery panel (the 20+ home
//     operational cards are hidden, not just pushed down);
//   - the summary bar (Pending / Arrears / Current month) and the
//     sticky filter row (search, numbered mohalla dropdown, priority
//     pills) render, and the filters actually narrow the list;
//   - cards carry actionable health tags (never "Insufficient
//     history"), a Collect / Waada / History row and a 50/50
//     WhatsApp row; a saved 03xx number links to wa.me/+92;
//   - Waada opens the promise dialog without leaving the list;
//   - inline Add Phone saves the number on the card and the card
//     then offers the WhatsApp link;
//   - Collect opens Quick Collect pre-filled with the full
//     outstanding balance (PKR 4,000 for the two-bill customer);
//   - the header subtitle is the full text, not truncated;
//   - no page errors and no horizontal overflow at 360px.
// Dates are computed from the real clock so the spec is month-agnostic.
// Fixture data only — pattern-fake phone (03001234567 family), no real
// customer data of any kind in this file.
import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) errors.push(m.text()); });
  return errors;
}

const monthKeyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const dateKeyOf = (d) => `${monthKeyOf(d)}-${String(d.getDate()).padStart(2, '0')}`;

async function bootAndSeed(page) {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/#/home');
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  await page.evaluate(() => localStorage.clear());
  const now = new Date();
  const month = monthKeyOf(now);
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = monthKeyOf(last);
  const fiveDaysAgo = dateKeyOf(new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000));
  await page.evaluate(({ month, lastMonth, fiveDaysAgo }) => {
    const state = {
      version: 1,
      nextCustomerNumber: 4,
      customers: [
        {
          id: 'seed-rec-a', customerNumber: 1, name: 'E2E Recovery High', mohalla: 'CHARYAA', phone: '03001234567',
          monthlySellingAmount: 2000,
          monthlyPriceSchedule: [{ amount: 2000, effectiveMonth: lastMonth, recordedAt: `${lastMonth}-01T09:00:00.000Z` }],
          bills: [
            { id: 'bill-a-last', month: lastMonth, dueAmount: 2000, status: 'pending', dueDate: `${lastMonth}-05`, payments: [] },
            { id: 'bill-a-current', month, dueAmount: 2000, status: 'pending', dueDate: `${month}-05`, payments: [] }
          ],
          archived: false
        },
        {
          id: 'seed-rec-b', customerNumber: 2, name: 'E2E Recovery First', mohalla: 'GANGALL', phone: '',
          monthlySellingAmount: 1000,
          monthlyPriceSchedule: [{ amount: 1000, effectiveMonth: month, recordedAt: `${month}-01T09:00:00.000Z` }],
          bills: [
            { id: 'bill-b-current', month, dueAmount: 1000, status: 'pending', dueDate: `${month}-05`, payments: [] }
          ],
          archived: false
        },
        {
          id: 'seed-rec-c', customerNumber: 3, name: 'E2E Recovery Waada', mohalla: 'BARRIAN', phone: '',
          monthlySellingAmount: 1500,
          monthlyPriceSchedule: [{ amount: 1500, effectiveMonth: month, recordedAt: `${month}-01T09:00:00.000Z` }],
          bills: [
            { id: 'bill-c-current', month, dueAmount: 1500, status: 'pending', dueDate: `${month}-05`, payments: [] }
          ],
          promiseDate: fiveDaysAgo,
          archived: false
        }
      ]
    };
    localStorage.setItem('shahdara-isp-billing-v1', JSON.stringify(state));
  }, { month, lastMonth, fiveDaysAgo });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

const card = (page, id) => page.locator(`article.recovery-customer-card[data-recovery-customer="${id}"]`);

test.describe('Dues Recovery Overhaul', () => {
  test('recovery screen shows only the queue, with summary, filters and actionable cards', async ({ page }) => {
    const errors = trackErrors(page);
    await bootAndSeed(page);
    await page.goto('/#/recovery');
    await expect(page.locator('#billingReportsView')).toHaveAttribute('data-report-screen', 'recovery');
    await expect(page.locator('#duesRecoveryPanel')).toBeVisible();
    await expect(page.locator('#smartAlertsPanel')).toBeHidden();
    await expect(page.locator('#monthlyReportList')).toBeHidden();
    await expect(page.locator('main > article.summary-card:visible')).toHaveCount(0);
    await expect(page.locator('.sr-screen-subtitle')).toHaveText('Smart recovery triage and WhatsApp reminders');

    // Summary bar: 3 pending, PKR 6,500 recoverable, 2,000 arrears, 4,500 current.
    const summary = page.locator('#recoverySummaryBar');
    await expect(summary).toContainText('3 customer(s)');
    await expect(summary).toContainText('6,500');
    await expect(summary).toContainText('2,000');
    await expect(summary).toContainText('4,500');

    // Filter row: search, numbered mohalla dropdown, priority pills.
    await expect(page.locator('#recoverySearchInput')).toBeVisible();
    await expect(page.locator('#recoveryMohallaFilter')).toBeVisible();
    const mohallaOptions = page.locator('#recoveryMohallaFilter option');
    await expect(mohallaOptions.filter({ hasText: '2 · GANGALL' })).toHaveCount(1);
    await expect(mohallaOptions.filter({ hasText: 'PKR 1,000' })).toHaveCount(1);

    // Three cards, with actionable tags — never "Insufficient history".
    const cards = page.locator('article.recovery-customer-card');
    await expect(cards).toHaveCount(3);
    await expect(page.locator('#duesRecoveryGroups')).not.toContainText('Insufficient history');
    await expect(card(page, 'seed-rec-a')).toContainText('2 Months Unpaid');
    await expect(card(page, 'seed-rec-b')).toContainText('1st Month Due');
    await expect(card(page, 'seed-rec-a')).toContainText('4,000');

    // WhatsApp row: template select + green Send WhatsApp link to the
    // normalised +92 number for the saved 03xx phone.
    const waLink = card(page, 'seed-rec-a').locator('[data-recovery-draft="seed-rec-a"]');
    await expect(waLink).toBeVisible();
    await expect(waLink).toHaveAttribute('href', /^https:\/\/wa\.me\/923001234567\?text=/);
    await expect(card(page, 'seed-rec-a').locator('[data-recovery-template="seed-rec-a"]')).toBeVisible();

    // Priority pills narrow the list; empty groups render nothing.
    await page.locator('[data-recovery-priority="High Priority"]').click();
    await expect(page.locator('article.recovery-customer-card')).toHaveCount(2);
    await page.locator('[data-recovery-priority="waada"]').click();
    await expect(page.locator('article.recovery-customer-card')).toHaveCount(1);
    await expect(page.locator('article.recovery-customer-card').first()).toContainText('E2E Recovery Waada');
    await page.locator('[data-recovery-priority="all"]').click();
    await expect(page.locator('article.recovery-customer-card')).toHaveCount(3);

    // Search narrows by name; mohalla dropdown narrows to one street.
    await page.locator('#recoverySearchInput').fill('First');
    await expect(page.locator('article.recovery-customer-card')).toHaveCount(1);
    await page.locator('#recoverySearchInput').fill('');
    await page.locator('#recoveryMohallaFilter').selectOption({ label: '2 · GANGALL — 1 customer(s) · PKR 1,000' });
    await expect(page.locator('article.recovery-customer-card')).toHaveCount(1);
    await expect(page.locator('article.recovery-customer-card').first()).toContainText('E2E Recovery First');

    // No horizontal overflow at 360px and no page errors.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);
    expect(errors).toEqual([]);
  });

  test('Waada opens the promise dialog and Add Phone saves on the card', async ({ page }) => {
    const errors = trackErrors(page);
    await bootAndSeed(page);
    await page.goto('/#/recovery');
    await expect(page.locator('article.recovery-customer-card')).toHaveCount(3);

    // Waada: the promise dialog opens without leaving the list.
    await card(page, 'seed-rec-a').locator('[data-recovery-waada="seed-rec-a"]').click();
    await expect(page.locator('#waadaChipDialog')).toBeVisible();
    await page.locator('#waadaChipCloseBtn').click();
    await expect(page.locator('#waadaChipDialog')).toBeHidden();

    // Add Phone: the no-phone card offers the inline editor, saves
    // the number, and then offers the WhatsApp link for it.
    await expect(card(page, 'seed-rec-b').locator('[data-recovery-add-phone="seed-rec-b"]')).toBeVisible();
    await card(page, 'seed-rec-b').locator('[data-recovery-add-phone="seed-rec-b"]').click();
    const phoneInput = card(page, 'seed-rec-b').locator('[data-recovery-phone-input="seed-rec-b"]');
    await expect(phoneInput).toBeVisible();
    await phoneInput.fill('03001234567');
    await card(page, 'seed-rec-b').locator('[data-recovery-phone-save="seed-rec-b"]').click();
    await expect(card(page, 'seed-rec-b').locator('.recovery-phone-line')).toContainText('03001234567');
    const waLink = card(page, 'seed-rec-b').locator('[data-recovery-draft="seed-rec-b"]');
    await expect(waLink).toBeVisible();
    await expect(waLink).toHaveAttribute('href', /^https:\/\/wa\.me\/923001234567\?text=/);
    expect(errors).toEqual([]);
  });

  test('Collect opens Quick Collect pre-filled with the outstanding balance', async ({ page }) => {
    const errors = trackErrors(page);
    await bootAndSeed(page);
    await page.goto('/#/recovery');
    await expect(page.locator('article.recovery-customer-card')).toHaveCount(3);

    await card(page, 'seed-rec-a').locator('[data-recovery-collect="seed-rec-a"]').click();
    await expect(page.locator('#quickCollectModal')).toBeVisible();
    await expect(page.locator('#quickCollectAmountInput')).toBeVisible();
    await expect(page.locator('#quickCollectAmountInput')).toHaveValue('4000.00');
    expect(errors).toEqual([]);
  });
});
