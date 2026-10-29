/**
 * expense-voucher-print.test.js — SISP-60 [P2]: Offline Printable
 * Monthly Expense & Partner Sign-Off Voucher Book.
 *
 * Spec criterion (read-latest.txt, SISP-60): "Generating the Expense
 * Voucher Sheet for 2026-10 lists all October expenses and partner
 * drawings with accurate subtotals and dual signature blocks."
 *
 * Pins:
 *  - the spec scenario exactly: the October 2026 book lists every
 *    October expense (including the SISP-56 Saad payout mirror row,
 *    category 'Salary — Saad', exactly once) and every October partner
 *    drawing from the SISP-22 ledger, with expenses / drawings /
 *    grand subtotals that are plain sums of the printed rows;
 *  - voucher codes EXP-YYYYMM-01+ are DERIVED deterministically:
 *    rows sort by (date, stable record id), the same unchanged data
 *    yields the same code for the same row on every generation, and
 *    shuffling the input order changes nothing;
 *  - other months never leak in; partner CAPITAL (out-of-pocket)
 *    entries are not drawings and never appear; malformed partner
 *    entries are dropped by the SISP-22 sanitizer;
 *  - read-only: building the book mutates neither state nor entries;
 *  - the A4 print document carries every row, both subtotals, the
 *    grand total, and signature blocks for Nasir AND Aqib plus the
 *    prepared-by/owner line;
 *  - i18n: every evouch_* key used by the module or the dialog markup
 *    exists in BOTH dictionaries; wiring: Expenses toolbar button,
 *    dialog markup, app.js controller, token CSS, runtime graph.
 * Synthetic data only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState } from '../core.js';
import { addExpense } from '../phase3.js';
import {
  buildExpenseVoucherBook,
  generateExpenseVoucherPrintHtml,
  voucherCodeFor
} from '../expense-voucher-print.js';
import { collectRuntimeFiles } from '../build.mjs';
import { TRANSLATIONS } from '../nav-language.js';

const REF = new Date('2026-10-20T12:00:00Z');

function buildFixture() {
  let state = createInitialState([]);
  const exp = (fields) => { state = addExpense(state, fields, REF); };
  // October expenses (deliberately inserted out of date order).
  exp({ date: '2026-10-20', amount: 2000, category: 'Electricity', notes: 'OLT room bill' });
  exp({ date: '2026-10-05', amount: 35000, category: 'Nayatel bill', notes: 'Upstream bandwidth' });
  // The SISP-56 Saad payout mirror: a real expense row, counted once.
  exp({ date: '2026-10-10', amount: 5000, category: 'Salary — Saad', notes: 'Saad payout mirror' });
  // Another month: never on the October sheet.
  exp({ date: '2026-09-15', amount: 9999, category: 'Tools', notes: 'September tools' });

  const partnerEntries = [
    { id: 'pl-aqib-draw', partner: 'Aqib', type: 'drawing', amount: 10000, date: '2026-10-15', note: 'Cash taken', createdAt: '2026-10-15T00:00:00.000Z' },
    { id: 'pl-nasir-draw', partner: 'Nasir', type: 'drawing', amount: 15000, date: '2026-10-12', note: '', createdAt: '2026-10-12T00:00:00.000Z' },
    // Capital = money INTO the business: not a drawing, never a voucher.
    { id: 'pl-aqib-cap', partner: 'Aqib', type: 'capital', amount: 8000, date: '2026-10-09', note: 'Fiber paid personally', createdAt: '2026-10-09T00:00:00.000Z' },
    // Another month's drawing: excluded from October.
    { id: 'pl-nasir-nov', partner: 'Nasir', type: 'drawing', amount: 7000, date: '2026-11-02', note: '', createdAt: '2026-11-02T00:00:00.000Z' },
    // Malformed: dropped by the partner-settlement sanitizer.
    { id: 'pl-bad', partner: 'Nobody', type: 'drawing', amount: 1234, date: '2026-10-03', note: '', createdAt: '' }
  ];
  return { state, partnerEntries };
}

test('spec pin: October 2026 book lists all October expenses + drawings with accurate subtotals', () => {
  const { state, partnerEntries } = buildFixture();
  const book = buildExpenseVoucherBook(state, partnerEntries, { month: '2026-10', referenceDate: REF });

  assert.equal(book.month, '2026-10');
  assert.equal(book.rows.length, 5);
  assert.equal(book.expenseCount, 3);
  assert.equal(book.drawingCount, 2);
  // Expenses 35,000 + 5,000 + 2,000; drawings 15,000 + 10,000.
  assert.equal(book.expensesSubtotal, 42000);
  assert.equal(book.drawingsSubtotal, 25000);
  assert.equal(book.grandTotal, 67000);
  // Subtotals are plain sums of the printed rows.
  assert.equal(book.rows.filter(r => r.kind === 'expense').reduce((s, r) => s + r.amount, 0), book.expensesSubtotal);
  assert.equal(book.rows.filter(r => r.kind === 'drawing').reduce((s, r) => s + r.amount, 0), book.drawingsSubtotal);
  assert.equal(book.rows.reduce((s, r) => s + r.amount, 0), book.grandTotal);

  // Date order across both sources, codes EXP-202610-01..05.
  assert.deepEqual(book.rows.map(r => r.date), ['2026-10-05', '2026-10-10', '2026-10-12', '2026-10-15', '2026-10-20']);
  assert.deepEqual(book.rows.map(r => r.code), ['EXP-202610-01', 'EXP-202610-02', 'EXP-202610-03', 'EXP-202610-04', 'EXP-202610-05']);
  // The Saad payout mirror appears exactly once, as its expense row.
  const saadRows = book.rows.filter(r => r.category === 'Salary — Saad');
  assert.equal(saadRows.length, 1);
  assert.equal(saadRows[0].kind, 'expense');
  assert.equal(saadRows[0].amount, 5000);
  // September expense, November drawing, capital and malformed rows absent.
  assert.ok(!book.rows.some(r => r.amount === 9999));
  assert.ok(!book.rows.some(r => r.amount === 7000));
  assert.ok(!book.rows.some(r => r.amount === 8000));
  assert.ok(!book.rows.some(r => r.amount === 1234));
});

test('voucher codes are deterministic: same data, same codes, any input order', () => {
  const { state, partnerEntries } = buildFixture();
  const first = buildExpenseVoucherBook(state, partnerEntries, { month: '2026-10', referenceDate: REF });
  const second = buildExpenseVoucherBook(state, partnerEntries, { month: '2026-10', referenceDate: REF });
  assert.deepEqual(second.rows.map(r => [r.sourceId, r.code]), first.rows.map(r => [r.sourceId, r.code]));

  const shuffledState = { ...state, expenses: [...state.expenses].reverse() };
  const shuffledEntries = [...partnerEntries].reverse();
  const shuffled = buildExpenseVoucherBook(shuffledState, shuffledEntries, { month: '2026-10', referenceDate: REF });
  assert.deepEqual(shuffled.rows.map(r => [r.sourceId, r.code]), first.rows.map(r => [r.sourceId, r.code]));

  assert.equal(voucherCodeFor('2026-10', 0), 'EXP-202610-01');
  assert.equal(voucherCodeFor('2026-10', 99), 'EXP-202610-100');
});

test('building the book is read-only and defaults to the reference month', () => {
  const { state, partnerEntries } = buildFixture();
  const stateBefore = JSON.stringify(state);
  const entriesBefore = JSON.stringify(partnerEntries);
  const book = buildExpenseVoucherBook(state, partnerEntries, { referenceDate: REF });
  assert.equal(book.month, '2026-10');
  assert.equal(JSON.stringify(state), stateBefore);
  assert.equal(JSON.stringify(partnerEntries), entriesBefore);

  const empty = buildExpenseVoucherBook(createInitialState([]), [], { month: '2026-10', referenceDate: REF });
  assert.deepEqual(empty.rows, []);
  assert.equal(empty.grandTotal, 0);
});

test('print sheet carries every row, subtotals, grand total and dual partner signature blocks', () => {
  const { state, partnerEntries } = buildFixture();
  const book = buildExpenseVoucherBook(state, partnerEntries, { month: '2026-10', referenceDate: REF });
  const html = generateExpenseVoucherPrintHtml({ book, lang: 'en', generatedDate: '2026-10-31' });

  for (const row of book.rows) {
    assert.ok(html.includes(row.code), `sheet lists ${row.code}`);
    assert.ok(html.includes(row.date), `sheet lists ${row.date}`);
  }
  assert.ok(html.includes('Nayatel bill'));
  assert.ok(html.includes('Salary — Saad'));
  assert.ok(html.includes('Partner drawing — Nasir'));
  assert.ok(html.includes('Partner drawing — Aqib'));
  assert.ok(html.includes('PKR 42,000'), 'expenses subtotal printed');
  assert.ok(html.includes('PKR 25,000'), 'drawings subtotal printed');
  assert.ok(html.includes('PKR 67,000'), 'grand total printed');
  // Dual signature blocks + prepared-by line.
  assert.ok(html.includes('Nasir (Partner)'), 'Nasir signature block');
  assert.ok(html.includes('Aqib (Partner)'), 'Aqib signature block');
  assert.ok(html.includes('Prepared by / Owner'), 'prepared-by line');

  const urdu = generateExpenseVoucherPrintHtml({ book, lang: 'ur', generatedDate: '2026-10-31' });
  assert.ok(urdu.includes('ناصر (پارٹنر)'), 'Urdu Nasir signature block');
  assert.ok(urdu.includes('عاقب (پارٹنر)'), 'Urdu Aqib signature block');

  const emptyHtml = generateExpenseVoucherPrintHtml({
    book: buildExpenseVoucherBook(createInitialState([]), [], { month: '2026-10', referenceDate: REF }),
    lang: 'en',
    generatedDate: '2026-10-31'
  });
  assert.ok(emptyHtml.includes('Nasir (Partner)') && emptyHtml.includes('Aqib (Partner)'), 'signatures print even for an empty month');
});

test('i18n: every evouch_* key exists in both dictionaries', () => {
  const moduleSource = readFileSync(new URL('../expense-voucher-print.js', import.meta.url), 'utf8');
  const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const used = new Set();
  for (const m of moduleSource.matchAll(/t\('(evouch_[a-z_]+)'/g)) used.add(m[1]);
  for (const m of indexHtml.matchAll(/data-i18n="(evouch_[a-z_]+)"/g)) used.add(m[1]);
  assert.ok(used.size >= 20, `expected at least 20 evouch keys, found ${used.size}`);
  for (const key of used) {
    assert.ok(Object.hasOwn(TRANSLATIONS.en, key), `en missing ${key}`);
    assert.ok(Object.hasOwn(TRANSLATIONS.ur, key), `ur missing ${key}`);
  }
});

test('wiring: toolbar button, dialog markup, controller, CSS tokens and runtime graph', async () => {
  const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');

  assert.ok(indexHtml.includes('id="expenseVoucherOpenBtn"'), 'Expenses toolbar button present');
  assert.ok(indexHtml.includes('id="expenseVoucherDialog"'), 'dialog present');
  assert.ok(indexHtml.includes('id="expenseVoucherMonthSelect"'), 'month picker present');
  assert.ok(indexHtml.includes('id="expenseVoucherPrintBtn"'), 'print action present');
  assert.ok(indexHtml.includes('expense-voucher-modal'), 'dialog uses the billing-modal shell');
  assert.ok(app.includes("from './expense-voucher-print.js'"), 'app.js imports the module');
  assert.ok(app.includes('setupExpenseVoucherDialog'), 'app.js wires the controller');
  assert.ok(app.includes('getPartnerEntries: () => loadPartnerLedgerEntries()'), 'drawings come from the SISP-22 ledger loader');
  assert.ok(css.includes('.expense-voucher-preview'), 'dialog CSS present');
  assert.ok(!/\.expense-voucher[^{]*\{[^}]*#fff/i.test(css), 'no hardcoded white in voucher dialog CSS');

  const { files, missing } = await collectRuntimeFiles(new URL('..', import.meta.url).pathname);
  assert.deepEqual(missing, []);
  assert.ok(files.includes('expense-voucher-print.js'), 'module is reachable in the build runtime graph');
});
