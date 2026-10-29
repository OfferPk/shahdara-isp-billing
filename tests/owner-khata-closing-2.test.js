// SISP-51: Owner Khata Closing Report 2.0 — Payment Channel Split &
// Closing Roznamcha Cash-in-Hand (enhancing SISP-20). The split is
// pinned against the partner report's own collected total (same
// payment enumeration, phase3.js paymentEntries), and the drawer
// balance against roznamcha.js's own closed-day chain. Pure
// computation, synthetic data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DIRECT_CASH_CHANNEL,
  buildOwnerKhataPrintHtml,
  buildOwnerKhataReport,
  buildOwnerKhataWhatsAppText,
  classifyPaymentChannel
} from '../owner-khata.js';
import { buildMonthEndCashInHand } from '../roznamcha.js';
import { TRANSLATIONS, t } from '../nav-language.js';

const REF = new Date('2026-11-15T12:00:00Z');

function specState() {
  // The spec test ledger: Rs. 10,000 collected in October 2026 via
  // Direct Cash 4,000 + Waseem Shop 3,000 + EasyPaisa 3,000.
  return {
    customers: [
      { id: 'c1', customerNumber: 1, name: 'Ali', bills: [
        { month: '2026-10', dueAmount: 10000, payments: [
          { id: 'p1', date: '2026-10-05', amount: 4000, method: 'Cash' },
          { id: 'p2', date: '2026-10-06', amount: 3000, method: 'Cash at Waseem shop' },
          { id: 'p3', date: '2026-10-07', amount: 3000, method: 'Easypaisa' },
        ] },
      ] },
    ],
    expenses: [],
  };
}

function build(state, overrides = {}) {
  return buildOwnerKhataReport(state, '2026-10', { referenceDate: REF, ...overrides });
}

function channelOf(report, channel) {
  return report.collectionChannels.find((row) => row.channel === channel);
}

test('SISP-51 spec: Rs. 10,000 splits into Direct Cash 4,000 / Waseem Shop 3,000 / EasyPaisa 3,000', () => {
  const report = build(specState());
  assert.equal(report.collected, 10000);
  assert.deepEqual(channelOf(report, DIRECT_CASH_CHANNEL), { channel: 'Direct Cash', kind: 'cash', amount: 4000, count: 1 });
  assert.deepEqual(channelOf(report, 'Waseem Abbasi Shop'), { channel: 'Waseem Abbasi Shop', kind: 'shop', amount: 3000, count: 1 });
  assert.deepEqual(channelOf(report, 'Easypaisa'), { channel: 'Easypaisa', kind: 'wallet', amount: 3000, count: 1 });
  // The split is a breakdown OF the collected total — never above or below it.
  assert.equal(report.collectionChannels.reduce((sum, row) => sum + row.amount, 0), report.collected);
  assert.equal(report.collectionChannels.reduce((sum, row) => sum + row.count, 0), report.receiptCount);
});

test('SISP-51: every channel kind lands exactly once (shops, wallets, fallbacks)', () => {
  const state = {
    customers: [
      { id: 'c1', customerNumber: 1, name: 'Ali', bills: [
        { month: '2026-10', dueAmount: 99999, payments: [
          { id: 'p1', date: '2026-10-02', amount: 1000, method: 'Cash at Hassan shop' },
          { id: 'p2', date: '2026-10-03', amount: 2000, method: 'Cash', paidBy: 'Hassan' },
          { id: 'p3', date: '2026-10-04', amount: 500, method: 'Cash at Balla shop' },
          { id: 'p4', date: '2026-10-05', amount: 700, method: 'JazzCash' },
          { id: 'p5', date: '2026-10-06', amount: 800, method: 'NayaPay' },
          { id: 'p6', date: '2026-10-07', amount: 900, method: 'Bank Transfer' },
          { id: 'p7', date: '2026-10-08', amount: 300, method: 'Raast' },
          { id: 'p8', date: '2026-10-09', amount: 400, method: 'Cheque' },
          { id: 'p9', date: '2026-10-10', amount: 600 },
          { id: 'p10', date: '2026-09-30', amount: 5000, method: 'Cash' },
        ] },
      ] },
    ],
    expenses: [],
  };
  const report = build(state);
  // Hassan is reached both via the "Cash at" method and via paidBy.
  assert.deepEqual(channelOf(report, 'Hassan Shop'), { channel: 'Hassan Shop', kind: 'shop', amount: 3000, count: 2 });
  assert.deepEqual(channelOf(report, 'Balla Shop'), { channel: 'Balla Shop', kind: 'shop', amount: 500, count: 1 });
  assert.equal(channelOf(report, 'JazzCash').amount, 700);
  assert.equal(channelOf(report, 'NayaPay').amount, 800);
  assert.equal(channelOf(report, 'Bank Transfer').amount, 900);
  assert.equal(channelOf(report, 'Raast').amount, 300);
  // Unknown + missing methods are direct collections, never dropped;
  // the September payment stays out of the October split.
  assert.deepEqual(channelOf(report, DIRECT_CASH_CHANNEL), { channel: 'Direct Cash', kind: 'cash', amount: 1000, count: 2 });
  assert.equal(report.collected, 7200);
  assert.equal(report.collectionChannels.reduce((sum, row) => sum + row.amount, 0), report.collected);
  assert.equal(report.collectionChannels.reduce((sum, row) => sum + row.count, 0), report.receiptCount);
});

test('SISP-51: split follows the collected basis exactly, even with a voided receipt present', () => {
  // The partner-share basis (which `collected` reuses verbatim) counts
  // receipts by payment date over paymentEntries — the split enumerates
  // the same set, so the two can never disagree inside one report.
  const state = specState();
  state.customers[0].bills[0].payments.push(
    { id: 'p9', date: '2026-10-09', amount: 1500, method: 'JazzCash', voided: true }
  );
  const report = build(state);
  assert.equal(report.collected, 11500);
  assert.equal(report.collectionChannels.reduce((sum, row) => sum + row.amount, 0), report.collected);
  assert.equal(report.collectionChannels.reduce((sum, row) => sum + row.count, 0), report.receiptCount);
});

test('SISP-51: classifyPaymentChannel pins (shop beats wallet beats cash)', () => {
  assert.deepEqual(classifyPaymentChannel({ method: 'Cash at Waseem shop' }), { channel: 'Waseem Abbasi Shop', kind: 'shop' });
  assert.deepEqual(classifyPaymentChannel({ method: 'Cash', paidBy: 'Waseem Abbasi' }), { channel: 'Waseem Abbasi Shop', kind: 'shop' });
  assert.deepEqual(classifyPaymentChannel({ method: 'easypaisa' }), { channel: 'Easypaisa', kind: 'wallet' });
  assert.deepEqual(classifyPaymentChannel({ method: 'Cash' }), { channel: 'Direct Cash', kind: 'cash' });
  assert.deepEqual(classifyPaymentChannel({}), { channel: 'Direct Cash', kind: 'cash' });
  assert.deepEqual(classifyPaymentChannel(null), { channel: 'Direct Cash', kind: 'cash' });
  // A custom shop collector derived from the data is never dropped.
  assert.deepEqual(classifyPaymentChannel({ method: 'Cash at Rahim shop' }), { channel: 'Rahim Shop', kind: 'shop' });
});

test('SISP-51: invalid month zeroes the 2.0 fields alongside the 1.0 ones', () => {
  const report = buildOwnerKhataReport(specState(), 'not-a-month', { referenceDate: REF });
  assert.equal(report.validMonth, false);
  assert.deepEqual(report.collectionChannels, []);
  assert.equal(report.closingCashInHand, null);
});

test('SISP-51 drawer: a closed month-end day returns its frozen counted balance untouched', () => {
  const days = [
    { date: '2026-10-31', closed: true, openingBalance: 9000, cashIn: 4000, shopIn: 0,
      cashPayments: [], handovers: [], outflows: [], expectedClosing: 13000,
      closingBalance: 12750, countedCash: 12750, discrepancy: -250 },
  ];
  const drawer = buildMonthEndCashInHand(specState(), days, '2026-10', []);
  assert.deepEqual(drawer, { monthEndDate: '2026-10-31', balance: 12750, lastClosedDate: '2026-10-31', monthEndClosed: true });
});

test('SISP-51 drawer: open days after the last close roll forward (cash in + handovers in − outflows out)', () => {
  const state = specState();
  const days = [
    { date: '2026-10-30', closed: true, openingBalance: 2000, cashIn: 0, shopIn: 0,
      cashPayments: [], handovers: [], outflows: [], expectedClosing: 2000,
      closingBalance: 2500, countedCash: 2500, discrepancy: 500 },
    { date: '2026-10-31', closed: false, outflows: [
      { id: 'o1', category: 'Petrol / Bike Fuel', amount: 200, lineman: '', note: '' },
    ] },
  ];
  const settlements = [{ id: 's1', shop: 'Waseem Abbasi Shop', amount: 3000, date: '2026-10-31' }];
  const drawer = buildMonthEndCashInHand(state, days, '2026-10', settlements);
  // 2,500 counted at the 30th close + 3,000 handover on the 31st − 200 outflow.
  assert.deepEqual(drawer, { monthEndDate: '2026-10-31', balance: 5300, lastClosedDate: '2026-10-30', monthEndClosed: false });

  // The report carries the same figure.
  const report = build(state, { settlements, roznamchaDays: days });
  assert.deepEqual(report.closingCashInHand, { balance: 5300, monthEndDate: '2026-10-31', lastClosedDate: '2026-10-30', monthEndClosed: false });
});

test('SISP-51 drawer: direct cash after the anchor counts; voided cash and pre-anchor open days do not double-count', () => {
  const state = {
    customers: [
      { id: 'c1', customerNumber: 1, name: 'Ali', bills: [
        { month: '2026-10', dueAmount: 9999, payments: [
          { id: 'p1', date: '2026-10-31', amount: 1000, method: 'Cash' },
          { id: 'p2', date: '2026-10-31', amount: 9000, method: 'Cash', voided: true },
          { id: 'p3', date: '2026-10-31', amount: 7000, method: 'Easypaisa' },
        ] },
      ] },
    ],
    expenses: [],
  };
  const days = [
    // An open day BEFORE the anchor: its outflow is history the counted
    // anchor already supersedes — it must not be subtracted again.
    { date: '2026-10-10', closed: false, outflows: [
      { id: 'o0', category: 'Other', amount: 700, lineman: '', note: '' },
    ] },
    { date: '2026-10-30', closed: true, openingBalance: 0, cashIn: 0, shopIn: 0,
      cashPayments: [], handovers: [], outflows: [], expectedClosing: 0,
      closingBalance: 2500, countedCash: 2500, discrepancy: 0 },
  ];
  const drawer = buildMonthEndCashInHand(state, days, '2026-10', []);
  // 2,500 anchor + 1,000 live cash on the 31st. The voided 9,000 is not
  // drawer cash (SISP-34), and wallet money never enters the drawer.
  assert.equal(drawer.balance, 3500);
  assert.equal(drawer.monthEndClosed, false);
});

test('SISP-51 drawer: with no closed day ever, every recorded drawer flow through month-end counts from empty', () => {
  const state = {
    customers: [
      { id: 'c1', customerNumber: 1, name: 'Ali', bills: [
        { month: '2026-09', dueAmount: 9999, payments: [
          { id: 'p1', date: '2026-09-15', amount: 1000, method: 'Cash' },
        ] },
        { month: '2026-10', dueAmount: 9999, payments: [
          { id: 'p2', date: '2026-10-05', amount: 2000, method: 'Cash' },
          { id: 'p3', date: '2026-11-02', amount: 5000, method: 'Cash' },
        ] },
      ] },
    ],
    expenses: [],
  };
  const settlements = [{ id: 's1', shop: 'Hassan Shop', amount: 500, date: '2026-10-20' }];
  const drawer = buildMonthEndCashInHand(state, [], '2026-10', settlements);
  // 1,000 (Sep) + 2,000 (Oct) cash + 500 handover; the November cash is
  // after month-end and stays out.
  assert.deepEqual(drawer, { monthEndDate: '2026-10-31', balance: 3500, lastClosedDate: '', monthEndClosed: false });
});

test('SISP-51 drawer: a close dated after month-end never leaks into this month', () => {
  const days = [
    { date: '2026-11-01', closed: true, openingBalance: 0, cashIn: 0, shopIn: 0,
      cashPayments: [], handovers: [], outflows: [], expectedClosing: 99999,
      closingBalance: 99999, countedCash: 99999, discrepancy: 0 },
  ];
  const drawer = buildMonthEndCashInHand(specState(), days, '2026-10', []);
  assert.equal(drawer.lastClosedDate, '');
  assert.equal(drawer.balance, 4000); // only October's direct cash (Oct 5) — spec ledger's shop/wallet money is not drawer cash
  assert.equal(buildMonthEndCashInHand(specState(), days, '2026-13', []), null);
  assert.equal(buildMonthEndCashInHand(specState(), days, '', []), null);
  assert.equal(buildMonthEndCashInHand(specState(), days, null, []), null);
});

test('SISP-51: WhatsApp text and print HTML carry the channel split and the cash-in-hand', () => {
  const report = build(specState(), {
    settlements: [{ id: 's1', shop: 'Waseem Abbasi Shop', amount: 3000, date: '2026-10-31' }],
    roznamchaDays: [
      { date: '2026-10-31', closed: true, openingBalance: 0, cashIn: 4000, shopIn: 3000,
        cashPayments: [], handovers: [], outflows: [], expectedClosing: 7000,
        closingBalance: 7000, countedCash: 7000, discrepancy: 0 },
    ],
  });
  const text = buildOwnerKhataWhatsAppText(report);
  assert.match(text, /Channel Split: Direct Cash Rs\. 4,000 · Waseem Abbasi Shop Rs\. 3,000 · Easypaisa Rs\. 3,000/);
  assert.match(text, /Closing Cash-in-Hand \(Roznamcha\): Rs\. 7,000 · drawer band 2026-10-31/);
  const html = buildOwnerKhataPrintHtml(report);
  assert.match(html, /Collections by channel/);
  assert.match(html, /<td>Waseem Abbasi Shop<\/td><td>1<\/td><td>Rs\. 3,000<\/td>/);
  assert.match(html, /Closing Cash-in-Hand \(Roznamcha\) — drawer closed 2026-10-31/);
  assert.match(html, /Rs\. 7,000/);
});

test('SISP-51: building the 2.0 report never mutates ledger state or inputs', () => {
  const state = specState();
  const days = [
    { date: '2026-10-31', closed: false, outflows: [
      { id: 'o1', category: 'Other', amount: 100, lineman: '', note: '' },
    ] },
  ];
  const settlements = [{ id: 's1', shop: 'Waseem Abbasi Shop', amount: 3000, date: '2026-10-31' }];
  const before = JSON.stringify({ state, days, settlements });
  build(state, { settlements, roznamchaDays: days });
  assert.equal(JSON.stringify({ state, days, settlements }), before);
});

test('SISP-51: every khata2_ string used by the modal exists in en + ur and never renders as a raw key', () => {
  const source = readFileSync(new URL('../owner-khata.js', import.meta.url), 'utf8');
  const keys = [...new Set([...source.matchAll(/'(khata2_[a-z_]+)'/g)].map((m) => m[1]))];
  assert.ok(keys.length >= 7, `expected at least 7 khata2 keys in use, found ${keys.length}`);
  for (const key of keys) {
    assert.ok(TRANSLATIONS.en[key], `missing en translation for ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `missing ur translation for ${key}`);
    assert.notEqual(t(key, 'en'), key);
    assert.notEqual(t(key, 'ur'), key);
  }
});
