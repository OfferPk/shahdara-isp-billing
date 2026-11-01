// SISP-124: Shop Unsettled Cash Aging (>5 Days / >=Rs. 15,000) Alert &
// WhatsApp Reminder. Pure-function tests on synthetic data only (fake shop
// names — shops are derived from recorded payments, never hardcoded).
// Spec pin: a shop with Rs. 18,000 unsettled cash OR 6 days since last
// handover displays the aging badge and generates an itemized reminder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SHOP_AGING_AMOUNT_THRESHOLD,
  SHOP_AGING_DAYS_THRESHOLD,
  buildShopSummaries,
  buildShopAging,
  shopAgingForSummary,
  shopAgingBadgeText,
  buildShopAgingReminderText,
  shopSettlementWhatsAppUrl
} from '../shop-settlement.js';
import { TRANSLATIONS } from '../nav-language.js';

const customer = (id, number, name, bills) => ({ id, customerNumber: number, name, bills });
const bill = (month, payments) => ({ month, payments });
const payment = (id, overrides) => ({ id, date: '2026-10-28', amount: 0, method: 'Cash', ...overrides });
const settlement = (shop, date, amount = 1000) => ({ id: `stl-${shop}-${date}`, shop, amount, date, note: '', allocations: [], createdAt: '' });

// 07:00 UTC = 12:00 PKT — "today" is 2026-10-29 in Pakistan time.
const REF = new Date(Date.UTC(2026, 9, 29, 7));

function agingOf(state, settlements, shop) {
  return buildShopAging(state, settlements, REF).find((a) => a.shop === shop);
}

test('thresholds are the spec values', () => {
  assert.equal(SHOP_AGING_AMOUNT_THRESHOLD, 15000);
  assert.equal(SHOP_AGING_DAYS_THRESHOLD, 5);
});

test('SPEC PIN (amount): Rs. 18,000 unsettled shows the aging badge + itemized reminder', () => {
  const state = { customers: [
    customer('c1', 11, 'Test Customer 11', [bill('2026-10', [
      payment('p1', { date: '2026-10-28', amount: 3000, method: 'Cash at Alpha shop' }),
      payment('p2', { date: '2026-10-28', amount: 3000, method: 'Cash at Alpha shop' }),
      payment('p3', { date: '2026-10-28', amount: 3000, method: 'Cash at Alpha shop' })
    ])]),
    customer('c2', 12, 'Test Customer 12', [bill('2026-10', [
      payment('p4', { date: '2026-10-28', amount: 3000, method: 'Cash at Alpha shop' }),
      payment('p5', { date: '2026-10-28', amount: 3000, method: 'Cash at Alpha shop' }),
      payment('p6', { date: '2026-10-28', amount: 3000, method: 'Cash at Alpha shop' })
    ])])
  ] };
  const settlements = [settlement('Alpha Shop', '2026-10-27')];
  const aging = agingOf(state, settlements, 'Alpha Shop');
  assert.equal(aging.unsettled, 18000);
  assert.equal(aging.amountAlert, true);
  assert.equal(aging.daysAlert, false);
  assert.equal(aging.daysWaiting, 2);
  assert.equal(aging.waitingBasis, 'handover');
  assert.equal(aging.level, 'amber');

  const badge = shopAgingBadgeText(aging, 'en');
  assert.ok(badge.includes('PKR 18,000'), badge);
  assert.ok(badge.includes('2 days'), badge);

  const text = buildShopAgingReminderText(state, aging, 'en');
  assert.ok(text.includes('Shop: Alpha Shop'), text);
  assert.ok(text.includes('Unsettled cash: PKR 18,000 (6 pending receipts)'), text);
  assert.ok(text.includes('Waiting 2 days since last handover (2026-10-27)'), text);
  assert.ok(text.includes('- #11 Test Customer 11 (2026-10-28): PKR 3,000'), text);
  assert.ok(text.includes('- #12 Test Customer 12 (2026-10-28): PKR 3,000'), text);
  assert.ok(text.includes('Total to hand over: PKR 18,000'), text);

  const url = shopSettlementWhatsAppUrl(text);
  assert.ok(url.startsWith('https://wa.me/?text='), url);
  assert.ok(decodeURIComponent(url).includes('Total to hand over: PKR 18,000'));
});

test('SPEC PIN (days): 6 days since last handover shows the badge + reminder', () => {
  const state = { customers: [
    customer('c1', 21, 'Test Customer 21', [bill('2026-10', [
      payment('p1', { date: '2026-10-25', amount: 2000, method: 'Cash at Alpha shop' }),
      payment('p2', { date: '2026-10-26', amount: 2000, method: 'Cash at Alpha shop' })
    ])])
  ] };
  const settlements = [settlement('Alpha Shop', '2026-10-23')];
  const aging = agingOf(state, settlements, 'Alpha Shop');
  assert.equal(aging.unsettled, 4000);
  assert.equal(aging.amountAlert, false);
  assert.equal(aging.daysWaiting, 6);
  assert.equal(aging.daysAlert, true);
  assert.equal(aging.level, 'amber');
  const text = buildShopAgingReminderText(state, aging, 'en');
  assert.ok(text.includes('Waiting 6 days since last handover (2026-10-23)'), text);
  assert.ok(text.includes('Total to hand over: PKR 4,000'), text);
});

test('both conditions together escalate to red', () => {
  const state = { customers: [
    customer('c1', 31, 'Test Customer 31', [bill('2026-10', [
      payment('p1', { date: '2026-10-28', amount: 9000, method: 'Cash at Alpha shop' }),
      payment('p2', { date: '2026-10-28', amount: 9000, method: 'Cash at Alpha shop' })
    ])])
  ] };
  const aging = agingOf(state, [settlement('Alpha Shop', '2026-10-20')], 'Alpha Shop');
  assert.equal(aging.amountAlert, true);
  assert.equal(aging.daysAlert, true);
  assert.equal(aging.daysWaiting, 9);
  assert.equal(aging.level, 'red');
});

test('below both thresholds: no badge, no highlight (card renders as before)', () => {
  const state = { customers: [
    customer('c1', 41, 'Test Customer 41', [bill('2026-10', [
      payment('p1', { date: '2026-10-28', amount: 4000, method: 'Cash at Alpha shop' })
    ])])
  ] };
  const aging = agingOf(state, [settlement('Alpha Shop', '2026-10-27')], 'Alpha Shop');
  assert.equal(aging.level, null);
  assert.equal(shopAgingBadgeText(aging, 'en'), '');
});

test('zero unsettled cash never alerts, however old the last handover is', () => {
  const state = { customers: [
    customer('c1', 51, 'Test Customer 51', [bill('2026-10', [
      payment('p1', { date: '2026-09-01', amount: 5000, method: 'Cash at Alpha shop', shopSettled: true })
    ])])
  ] };
  const aging = agingOf(state, [settlement('Alpha Shop', '2026-09-01')], 'Alpha Shop');
  assert.equal(aging.unsettled, 0);
  assert.equal(aging.level, null);
  assert.equal(aging.daysWaiting, null);
});

test('no handover on record: aging runs from the OLDEST unsettled receipt', () => {
  const state = { customers: [
    customer('c1', 61, 'Test Customer 61', [bill('2026-10', [
      payment('p1', { date: '2026-10-23', amount: 3000, method: 'Cash at Alpha shop' }),
      payment('p2', { date: '2026-10-28', amount: 3000, method: 'Cash at Alpha shop' })
    ])])
  ] };
  const aging = agingOf(state, [], 'Alpha Shop');
  assert.equal(aging.lastHandoverDate, null);
  assert.equal(aging.waitingBasis, 'oldest-receipt');
  assert.equal(aging.oldestUnsettledDate, '2026-10-23');
  assert.equal(aging.daysWaiting, 6);
  assert.equal(aging.level, 'amber');
  const text = buildShopAgingReminderText(state, aging, 'en');
  assert.ok(text.includes('No handover recorded yet — oldest pending receipt is from 2026-10-23 (6 days)'), text);

  // Fresh cash at a never-settled shop does not alert on days.
  const fresh = { customers: [
    customer('c1', 61, 'Test Customer 61', [bill('2026-10', [
      payment('p1', { date: '2026-10-29', amount: 3000, method: 'Cash at Alpha shop' })
    ])])
  ] };
  const freshAging = agingOf(fresh, [], 'Alpha Shop');
  assert.equal(freshAging.daysWaiting, 0);
  assert.equal(freshAging.level, null);
});

test('threshold boundaries: exactly Rs. 15,000 and exactly 5 days both alert', () => {
  const state = { customers: [
    customer('c1', 71, 'Test Customer 71', [bill('2026-10', [
      payment('p1', { date: '2026-10-28', amount: 15000, method: 'Cash at Alpha shop' })
    ])])
  ] };
  const atAmount = agingOf(state, [settlement('Alpha Shop', '2026-10-28')], 'Alpha Shop');
  assert.equal(atAmount.amountAlert, true);
  assert.equal(atAmount.level, 'amber');
  const atDays = agingOf(state, [settlement('Alpha Shop', '2026-10-24')], 'Alpha Shop');
  assert.equal(atDays.daysWaiting, 5);
  assert.equal(atDays.daysAlert, true);

  const justUnder = { customers: [
    customer('c1', 71, 'Test Customer 71', [bill('2026-10', [
      payment('p1', { date: '2026-10-28', amount: 14999, method: 'Cash at Alpha shop' })
    ])])
  ] };
  const under = agingOf(justUnder, [settlement('Alpha Shop', '2026-10-25')], 'Alpha Shop');
  assert.equal(under.amountAlert, false);
  assert.equal(under.daysAlert, false);
  assert.equal(under.level, null);
});

test('partially settled receipt: reminder lists the REMAINING cash only', () => {
  const state = { customers: [
    customer('c1', 81, 'Test Customer 81', [bill('2026-10', [
      payment('p1', { date: '2026-10-25', amount: 3000, method: 'Cash at Alpha shop', shopSettledAmount: 1000 })
    ])])
  ] };
  const aging = agingOf(state, [settlement('Alpha Shop', '2026-10-25')], 'Alpha Shop');
  assert.equal(aging.unsettled, 2000);
  const text = buildShopAgingReminderText(state, aging, 'en');
  assert.ok(text.includes('- #81 Test Customer 81 (2026-10-25): PKR 2,000'), text);
  assert.ok(!text.includes('PKR 3,000'), text);
  assert.ok(text.includes('Total to hand over: PKR 2,000'), text);
});

test('read-only: aging + reminder derivations mutate nothing', () => {
  const state = { customers: [
    customer('c1', 91, 'Test Customer 91', [bill('2026-10', [
      payment('p1', { date: '2026-10-24', amount: 20000, method: 'Cash at Alpha shop' })
    ])])
  ] };
  const settlements = [settlement('Alpha Shop', '2026-10-20')];
  const before = JSON.stringify({ state, settlements });
  const summaries = buildShopSummaries(state, settlements, REF);
  const aging = shopAgingForSummary(state, summaries[0], REF);
  buildShopAgingReminderText(state, aging, 'en');
  buildShopAgingReminderText(state, aging, 'ur');
  shopAgingBadgeText(aging, 'en');
  buildShopAging(state, settlements, REF);
  assert.equal(JSON.stringify({ state, settlements }), before);
});

test('shops are derived from recorded data (custom shops included, non-shop + voided ignored)', () => {
  const state = { customers: [
    customer('c1', 95, 'Test Customer 95', [bill('2026-10', [
      payment('p1', { date: '2026-10-28', amount: 20000, method: 'Cash at Zebra shop' }),
      payment('p2', { date: '2026-10-28', amount: 20000, method: 'Cash' }),
      payment('p3', { date: '2026-10-28', amount: 20000, method: 'JazzCash' }),
      payment('p4', { date: '2026-10-28', amount: 20000, method: 'Cash at Zebra shop', voided: true })
    ])])
  ] };
  const entries = buildShopAging(state, [], REF);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].shop, 'Zebra Shop');
  assert.equal(entries[0].unsettled, 20000);
  assert.equal(entries[0].level, 'amber');
});

test('i18n audit: every shopage_* key used exists in en + ur with matching placeholders; ur reminder has no raw keys', () => {
  const settleSrc = readFileSync(new URL('../shop-settlement.js', import.meta.url), 'utf8');
  const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const keys = new Set();
  for (const src of [settleSrc, appSrc]) {
    for (const m of src.matchAll(/t\('(shopage_[a-z_]+)'/g)) keys.add(m[1]);
  }
  assert.ok(keys.size >= 12, `expected >= 12 shopage keys, found ${keys.size}`);
  const paramsOf = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const key of keys) {
    assert.ok(TRANSLATIONS.en[key], `missing en: ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `missing ur: ${key}`);
    assert.notEqual(TRANSLATIONS.en[key], key);
    assert.deepEqual(paramsOf(TRANSLATIONS.ur[key]), paramsOf(TRANSLATIONS.en[key]), `placeholder parity: ${key}`);
  }
  const state = { customers: [
    customer('c1', 97, 'Test Customer 97', [bill('2026-10', [
      payment('p1', { date: '2026-10-28', amount: 18000, method: 'Cash at Alpha shop' })
    ])])
  ] };
  const aging = agingOf(state, [settlement('Alpha Shop', '2026-10-27')], 'Alpha Shop');
  const urText = buildShopAgingReminderText(state, aging, 'ur');
  assert.ok(!urText.includes('shopage_'), urText);
  assert.ok(/[\u0600-\u06FF]/.test(urText), 'ur reminder must contain Urdu script');
  assert.ok(urText.includes('PKR 18,000'), urText);
});

test('CSS pin: the SISP-124 components.css block uses theme tokens only (no hex)', () => {
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const start = css.indexOf('/* SISP-124');
  assert.ok(start >= 0, 'SISP-124 CSS block missing');
  const block = css.slice(start, css.indexOf('/* SISP-2', start));
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'hex color in SISP-124 CSS block');
  assert.ok(block.includes('var(--color-pending)'), block);
  assert.ok(block.includes('var(--color-overdue)'), block);
});

test('wiring pins: dashboard rows + modal cards consume the aging derivation', () => {
  const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(appSrc.includes('buildShopAging(state, loadShopSettlements(), referenceDate)'), 'app.js dashboard aging');
  assert.ok(appSrc.includes('shop-aging-badge'), 'app.js badge markup');
  const settleSrc = readFileSync(new URL('../shop-settlement.js', import.meta.url), 'utf8');
  assert.ok(settleSrc.includes('shop-settlement-card--aging-'), 'modal card aging class');
  assert.ok(settleSrc.includes('data-shop-aging-remind'), 'modal remind button');
  assert.ok(settleSrc.includes('buildShopAgingReminderText(state, aging)'), 'modal reminder build');
});
