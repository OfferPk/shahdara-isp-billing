// SISP-105: Monthly Shop Collector Passbook Statement.
// Pure-function tests on synthetic data only. Spec test criteria:
// generating Waseem Shop's October statement with Rs. 30,000 collected
// and Rs. 28,000 handed over reports Rs. 2,000 closing unsettled cash
// and lists all ledger rows. (The checklist copy of this phase in the
// spec carries a stray "CMP-110" criteria line that belongs to
// SISP-104 — a spec copy/paste error, ignored here.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildShopPassbook,
  listShopPassbookShops,
  generateShopPassbookText,
  generateShopPassbookThermalText,
  generateShopPassbookPrintHtml,
  buildShopSummaries,
  applySettlement,
  sanitizeShopSettlements
} from '../shop-settlement.js';
import { TRANSLATIONS, t } from '../nav-language.js';

const customer = (id, number, name, bills) => ({ id, customerNumber: number, name, bills });
const bill = (month, payments) => ({ month, payments });
const payment = (id, overrides) => ({ id, date: '2026-10-06', amount: 0, method: 'Cash', ...overrides });
const WASEEM = 'Cash at Waseem Abbasi shop';
const WASEEM_SHOP = 'Waseem Abbasi Shop';

/** Spec-pin fixture: October collections of exactly Rs. 30,000 at Waseem. */
function octoberFixture() {
  const state = {
    customers: [
      customer('c1', 11, 'Synthetic Customer Eleven', [
        bill('2026-10', [
          payment('p1', { date: '2026-10-03', amount: 12000, method: WASEEM, receiptNumber: 'RCPT-11-202610-01' }),
          payment('p2', { date: '2026-10-11', amount: 8000, method: WASEEM })
        ])
      ]),
      customer('c2', 12, 'Synthetic Customer Twelve', [
        bill('2026-10', [
          payment('p3', { date: '2026-10-19', amount: 10000, method: WASEEM })
        ])
      ]),
      customer('c3', 13, 'Synthetic Hassan Customer', [
        bill('2026-10', [
          payment('p4', { date: '2026-10-05', amount: 7000, method: 'Cash at Hassan shop' })
        ])
      ])
    ]
  };
  const settlements = [
    { id: 'shop-settle-oct-1', shop: WASEEM_SHOP, amount: 28000, date: '2026-10-25', note: 'Cash received at home', allocations: [], createdAt: '2026-10-25T10:00:00.000Z' }
  ];
  return { state, settlements };
}

test('SISP-105 spec pin: Rs. 30,000 collected, Rs. 28,000 handed over → Rs. 2,000 closing', () => {
  const { state, settlements } = octoberFixture();
  const book = buildShopPassbook(state, settlements, WASEEM_SHOP, '2026-10');
  assert.equal(book.shop, WASEEM_SHOP);
  assert.equal(book.month, '2026-10');
  assert.equal(book.monthLabel, 'October 2026');
  assert.equal(book.openingUnsettled, 0);
  assert.equal(book.totalCollected, 30000);
  assert.equal(book.totalHandedOver, 28000);
  assert.equal(book.closingUnsettled, 2000);
  // All ledger rows listed: 3 collections + 1 handover, chronological.
  assert.equal(book.rows.length, 4);
  assert.deepEqual(book.rows.map((r) => r.type), ['collection', 'collection', 'collection', 'handover']);
  assert.deepEqual(book.rows.map((r) => r.date), ['2026-10-03', '2026-10-11', '2026-10-19', '2026-10-25']);
  assert.deepEqual(book.rows.map((r) => r.balance), [12000, 20000, 30000, 2000]);
  // Rows carry their real references — never invented ones.
  assert.equal(book.rows[0].receiptRef, 'RCPT-11-202610-01', 'stored receiptNumber wins');
  assert.equal(book.rows[1].receiptRef, 'p2', 'falls back to the payment ledger id');
  assert.equal(book.rows[3].settlementId, 'shop-settle-oct-1');
  // Only Waseem rows appear — the Hassan collection stays out.
  assert.ok(book.rows.every((r) => r.type !== 'collection' || r.customerName !== 'Synthetic Hassan Customer'));
});

test('opening balance: a September collection with no handover carries into October', () => {
  const state = {
    customers: [
      customer('c1', 11, 'Synthetic Customer Eleven', [
        bill('2026-09', [payment('s1', { date: '2026-09-14', amount: 5000, method: WASEEM })]),
        bill('2026-10', [payment('o1', { date: '2026-10-04', amount: 3000, method: WASEEM })])
      ])
    ]
  };
  const settlements = [
    { id: 'shop-settle-sep-1', shop: WASEEM_SHOP, amount: 1500, date: '2026-09-28', note: '', allocations: [], createdAt: '2026-09-28T09:00:00.000Z' }
  ];
  const book = buildShopPassbook(state, settlements, WASEEM_SHOP, '2026-10');
  assert.equal(book.openingUnsettled, 3500, 'September: 5,000 collected − 1,500 handed over');
  assert.equal(book.rows.length, 1, 'only the October row is listed');
  assert.equal(book.rows[0].balance, 6500);
  assert.equal(book.closingUnsettled, 6500);
  // September's own statement closes at the same figure October opens with.
  const sept = buildShopPassbook(state, settlements, WASEEM_SHOP, '2026-09');
  assert.equal(sept.openingUnsettled, 0);
  assert.equal(sept.closingUnsettled, 3500);
  assert.equal(sept.rows.length, 2);
});

test('closing identity: passbook closing equals the live summary unsettled on a consistent ledger', () => {
  const { state } = octoberFixture();
  // Record the Rs. 28,000 handover through the module's own settlement
  // path so payment markers and the settlement record agree, exactly as
  // the live app keeps them.
  const { state: settledState, settlement } = applySettlement(state, WASEEM_SHOP, 28000, '2026-10-25');
  const settlements = [settlement];
  const book = buildShopPassbook(settledState, settlements, WASEEM_SHOP, '2026-10');
  const summary = buildShopSummaries(settledState, settlements, new Date(Date.UTC(2026, 9, 27, 7)))
    .find((s) => s.shop === WASEEM_SHOP);
  assert.equal(summary.unsettled, 2000, 'live summary nets the marked payments');
  assert.equal(book.closingUnsettled, summary.unsettled, 'passbook closing is the same figure, derived monthly');
  assert.equal(book.openingUnsettled + book.totalCollected - book.totalHandedOver, book.closingUnsettled);
});

test('voided payments never count as collected (SISP-34)', () => {
  const state = {
    customers: [
      customer('c1', 11, 'Synthetic Customer Eleven', [
        bill('2026-10', [
          payment('p1', { date: '2026-10-03', amount: 4000, method: WASEEM }),
          payment('p2', { date: '2026-10-04', amount: 9999, method: WASEEM, voided: true })
        ])
      ])
    ]
  };
  const book = buildShopPassbook(state, [], WASEEM_SHOP, '2026-10');
  assert.equal(book.totalCollected, 4000);
  assert.equal(book.rows.length, 1);
  assert.equal(book.rows[0].paymentId, 'p1');
  assert.equal(book.closingUnsettled, 4000);
});

test('SISP-68 partner pickup: handover counts and carries its Received Into attribution', () => {
  const { state } = octoberFixture();
  const settlements = [
    {
      id: 'shop-settle-pickup-1', shop: WASEEM_SHOP, amount: 5000, date: '2026-10-26',
      note: '', allocations: [], createdAt: '2026-10-26T08:00:00.000Z',
      // SISP-68 stores the enum value; the label is a display resolution.
      receivedInto: 'nasir'
    }
  ];
  const book = buildShopPassbook(state, settlements, WASEEM_SHOP, '2026-10');
  assert.equal(book.totalHandedOver, 5000, 'a pickup is cash out of the shop — it counts as handed over');
  const row = book.rows.find((r) => r.type === 'handover');
  assert.equal(row.receivedInto, 'Kept by Nasir (Partner Drawing)');
  assert.match(generateShopPassbookText(book), /Received into: Kept by Nasir \(Partner Drawing\)/);
  // The sanitizer preserves the attribution (SISP-68 enum) so backups keep it.
  const cleaned = sanitizeShopSettlements(settlements);
  assert.equal(cleaned[0].receivedInto, 'nasir');
  // …and leaves records without one untouched (no key invented).
  const plain = sanitizeShopSettlements([{ id: 'x', shop: WASEEM_SHOP, amount: 100, date: '2026-10-01' }]);
  assert.ok(!('receivedInto' in plain[0]));
});

test('empty month: opening carries in, zero rows, closing equals opening — never an error', () => {
  const state = {
    customers: [
      customer('c1', 11, 'Synthetic Customer Eleven', [
        bill('2026-09', [payment('s1', { date: '2026-09-10', amount: 2500, method: WASEEM })])
      ])
    ]
  };
  const book = buildShopPassbook(state, [], WASEEM_SHOP, '2026-11');
  assert.equal(book.openingUnsettled, 2500);
  assert.equal(book.rows.length, 0);
  assert.equal(book.totalCollected, 0);
  assert.equal(book.totalHandedOver, 0);
  assert.equal(book.closingUnsettled, 2500);
  assert.match(generateShopPassbookText(book), /No collections or handovers recorded/);
  assert.match(generateShopPassbookPrintHtml({ passbook: book }), /No collections or handovers recorded/);
});

test('shops come from the data, never hardcoded (SISP-75 precedent)', () => {
  const state = {
    customers: [
      customer('c1', 21, 'Synthetic Town Customer', [
        bill('2026-10', [payment('p1', { date: '2026-10-02', amount: 1500, method: 'Cash at New Town shop' })])
      ]),
      customer('c2', 22, 'Synthetic Plain Customer', [
        bill('2026-10', [payment('p2', { date: '2026-10-02', amount: 1500, method: 'Cash' })])
      ])
    ]
  };
  const settlements = [
    { id: 'shop-settle-ghost', shop: 'Settlement Only Shop', amount: 900, date: '2026-10-09', note: '', allocations: [], createdAt: '2026-10-09T00:00:00.000Z' }
  ];
  const shops = listShopPassbookShops(state, settlements);
  assert.deepEqual(shops, ['New Town Shop', 'Settlement Only Shop']);
  // A shop known only from a settlement record still gets an honest statement.
  const book = buildShopPassbook(state, settlements, 'Settlement Only Shop', '2026-10');
  assert.equal(book.rows.length, 1);
  assert.equal(book.rows[0].type, 'handover');
  assert.equal(book.closingUnsettled, -900);
});

test('same-date ordering: collections list before handovers, running balance follows', () => {
  const state = {
    customers: [
      customer('c1', 11, 'Synthetic Customer Eleven', [
        bill('2026-10', [payment('p1', { date: '2026-10-15', amount: 6000, method: WASEEM })])
      ])
    ]
  };
  const settlements = [
    { id: 'shop-settle-same-day', shop: WASEEM_SHOP, amount: 6000, date: '2026-10-15', note: '', allocations: [], createdAt: '2026-10-15T18:00:00.000Z' }
  ];
  const book = buildShopPassbook(state, settlements, WASEEM_SHOP, '2026-10');
  assert.deepEqual(book.rows.map((r) => r.type), ['collection', 'handover']);
  assert.deepEqual(book.rows.map((r) => r.balance), [6000, 0]);
  assert.equal(book.closingUnsettled, 0);
});

test('read-only: building a passbook never mutates state or settlements', () => {
  const { state, settlements } = octoberFixture();
  const stateBefore = JSON.stringify(state);
  const settlementsBefore = JSON.stringify(settlements);
  buildShopPassbook(state, settlements, WASEEM_SHOP, '2026-10');
  generateShopPassbookText(buildShopPassbook(state, settlements, WASEEM_SHOP, '2026-10'));
  assert.equal(JSON.stringify(state), stateBefore);
  assert.equal(JSON.stringify(settlements), settlementsBefore);
});

test('plain text statement carries shop, month, figures and real refs', () => {
  const { state, settlements } = octoberFixture();
  const book = buildShopPassbook(state, settlements, WASEEM_SHOP, '2026-10');
  const text = generateShopPassbookText(book);
  assert.match(text, /Shop Passbook Statement/);
  assert.match(text, /Waseem Abbasi Shop/);
  assert.match(text, /October 2026 \(2026-10\)/);
  assert.match(text, /RCPT-11-202610-01/);
  assert.match(text, /Synthetic Customer Eleven/);
  assert.match(text, /shop-settle-oct-1/);
  assert.match(text, /Collected this month: PKR 30,000/);
  assert.match(text, /Handed over this month: PKR 28,000/);
  assert.match(text, /Closing unsettled cash: PKR 2,000/);
});

test('thermal text: every line fits the 58mm width and the closing figure survives', () => {
  const { state, settlements } = octoberFixture();
  const book = buildShopPassbook(state, settlements, WASEEM_SHOP, '2026-10');
  const thermal = generateShopPassbookThermalText(book);
  for (const line of thermal.split('\n')) {
    assert.ok(line.length <= 32, `line exceeds 32 chars (${line.length}): ${line}`);
  }
  assert.match(thermal, /PKR 2,000/);
  assert.match(thermal, /SHAHDARA ISP BILLING/);
});

test('A4 print HTML: standalone black-on-white document with the full table', () => {
  const { state, settlements } = octoberFixture();
  const book = buildShopPassbook(state, settlements, WASEEM_SHOP, '2026-10');
  const html = generateShopPassbookPrintHtml({ passbook: book, generatedDate: '2026-10-29' });
  assert.match(html, /<!DOCTYPE html>/);
  assert.match(html, /size: A4/);
  assert.match(html, /color: #111/);
  assert.match(html, /<table>/);
  assert.match(html, /Waseem Abbasi Shop/);
  assert.match(html, /RCPT-11-202610-01/);
  assert.match(html, /shop-settle-oct-1/);
  assert.match(html, /PKR 30,000/);
  assert.match(html, /PKR 28,000/);
  assert.match(html, /PKR 2,000/);
  assert.match(html, /Generated on 2026-10-29/);
});

test('Urdu rendering: labels follow the language, figures and refs stay as recorded', () => {
  const { state, settlements } = octoberFixture();
  const book = buildShopPassbook(state, settlements, WASEEM_SHOP, '2026-10');
  const text = generateShopPassbookText(book, { lang: 'ur' });
  assert.match(text, /دکان پاس بک اسٹیٹمنٹ/);
  assert.match(text, /اختتامی غیر تصفیہ شدہ نقدی: PKR 2,000/);
  assert.match(text, /RCPT-11-202610-01/, 'receipt refs are never translated');
});

test('i18n audit: every shop_passbook_* key used in code exists in en + ur and resolves', () => {
  const source = readFileSync(new URL('../shop-settlement.js', import.meta.url), 'utf8');
  const used = new Set();
  for (const match of source.matchAll(/t\('(shop_passbook_[a-z_]+)'/g)) used.add(match[1]);
  assert.ok(used.size >= 20, `expected the passbook to use 20+ keys, found ${used.size}`);
  for (const key of used) {
    assert.ok(Object.hasOwn(TRANSLATIONS.en, key), `en missing ${key}`);
    assert.ok(Object.hasOwn(TRANSLATIONS.ur, key), `ur missing ${key}`);
    assert.notEqual(t(key, 'en'), key, `en resolves ${key}`);
    assert.notEqual(t(key, 'ur'), key, `ur resolves ${key}`);
  }
  // Full prefix parity: no key exists in one dictionary only.
  const enKeys = Object.keys(TRANSLATIONS.en).filter((k) => k.startsWith('shop_passbook_'));
  const urKeys = Object.keys(TRANSLATIONS.ur).filter((k) => k.startsWith('shop_passbook_'));
  assert.deepEqual(urKeys.sort(), enKeys.sort());
});

test('wiring: index.html carries the passbook container inside the settlement modal', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const modalStart = html.indexOf('id="shopSettlementModal"');
  const passbookAt = html.indexOf('id="shopPassbookSection"');
  assert.ok(modalStart !== -1 && passbookAt > modalStart, 'passbook section lives inside the shop settlement modal');
});
