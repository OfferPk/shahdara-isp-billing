// SISP-154: Day-by-Day Collection Method Matrix — pure builder pins.
//
// All fixtures are SYNTHETIC (no real customer names or data). The core
// proof is the reconciliation invariant: every row total equals its
// bucket sum, every column total equals its rows' sum, and the grand
// total equals an independently computed sum of the month's non-voided
// payments — so the matrix can never invent or drop a rupee.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { PAYMENT_METHODS } from '../core.js';
import { DIGITAL_BREAKDOWN_METHODS } from '../wallet-reconciliation.js';
import { TRANSLATIONS } from '../nav-language.js';
import {
  buildDailyMethodMatrix,
  classifyDailyMatrixPayment,
  validDailyMatrixMonth,
  lastDayOfDailyMatrixMonth,
  dailyMatrixTableHtml,
  dailyMatrixCsvHeaders,
  dailyMatrixCsvRows,
  dailyMatrixCsvNote,
  dailyMatrixCsvFilename,
  buildDailyMatrixCsv,
  generateDailyMethodMatrixPrintHtml
} from '../daily-method-matrix.js';

// October 2026 fixture. Expected counted payments (non-voided, dated in
// October, cash basis by payment date):
//   day 1 : Cash 3,000 (direct) · Waseem shop 1,500
//   day 3 : Easypaisa 1,000 (recorded on the SEPTEMBER bill, dated Oct)
//   day 5 : JazzCash 2,000 · Hassan shop 2,500 · Balla shop 3,000
//           (reconciliation vs current main: both legacy shop methods
//           derive to the ONE canonical collector 'Hassan Balla Shop'
//           — shop-settlement.js resolveShopCollector, OWNER-CASH-SHOP —
//           so day 5's shop column is 5,500 combined)
//   day 10: Bank Transfer 1,200 · (Cash 5,000 VOIDED — must not appear)
//   day 12: Cash at Imran shop 800 (custom shop — its own column)
//   day 31: Raast 700
// Excluded: 2026-09-30 Cash 9,999 and 2026-11-01 Cash 4,000 (out of month).
// Independent total: 3,000+1,500+1,000+2,000+2,500+3,000+1,200+800+700
//                  = 15,700 (9 receipts).
function fixtureState() {
  return {
    customers: [
      {
        id: 'c1', customerNumber: 1, name: 'Test Customer A',
        bills: [
          {
            month: '2026-10',
            payments: [
              { id: 'p1', date: '2026-10-01', amount: 3000, method: 'Cash' },
              { id: 'p2', date: '2026-10-01', amount: 1500, method: 'Cash at Waseem Abbasi shop' },
              { id: 'p3', date: '2026-10-05', amount: 2000, method: 'JazzCash' },
              { id: 'p4', date: '2026-10-05', amount: 2500, method: 'Cash at Hassan shop' }
            ]
          },
          {
            month: '2026-09',
            payments: [
              { id: 'p5', date: '2026-09-30', amount: 9999, method: 'Cash' },
              { id: 'p6', date: '2026-10-03', amount: 1000, method: 'Easypaisa' }
            ]
          }
        ]
      },
      {
        id: 'c2', customerNumber: 2, name: 'Test Customer B',
        bills: [
          {
            month: '2026-10',
            payments: [
              { id: 'p7', date: '2026-10-05', amount: 3000, method: 'Cash at Balla shop' },
              { id: 'p8', date: '2026-10-10', amount: 1200, method: 'Bank Transfer' },
              { id: 'p9', date: '2026-10-10', amount: 5000, method: 'Cash', voided: true },
              { id: 'p10', date: '2026-10-12', amount: 800, method: 'Cash at Imran shop' },
              { id: 'p11', date: '2026-10-31', amount: 700, method: 'Raast' },
              { id: 'p12', date: '2026-11-01', amount: 4000, method: 'Cash' }
            ]
          }
        ]
      }
    ]
  };
}

function independentMonthTotalCents(state, month) {
  let sum = 0;
  for (const customer of state.customers) {
    for (const bill of customer.bills) {
      for (const payment of bill.payments) {
        if (payment.voided === true) continue;
        if (typeof payment.date !== 'string' || payment.date.slice(0, 7) !== month) continue;
        sum += Math.round(Number(payment.amount) * 100);
      }
    }
  }
  return sum;
}

test('matrix: one row per day of the month, zero days included', () => {
  const matrix = buildDailyMethodMatrix(fixtureState(), '2026-10');
  assert.equal(matrix.month, '2026-10');
  assert.equal(matrix.days.length, 31);
  assert.deepEqual(matrix.days.map((d) => d.day), Array.from({ length: 31 }, (_, i) => i + 1));
  const day2 = matrix.days[1];
  assert.equal(day2.directCashCents, 0);
  assert.equal(day2.digitalCents, 0);
  assert.equal(day2.receiptCount, 0);
  assert.equal(day2.totalCents, 0);
  for (const name of matrix.shopNames) assert.equal(day2.shops[name], 0);
});

test('matrix: shorter months end at their real last day', () => {
  assert.equal(buildDailyMethodMatrix(fixtureState(), '2026-11').days.length, 30);
  assert.equal(buildDailyMethodMatrix(fixtureState(), '2026-02').days.length, 28);
  assert.equal(lastDayOfDailyMatrixMonth('2024-02'), 29);
  assert.equal(lastDayOfDailyMatrixMonth('2026-13'), 0);
  assert.equal(validDailyMatrixMonth('2026-10'), true);
  assert.equal(validDailyMatrixMonth('October'), false);
});

test('matrix: day buckets carry the exact recorded amounts', () => {
  const matrix = buildDailyMethodMatrix(fixtureState(), '2026-10');
  const day1 = matrix.days[0];
  assert.equal(day1.directCashCents, 300000);
  assert.equal(day1.shops['Waseem Abbasi Shop'], 150000);
  assert.equal(day1.receiptCount, 2);
  assert.equal(day1.totalCents, 450000);
  const day5 = matrix.days[4];
  assert.equal(day5.shops['Hassan Balla Shop'], 550000);
  assert.equal(day5.digitalCents, 200000);
  assert.equal(day5.receiptCount, 3);
  assert.equal(day5.totalCents, 750000);
  // Cash basis: the Easypaisa payment sits on the September bill but is
  // dated 2026-10-03, so it counts in October, on day 3.
  assert.equal(matrix.days[2].digitalCents, 100000);
  assert.equal(matrix.days[30].digitalCents, 70000);
});

test('matrix INVARIANT: rows, columns and grand total all reconcile', () => {
  const state = fixtureState();
  const matrix = buildDailyMethodMatrix(state, '2026-10');
  // Every row total == its bucket sum.
  for (const row of matrix.days) {
    const bucketSum = row.directCashCents + row.digitalCents
      + matrix.shopNames.reduce((sum, name) => sum + (row.shops[name] ?? 0), 0);
    assert.equal(row.totalCents, bucketSum, `day ${row.day} row total`);
  }
  // Every column total == the sum of its rows.
  const colDirect = matrix.days.reduce((s, r) => s + r.directCashCents, 0);
  const colDigital = matrix.days.reduce((s, r) => s + r.digitalCents, 0);
  const colReceipts = matrix.days.reduce((s, r) => s + r.receiptCount, 0);
  assert.equal(matrix.totals.directCashCents, colDirect);
  assert.equal(matrix.totals.digitalCents, colDigital);
  assert.equal(matrix.totals.receiptCount, colReceipts);
  for (const name of matrix.shopNames) {
    assert.equal(matrix.totals.shops[name], matrix.days.reduce((s, r) => s + (r.shops[name] ?? 0), 0), `column ${name}`);
  }
  // Grand total == sum of day totals == totals row == independent sum.
  const daySum = matrix.days.reduce((s, r) => s + r.totalCents, 0);
  const independent = independentMonthTotalCents(state, '2026-10');
  assert.equal(independent, 1570000);
  assert.equal(daySum, independent);
  assert.equal(matrix.totals.totalCents, independent);
  assert.equal(matrix.grandTotalCents, independent);
  assert.equal(matrix.totals.receiptCount, 9);
});

test('matrix: voided payments and out-of-month payments never appear', () => {
  const matrix = buildDailyMethodMatrix(fixtureState(), '2026-10');
  // Day 10 holds only the 1,200 Bank Transfer; the voided 5,000 Cash is gone.
  assert.equal(matrix.days[9].directCashCents, 0);
  assert.equal(matrix.days[9].digitalCents, 120000);
  assert.equal(matrix.days[9].receiptCount, 1);
  // Direct cash total is the single real 3,000 — not +9,999 (Sep) or +4,000 (Nov).
  assert.equal(matrix.totals.directCashCents, 300000);
});

test('matrix: shop columns are derived from the data, in stable order', () => {
  const matrix = buildDailyMethodMatrix(fixtureState(), '2026-10');
  // 'Imran Shop' is NOT one of the spec's three named shops — it still
  // gets its own column because the data contains it.
  assert.deepEqual(matrix.shopNames, ['Waseem Abbasi Shop', 'Hassan Balla Shop', 'Imran Shop']);
  assert.equal(matrix.totals.shops['Hassan Balla Shop'], 550000);
  assert.equal(matrix.totals.shops['Imran Shop'], 80000);
});

test('classification: every recorded PAYMENT_METHODS value lands in its bucket', () => {
  const expected = {
    Cash: { bucket: 'direct' },
    JazzCash: { bucket: 'digital' },
    Easypaisa: { bucket: 'digital' },
    NayaPay: { bucket: 'digital' },
    'Bank Transfer': { bucket: 'digital' },
    Raast: { bucket: 'digital' },
    'Cash at Waseem Abbasi shop': { bucket: 'shop', shop: 'Waseem Abbasi Shop' },
    'Cash at Hassan shop': { bucket: 'shop', shop: 'Hassan Balla Shop' },
    'Cash at Balla shop': { bucket: 'shop', shop: 'Hassan Balla Shop' },
    'Cash at Hassan Balla shop': { bucket: 'shop', shop: 'Hassan Balla Shop' }
  };
  for (const method of PAYMENT_METHODS) {
    assert.deepEqual(classifyDailyMatrixPayment({ method }), expected[method], method);
  }
  // The digital bucket for recorded methods is exactly the wallet
  // reconciliation module's digital set — no method is left unclassified.
  const digitalFromList = PAYMENT_METHODS.filter((m) => classifyDailyMatrixPayment({ method: m }).bucket === 'digital');
  assert.deepEqual([...digitalFromList].sort(), [...DIGITAL_BREAKDOWN_METHODS].sort());
  // Custom shop methods and paidBy shop hints resolve like the shop ledger.
  assert.deepEqual(classifyDailyMatrixPayment({ method: 'Cash at Imran shop' }), { bucket: 'shop', shop: 'Imran Shop' });
  assert.deepEqual(classifyDailyMatrixPayment({ method: 'Cash', paidBy: 'Waseem Abbasi' }), { bucket: 'shop', shop: 'Waseem Abbasi Shop' });
});

test('matrix: a discount is never added — only the recorded amount counts', () => {
  const state = {
    customers: [{
      id: 'c9', customerNumber: 9, name: 'Test Customer C',
      bills: [{ month: '2026-10', payments: [{ id: 'q1', date: '2026-10-02', amount: 2800, discount: 200, method: 'Cash' }] }]
    }]
  };
  const matrix = buildDailyMethodMatrix(state, '2026-10');
  assert.equal(matrix.days[1].directCashCents, 280000);
  assert.equal(matrix.grandTotalCents, 280000);
});

test('matrix: malformed states build an all-zero matrix, never throw', () => {
  for (const bad of [null, undefined, {}, { customers: [] }, { customers: [null, { id: 'x' }, { bills: null }] }]) {
    const matrix = buildDailyMethodMatrix(bad, '2026-10');
    assert.equal(matrix.days.length, 31);
    assert.equal(matrix.grandTotalCents, 0);
    assert.equal(matrix.totals.receiptCount, 0);
    assert.deepEqual(matrix.shopNames, []);
  }
});

test('matrix: building and rendering mutate nothing (read-only)', () => {
  const state = fixtureState();
  const before = JSON.stringify(state);
  const matrix = buildDailyMethodMatrix(state, '2026-10');
  dailyMatrixTableHtml(matrix);
  dailyMatrixTableHtml(matrix, 'ur');
  buildDailyMatrixCsv(matrix);
  generateDailyMethodMatrixPrintHtml({ matrix, generatedDate: '2026-10-30' });
  assert.equal(JSON.stringify(state), before);
});

test('csv: headers carry one column per derived shop; totals row reconciles', () => {
  const matrix = buildDailyMethodMatrix(fixtureState(), '2026-10');
  const headers = dailyMatrixCsvHeaders(matrix);
  assert.deepEqual(headers.map((h) => h.label), [
    'Day', 'Direct Cash', 'Waseem Abbasi Shop', 'Hassan Balla Shop', 'Imran Shop',
    'Digital (JazzCash/Easypaisa/Bank)', 'Receipts', 'Day Total'
  ]);
  const rows = dailyMatrixCsvRows(matrix);
  assert.equal(rows.length, 32); // 31 days + totals row
  const day5 = rows.find((r) => r.day === '2026-10-05');
  assert.equal(day5.shop1, 5500); // Hassan Balla column (Hassan 2,500 + Balla 3,000)
  assert.equal(day5.total, 7500);
  const totalRow = rows[rows.length - 1];
  assert.equal(totalRow.day, 'Total');
  assert.equal(totalRow.total, 15700);
  assert.equal(totalRow.receipts, 9);
  assert.ok(dailyMatrixCsvNote(matrix).includes('2026-10'));
  assert.equal(dailyMatrixCsvFilename(matrix), 'daily-method-matrix-2026-10_filtered.csv');
  const csv = buildDailyMatrixCsv(matrix);
  assert.ok(csv.includes('Note: Filtered view'));
  assert.ok(csv.includes('2026-10-05'));
});

test('print + screen tables render the same reconciled figures', () => {
  const matrix = buildDailyMethodMatrix(fixtureState(), '2026-10');
  const screen = dailyMatrixTableHtml(matrix);
  assert.ok(screen.includes('Waseem Abbasi Shop'));
  assert.ok(screen.includes('Imran Shop'));
  assert.ok(screen.includes('PKR 15,700'));
  assert.ok(screen.includes('Month Total'));
  const screenUr = dailyMatrixTableHtml(matrix, 'ur');
  assert.ok(screenUr.includes('مہینے کا کل'));
  const print = generateDailyMethodMatrixPrintHtml({ matrix, generatedDate: '2026-10-30' });
  assert.ok(print.includes('SHAHDARA FIBER NET'));
  assert.ok(print.includes('Daily Collection Method Matrix'));
  assert.ok(print.includes('2026-10-31'));
  assert.ok(print.includes('PKR 15,700'));
  const printUr = generateDailyMethodMatrixPrintHtml({ matrix, lang: 'ur', generatedDate: '2026-10-30' });
  assert.ok(printUr.includes('روزانہ وصولی کا طریقہ جدول'));
});

test('i18n: every t() key the module uses exists in both dictionaries', () => {
  const source = readFileSync(new URL('../daily-method-matrix.js', import.meta.url), 'utf8');
  const keys = new Set([...source.matchAll(/\bt\('([a-z0-9_]+)'/g)].map((m) => m[1]));
  assert.ok(keys.size >= 10, `expected 10+ t() keys, found ${keys.size}`);
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
  }
  for (const placeholder of ['{count}', '{total}', '{month}']) {
    assert.ok(TRANSLATIONS.en.dmm_summary.includes(placeholder), `en dmm_summary ${placeholder}`);
    assert.ok(TRANSLATIONS.ur.dmm_summary.includes(placeholder), `ur dmm_summary ${placeholder}`);
  }
  assert.ok(TRANSLATIONS.en.dmm_generated_on.includes('{date}'));
  assert.ok(TRANSLATIONS.ur.dmm_generated_on.includes('{date}'));
  // The dialog markup's data-i18n keys are all dmm_* keys audited above.
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const dialogStart = html.indexOf('id="dailyMethodMatrixDialog"');
  const dialogHtml = html.slice(dialogStart, dialogStart + 2600);
  for (const m of dialogHtml.matchAll(/data-i18n="([a-z0-9_]+)"/g)) {
    // Static markup keys are translated by the data-i18n engine, so they
    // need dictionary entries in both languages even when the module
    // itself never calls t() with them.
    assert.ok(m[1].startsWith('dmm_'), `dialog key ${m[1]} carries the dmm_ prefix`);
    assert.equal(typeof TRANSLATIONS.en[m[1]], 'string', `en missing dialog ${m[1]}`);
    assert.ok(TRANSLATIONS.en[m[1]].length > 0, `en empty dialog ${m[1]}`);
    assert.equal(typeof TRANSLATIONS.ur[m[1]], 'string', `ur missing dialog ${m[1]}`);
    assert.ok(TRANSLATIONS.ur[m[1]].length > 0, `ur empty dialog ${m[1]}`);
  }
});

test('wiring: dialog, open button, controller and token-only CSS are in place', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="dailyMethodMatrixDialog"'), 'dialog present');
  assert.ok(html.includes('class="billing-modal daily-method-matrix-modal"'), 'dialog uses the billing-modal shell (var(--modal-surface))');
  assert.ok(html.includes('id="dailyMethodMatrixOpenBtn"'), 'open button present');
  assert.ok(html.includes('id="dailyMethodMatrixMonth"'), 'month input present');
  assert.ok(html.includes('id="dailyMethodMatrixTableHost"'), 'table host present');
  assert.ok(html.includes('id="dailyMethodMatrixCsvBtn"'), 'csv button present');
  assert.ok(html.includes('id="dailyMethodMatrixPrintBtn"'), 'print button present');
  assert.ok(html.includes('id="dailyMethodMatrixCloseBtn" class="modal-close"'), 'shared close button present');
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './daily-method-matrix.js'"), 'app imports the module');
  assert.ok(app.includes('setupDailyMethodMatrixDialog(() => state'), 'app sets the controller up');
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const blockStart = css.indexOf('SISP-154');
  assert.ok(blockStart > -1, 'components.css carries the SISP-154 block');
  const block = css.slice(blockStart, blockStart + 2600);
  assert.ok(block.includes('.daily-method-matrix-scroll'), 'scroll wrapper styled');
  assert.ok(block.includes('overflow-x: auto'), 'matrix scrolls inside the dialog');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'SISP-154 CSS block is hex-free (tokens only)');
  assert.ok(!block.includes('nav.css'), 'no nav.css reference');
});
