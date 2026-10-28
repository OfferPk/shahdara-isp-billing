// SISP-22: Nasir & Aqib 50/50 Partner Drawings, Capital Outlay & Monthly
// Settlement Ledger. Written to run in CI (the repo Playwright runner
// cannot run in the dev VM). Seeds receipts + an expense through the
// app's own core helpers so the month has PKR 100,000 net profit, then
// checks the Settlement tab: a Rs. 15,000 Nasir drawing and a Rs. 10,000
// Aqib out-of-pocket purchase reconcile to net payouts of PKR 35,000 and
// PKR 60,000, the 1-click slip confirms and re-opens, the WhatsApp link
// carries both figures, and both record sets survive in localStorage.
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

async function seedProfitMonth(page) {
  await page.evaluate(async () => {
    const core = await import('./core.js');
    const phase3 = await import('./phase3.js');
    let s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    const [c0] = s.customers.slice(0, 1);
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const day = String(now.getDate()).padStart(2, '0');
    s = core.saveBillMonth(s, c0.id, { month, dueAmount: '150000', status: 'pending' });
    s = core.addPayment(s, c0.id, month, { date: `${month}-${day}`, amount: '150000', method: 'Cash' });
    s = phase3.addExpense(s, { date: `${month}-${day}`, amount: 50000, category: 'Electricity', notes: '' });
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(s));
  });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

test('settlement tab reconciles drawings and capital to 35,000 / 60,000 and confirms a slip', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedProfitMonth(page);

  await page.goto('/#/expenses');
  await page.waitForSelector('#expenseTabSettlement', { state: 'visible', timeout: 20000 });
  await page.click('#expenseTabSettlement');
  await expect(page.locator('#partnerSettlementPanel')).toBeVisible();
  await expect(page.locator('#partnerSettlementContent')).toContainText('PKR 100,000');
  await expect(page.locator('#partnerSettlementContent')).toContainText('PKR 50,000');

  // Nasir drawing of 15,000.
  await page.selectOption('#partnerLedgerPartner', 'Nasir');
  await page.selectOption('#partnerLedgerType', 'drawing');
  await page.fill('#partnerLedgerAmount', '15000');
  await page.click('#partnerLedgerSubmit');
  await expect(page.locator('#partnerLedgerTable')).toContainText('Nasir');
  await expect(page.locator('#partnerSettlementContent')).toContainText('PKR 35,000');

  // Aqib out-of-pocket purchase of 10,000.
  await page.selectOption('#partnerLedgerPartner', 'Aqib');
  await page.selectOption('#partnerLedgerType', 'capital');
  await page.fill('#partnerLedgerAmount', '10000');
  await page.fill('#partnerLedgerNote', 'ONU purchase');
  await page.click('#partnerLedgerSubmit');
  await expect(page.locator('#partnerSettlementContent')).toContainText('PKR 60,000');
  await expect(page.locator('#partnerLedgerTable')).toContainText('ONU purchase');

  // WhatsApp summary carries both net payouts.
  const href = await page.getAttribute('#partnerSettlementWhatsAppLink', 'href');
  expect(decodeURIComponent(href)).toContain('35,000');
  expect(decodeURIComponent(href)).toContain('60,000');

  // 1-click slip: confirm, then re-open.
  await page.click('#partnerSettlementConfirmBtn');
  await expect(page.locator('#partnerSettlementStatus')).toContainText('confirmed');
  await page.click('#partnerSettlementReopenBtn');
  await expect(page.locator('#partnerSettlementStatus')).toContainText('re-opened');

  const storedLedger = await page.evaluate(() => localStorage.getItem('sisp_partner_ledger_v1'));
  expect(JSON.parse(storedLedger)).toHaveLength(2);
  const storedSlips = await page.evaluate(() => localStorage.getItem('sisp_partner_settlements_v1'));
  expect(JSON.parse(storedSlips)).toHaveLength(1);
  expect(JSON.parse(storedSlips)[0].status).toBe('reopened');

  // No horizontal overflow at 390px in the settlement panel.
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  expect(errors).toEqual([]);
});
