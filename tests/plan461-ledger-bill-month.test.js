import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizeLedgerBillMonth,
  ledgerBillMonthActive,
  formatLedgerBillMonth,
  ledgerBillMonthMatches,
  searchLedgerByBillMonth,
  ledgerBillMonthSummary,
  ledgerBillMonthSummaryText,
  ledgerBillMonthEmptyText,
  ledgerBillMonthRangeEmptyText,
} from '../ledger-bill-month.js';

// Plan 461 — Search ledger by bill month.
//
// Fixtures are invented and pattern-fake only: names are "First
// Last" fixtures (never a real customer), phones are the 03012345678
// family the PII ratchet allows, record ids are seed-* fixtures.
const ROWS = [
  { paymentId: 'seed-461-01', customerId: 'seed-461-c1', customerNumber: 101, customerName: 'Raja Ahmed', customerPhone: '03012345678', amount: 1000, date: '2026-03-05', month: '2026-03', method: 'Cash', status: 'paid' },
  { paymentId: 'seed-461-02', customerId: 'seed-461-c2', customerNumber: 102, customerName: 'Faisal Khan', customerPhone: '03012345679', amount: 1500, date: '2026-03-20', month: '2026-03', method: 'JazzCash', status: 'paid' },
  { paymentId: 'seed-461-03', customerId: 'seed-461-c3', customerNumber: 103, customerName: 'Bilal Hussain', customerPhone: '03012345670', amount: 2000, date: '2026-02-28', month: '2026-02', method: 'Cash', status: 'partial' },
  { paymentId: 'seed-461-04', customerId: 'seed-461-c4', customerNumber: 104, customerName: 'Usman Ghani', customerPhone: '03012345671', amount: 500, date: '2026-03-02', month: '2026-03', method: 'Easypaisa', status: 'paid', voided: true },
  // An advance payment for March, recorded on February's bill: its
  // money is headed for March, but the entry belongs to February.
  { paymentId: 'seed-461-05', customerId: 'seed-461-c5', customerNumber: 105, customerName: 'Ahmed Raza', customerPhone: '03012345672', amount: 3000, date: '2026-02-15', month: '2026-02', targetMonth: '2026-03', method: 'Cash', status: 'paid' },
  // A payment made in April on March's bill: its date is April, but
  // the entry belongs to March.
  { paymentId: 'seed-461-06', customerId: 'seed-461-c6', customerNumber: 106, customerName: 'Saad Malik', customerPhone: '03012345673', amount: 1200, date: '2026-04-02', month: '2026-03', method: 'Cash', status: 'paid' },
];

const ids = (list) => list.map((row) => row.paymentId);

test('a bill month is one strict YYYY-MM month', () => {
  assert.equal(normalizeLedgerBillMonth('2026-03'), '2026-03');
  assert.equal(normalizeLedgerBillMonth('  2026-03  '), '2026-03');
  assert.equal(normalizeLedgerBillMonth('2026-11'), '2026-11');
  assert.equal(normalizeLedgerBillMonth('2026-3'), null);
  assert.equal(normalizeLedgerBillMonth('2026-13'), null);
  assert.equal(normalizeLedgerBillMonth('2026-00'), null);
  assert.equal(normalizeLedgerBillMonth('2026/03'), null);
  assert.equal(normalizeLedgerBillMonth('03-2026'), null);
  assert.equal(normalizeLedgerBillMonth(''), null);
  assert.equal(normalizeLedgerBillMonth('   '), null);
  assert.equal(normalizeLedgerBillMonth(null), null);
  assert.equal(normalizeLedgerBillMonth(undefined), null);
  assert.equal(normalizeLedgerBillMonth(202603), null);
  assert.equal(ledgerBillMonthActive('2026-03'), true);
  assert.equal(ledgerBillMonthActive('2026-13'), false);
  assert.equal(ledgerBillMonthActive(''), false);
});

test('the month reads the way the app shows it', () => {
  assert.equal(formatLedgerBillMonth('2026-03'), 'March 2026');
  assert.equal(formatLedgerBillMonth('2026-11'), 'November 2026');
  assert.equal(formatLedgerBillMonth('2026-01'), 'January 2026');
  assert.equal(formatLedgerBillMonth('2026-12'), 'December 2026');
  assert.equal(formatLedgerBillMonth('2026-13'), '');
  assert.equal(formatLedgerBillMonth(''), '');
});

test('one bill month returns exactly that month, and no other month', () => {
  assert.deepEqual(ids(searchLedgerByBillMonth(ROWS, '2026-03')), ['seed-461-01', 'seed-461-02', 'seed-461-04', 'seed-461-06']);
  assert.deepEqual(ids(searchLedgerByBillMonth(ROWS, '2026-02')), ['seed-461-03', 'seed-461-05']);
  assert.deepEqual(ids(searchLedgerByBillMonth(ROWS, '2026-04')), []);
  assert.deepEqual(ids(searchLedgerByBillMonth(ROWS, '2026-01')), []);
  assert.equal(ledgerBillMonthMatches(ROWS[0], '2026-03'), true);
  assert.equal(ledgerBillMonthMatches(ROWS[0], '2026-02'), false);
  assert.equal(ledgerBillMonthMatches(ROWS[2], '2026-03'), false);
  assert.equal(ledgerBillMonthMatches({ paymentId: 'seed-461-x' }, '2026-03'), false);
  assert.equal(ledgerBillMonthMatches(null, '2026-03'), false);
  assert.equal(ledgerBillMonthMatches(ROWS[0], '2026-13'), false);
  assert.equal(ledgerBillMonthMatches(ROWS[0], ''), false);
});

test('the payment date is not the bill month', () => {
  // Row 6 was paid on 2 April, but it sits on March's bill.
  assert.equal(ledgerBillMonthMatches(ROWS[5], '2026-03'), true);
  assert.equal(ledgerBillMonthMatches(ROWS[5], '2026-04'), false);
  assert.deepEqual(ids(searchLedgerByBillMonth(ROWS, '2026-04')), []);
});

test('an advance reads by the bill it was recorded on, not its target month', () => {
  // Row 5 is an advance headed for March, recorded on February's bill.
  assert.equal(ledgerBillMonthMatches(ROWS[4], '2026-03'), false);
  assert.equal(ledgerBillMonthMatches(ROWS[4], '2026-02'), true);
  assert.deepEqual(ids(searchLedgerByBillMonth(ROWS, '2026-03')), ['seed-461-01', 'seed-461-02', 'seed-461-04', 'seed-461-06']);
  assert.deepEqual(ids(searchLedgerByBillMonth(ROWS, '2026-02')), ['seed-461-03', 'seed-461-05']);
});

test('with no usable month every entry is kept, in the same order, and the input is never mutated', () => {
  const input = [ROWS[2], ROWS[0], ROWS[1]];
  const before = JSON.stringify(input);
  const result = searchLedgerByBillMonth(input, '2026-03');
  assert.deepEqual(ids(result), ['seed-461-01', 'seed-461-02']);
  assert.notEqual(result, input);
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(searchLedgerByBillMonth(ROWS, ''), [...ROWS]);
  assert.notEqual(searchLedgerByBillMonth(ROWS, ''), ROWS);
  assert.deepEqual(searchLedgerByBillMonth(ROWS, '2026-13'), [...ROWS]);
  assert.deepEqual(searchLedgerByBillMonth(null, '2026-03'), []);
  assert.deepEqual(searchLedgerByBillMonth(undefined, '2026-03'), []);
});

test('a voided entry still lists, but the summary skips it like the ledger does', () => {
  assert.deepEqual(ledgerBillMonthSummary([ROWS[0], ROWS[1], ROWS[3]]), { count: 2, total: 2500 });
  assert.deepEqual(ledgerBillMonthSummary([]), { count: 0, total: 0 });
  assert.deepEqual(ledgerBillMonthSummary([{ amount: 'not-a-number' }, { amount: 1000 }]), { count: 2, total: 1000 });
  assert.deepEqual(ledgerBillMonthSummary([{ amount: 1000, voided: true }]), { count: 0, total: 0 });
  assert.equal(ledgerBillMonthSummaryText([ROWS[0], ROWS[1], ROWS[3]], '2026-03'), 'March 2026: 2 entries · PKR 2,500 total');
  assert.equal(ledgerBillMonthSummaryText([ROWS[0]], '2026-03'), 'March 2026: 1 entry · PKR 1,000 total');
  assert.equal(ledgerBillMonthSummaryText([], '2026-03'), 'March 2026: 0 entries · PKR 0 total');
  assert.equal(ledgerBillMonthSummaryText(ROWS, '2026-13'), '');
  assert.equal(ledgerBillMonthSummaryText(ROWS, ''), '');
});

test('the month total equals the sum of the listed non-voided entries', () => {
  const march = searchLedgerByBillMonth(ROWS, '2026-03');
  const summary = ledgerBillMonthSummary(march);
  const listed = march.filter((row) => row.voided !== true).reduce((sum, row) => sum + Number(row.amount), 0);
  assert.equal(summary.total, listed);
  assert.equal(summary.total, 1000 + 1500 + 1200);
  const february = searchLedgerByBillMonth(ROWS, '2026-02');
  assert.equal(ledgerBillMonthSummary(february).total, 2000 + 3000);
});

test('the empty text names the bill month', () => {
  assert.equal(ledgerBillMonthEmptyText('2026-03'), 'No entries for March 2026.');
  assert.equal(ledgerBillMonthEmptyText('2026-11'), 'No entries for November 2026.');
  assert.equal(ledgerBillMonthEmptyText('2026-13'), 'No recorded payments match these filters.');
  assert.equal(ledgerBillMonthEmptyText(''), 'No recorded payments match these filters.');
});

test('the empty text with a range names the month and the range', () => {
  assert.equal(ledgerBillMonthRangeEmptyText('2026-03', '1000', '2000'), 'No entries for March 2026 between Rs 1,000 and Rs 2,000.');
  assert.equal(ledgerBillMonthRangeEmptyText('2026-03', '2000', '1000'), 'No entries for March 2026 between Rs 1,000 and Rs 2,000.');
  assert.equal(ledgerBillMonthRangeEmptyText('2026-03', 'Rs 1,000', ''), 'No entries for March 2026 of Rs 1,000 or more.');
  assert.equal(ledgerBillMonthRangeEmptyText('2026-03', '', '2000'), 'No entries for March 2026 up to Rs 2,000.');
  assert.equal(ledgerBillMonthRangeEmptyText('2026-03', '', ''), 'No entries for March 2026.');
  assert.equal(ledgerBillMonthRangeEmptyText('2026-03', 'abc', 'def'), 'No entries for March 2026.');
  assert.equal(ledgerBillMonthRangeEmptyText('2026-13', '1000', '2000'), 'No recorded payments match these filters.');
  assert.equal(ledgerBillMonthRangeEmptyText('', '1000', '2000'), 'No recorded payments match these filters.');
});

test('the module header names no file literally and reads no storage or clock', () => {
  const module = readFileSync(new URL('../ledger-bill-month.js', import.meta.url), 'utf8');
  const header = module.slice(0, module.indexOf('*/'));
  assert.equal(header.includes('.js'), false);
  assert.equal(module.includes('localStorage'), false);
  // Plan 248: the clock check is `new Date(` / `Date.now(` — a bare
  // `Date(` also matches pure helpers, which are not clock reads.
  assert.equal(module.includes('new Date('), false);
  assert.equal(module.includes('Date.now'), false);
});

// --- wiring into the Transactions screen and the page ---

const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('wiring: the app imports the module and applies it in the ledger render', () => {
  assert.ok(appSrc.includes("from './ledger-bill-month.js'"), 'app imports the bill-month ledger module');
  const renderStart = appSrc.indexOf('function renderTransactions()');
  const renderEnd = appSrc.indexOf('function reportStatusLabel(', renderStart);
  const renderBody = appSrc.slice(renderStart, renderEnd);
  assert.ok(renderBody.includes('normalizeLedgerBillMonth'), 'the render normalizes the chosen bill month');
  assert.ok(renderBody.includes('searchLedgerByBillMonth(transactions, billMonth)'), 'the render narrows the ledger with the bill month');
  assert.ok(renderBody.includes("$('#lbmMonthSummary')"), 'the render updates the month summary line');
  assert.ok(renderBody.includes('ledgerBillMonthSummaryText(transactions, billMonth)'), 'the summary line shows the month, count, and total');
  assert.ok(renderBody.includes('ledgerBillMonthEmptyText(billMonth)'), 'an empty bill month says so plainly');
  assert.ok(renderBody.includes('ledgerBillMonthRangeEmptyText(billMonth, transactionAmountMin, transactionAmountMax)'), 'an empty bill month inside a range names both');
});

test('wiring: picking a bill month re-renders the ledger and clearing the filters clears it', () => {
  assert.ok(appSrc.includes("$('#transactionBillMonth').addEventListener('input'"), 'the bill-month picker listens for a picked month');
  const listenerStart = appSrc.indexOf("$('#transactionBillMonth').addEventListener('input'");
  const listenerBody = appSrc.slice(listenerStart, listenerStart + 300);
  assert.ok(listenerBody.includes('transactionCurrentPage = 1'), 'the listener restarts at the first page');
  assert.ok(listenerBody.includes('renderTransactions()'), 'the listener re-renders the ledger');
  const clearStart = appSrc.indexOf("$('#clearTransactionFilters').addEventListener('click'");
  const clearBody = appSrc.slice(clearStart, clearStart + 3000);
  assert.ok(clearBody.includes("$('#transactionBillMonth')"), 'clearing the filters clears the bill-month picker');
});

test('wiring: the page carries the bill-month picker and the month summary line', () => {
  assert.ok(page.includes('id="transactionBillMonth"'), 'the Transactions screen has a bill-month picker');
  assert.ok(page.includes('id="lbmMonthSummary"'), 'the month summary line exists in the summary bar');
  const filtersStart = page.indexOf('<div class="transaction-filters">');
  const filtersEnd = page.indexOf('</div>', page.indexOf('id="rnsReceiptSearchForm"'));
  const filtersBody = page.slice(filtersStart, filtersEnd);
  assert.ok(filtersBody.includes('for="transactionBillMonth"'), 'the bill-month picker is labelled');
  assert.ok(filtersBody.includes('type="month"'), 'the bill-month picker is a month input');
  // The pinned first sentence of the help text stays word for word.
  assert.ok(page.includes('Customer search, recency, exact payment date, and the amount range combine'), 'the pinned help sentence is untouched');
  assert.ok(page.includes('Pick a bill month to see only the entries on that month'), 'the help text names the bill-month search');
});
