// Owner Assistant (Owner Command Center) — smart local answers E2E.
// Seeds a tiny ledger through the app's own core helpers, then drives the
// real Assistant screen: a new intent (new customers — the owner's original
// screenshot question), a who-paid list, and the suggestion-chip fallback.
import { test, expect } from '@playwright/test';
import * as core from '../../core.js';
import * as phase3 from '../../phase3.js';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) errors.push(m.text()); });
  return errors;
}

async function seedLedger(page) {
  const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  let s = core.createInitialState(['E2E Ali', 'E2E Bilal']);
  s = {
    ...s,
    customers: s.customers.map(c => c.name === 'E2E Ali'
      ? { ...c, packageSpeed: '10 Mbps', mohalla: 'E2E Mohalla', serviceStatus: 'active', addedOn: today, connectionDate: null }
      : { ...c, packageSpeed: '10 Mbps', mohalla: 'E2E Mohalla', serviceStatus: 'active', addedOn: '2020-01-01', connectionDate: null })
  };
  const [ali, bilal] = s.customers;
  s = core.saveBillMonth(s, ali.id, { month, dueAmount: 1500, status: 'pending' });
  s = core.saveBillMonth(s, bilal.id, { month, dueAmount: 1500, status: 'pending' });
  s = core.addPayment(s, bilal.id, month, { date: today, amount: 1500, method: 'JazzCash' });
  s = phase3.addExpense(s, { date: today, amount: '200', category: 'Cable', notes: '' }, new Date());

  await page.goto('/');
  await page.evaluate(({ key, state }) => {
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify(state));
  }, { key: core.STORAGE_KEY, state: s });
  await page.reload();
}

async function openAssistant(page, isMobile) {
  if (isMobile) {
    await page.locator('#mobileMoreButton').click();
    await page.locator('[data-mobile-more="assistant"]').click();
  } else {
    await page.goto('/#/assistant');
  }
  await expect(page.locator('#ownerCommandCenter')).toBeVisible();
  await expect(page.locator('#ownerCommandInput')).toBeVisible();
}

async function ask(page, question) {
  await page.locator('#ownerCommandInput').fill(question);
  await page.locator('#ownerCommandForm button[type="submit"]').click();
}

test.describe('Owner Assistant smart answers', () => {
  test.beforeEach(async ({ page }) => { await seedLedger(page); });

  test('screenshot question "Ajj kon sy new customers add hovy?" gets a real answer, not help text', async ({ page, isMobile }) => {
    const errors = trackErrors(page);
    await openAssistant(page, isMobile);
    await ask(page, 'Ajj kon sy new customers add hovy?');
    const answer = page.locator('#ownerCommandAnswer');
    await expect(answer).toContainText('1 new customer(s) added');
    await expect(answer).toContainText('E2E Ali');
    await expect(answer).not.toContainText('Only saved local records are queried');
    expect(errors).toEqual([]);
  });

  test('who-paid question lists the payer with amount and method', async ({ page, isMobile }) => {
    const errors = trackErrors(page);
    await openAssistant(page, isMobile);
    await ask(page, 'aaj kis kis ne payment di?');
    const answer = page.locator('#ownerCommandAnswer');
    await expect(answer).toContainText('1 payment(s) received');
    await expect(answer).toContainText('E2E Bilal');
    await expect(answer).toContainText('JazzCash');
    expect(errors).toEqual([]);
  });

  test('unknown question offers tappable suggestion chips that run real questions', async ({ page, isMobile }) => {
    const errors = trackErrors(page);
    await openAssistant(page, isMobile);
    await ask(page, 'weather kaisa hai?');
    const answer = page.locator('#ownerCommandAnswer');
    await expect(answer).toContainText('could not match');
    const chips = page.locator('.owner-suggestion-chip');
    await expect(chips.first()).toBeVisible();
    expect(await chips.count()).toBeGreaterThanOrEqual(3);
    const chipText = (await chips.first().textContent()).trim();
    await chips.first().click();
    await expect(page.locator('#ownerCommandInput')).toHaveValue(chipText);
    await expect(answer).not.toContainText('could not match');
    expect(errors).toEqual([]);
  });

  test('command center keeps its local-only, read-only promise labels', async ({ page, isMobile }) => {
    const errors = trackErrors(page);
    await openAssistant(page, isMobile);
    await expect(page.locator('#ownerCommandCenter')).toContainText('LOCAL-ONLY · READ-ONLY ANSWERS');
    await expect(page.locator('#ownerCommandCenter')).toContainText('Nothing is edited by a question.');
    expect(errors).toEqual([]);
  });
});
