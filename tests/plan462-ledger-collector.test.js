import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizeLedgerCollectorFilter,
  ledgerCollectorActive,
  ledgerCollectorMatches,
  searchLedgerByCollector,
  ledgerCollectors,
  ledgerCollectorSummary,
  ledgerCollectorSummaryText,
  ledgerCollectorEmptyText,
  ledgerCollectorRangeEmptyText,
} from '../ledger-collector.js';

// Plan 462 — Search ledger by collector.
//
// Fixtures are invented and pattern-fake only: names are "First
// Last" fixtures (never a real customer), phones are the 03012345678
// family the PII ratchet allows, record ids are seed-* fixtures.
const ROWS = [
  { paymentId: 'seed-462-01', customerId: 'seed-462-c1', customerNumber: 101, customerName: 'Raja Ahmed', customerPhone: '03012345678', amount: 1000, date: '2026-03-05', month: '2026-03', method: 'Cash', status: 'paid', collectedBy: 'Adeel Raza' },
  { paymentId: 'seed-462-02', customerId: 'seed-462-c2', customerNumber: 102, customerName: 'Faisal Khan', customerPhone: '03012345679', amount: 1500, date: '2026-03-20', month: '2026-03', method: 'JazzCash', status: 'paid', collectedBy: 'Adeel Raza' },
  { paymentId: 'seed-462-03', customerId: 'seed-462-c3', customerNumber: 103, customerName: 'Bilal Hussain', customerPhone: '03012345670', amount: 2000, date: '2026-02-28', month: '2026-02', method: 'Cash', status: 'partial', collectedBy: 'Noman Tariq' },
  { paymentId: 'seed-462-04', customerId: 'seed-462-c4', customerNumber: 104, customerName: 'Usman Ghani', customerPhone: '03012345671', amount: 500, date: '2026-03-02', month: '2026-03', method: 'Easypaisa', status: 'paid', voided: true, collectedBy: 'Adeel Raza' },
  // An entry with no collector recorded: it belongs to no chosen
  // collector, but it stays in the list while none is chosen.
  { paymentId: 'seed-462-05', customerId: 'seed-462-c5', customerNumber: 105, customerName: 'Ahmed Raza', customerPhone: '03012345672', amount: 3000, date: '2026-02-15', month: '2026-02', method: 'Cash', status: 'paid' },
  // The same collector recorded with different casing: one
  // collector, not two.
  { paymentId: 'seed-462-06', customerId: 'seed-462-c6', customerNumber: 106, customerName: 'Saad Malik', customerPhone: '03012345673', amount: 1200, date: '2026-04-02', month: '2026-03', method: 'Cash', status: 'paid', collectedBy: 'adeel raza' },
];

const ids = (list) => list.map((row) => row.paymentId);

test('a collector choice is a trimmed name, or nothing', () => {
  assert.equal(normalizeLedgerCollectorFilter('Adeel Raza'), 'Adeel Raza');
  assert.equal(normalizeLedgerCollectorFilter('  Adeel Raza  '), 'Adeel Raza');
  assert.equal(normalizeLedgerCollectorFilter(''), '');
  assert.equal(normalizeLedgerCollectorFilter('   '), '');
  assert.equal(normalizeLedgerCollectorFilter(null), '');
  assert.equal(normalizeLedgerCollectorFilter(undefined), '');
  assert.equal(normalizeLedgerCollectorFilter(123), '');
  assert.equal(ledgerCollectorActive('Adeel Raza'), true);
  assert.equal(ledgerCollectorActive(''), false);
  assert.equal(ledgerCollectorActive('   '), false);
});

test('matching is by collector name, case-insensitive', () => {
  assert.equal(ledgerCollectorMatches(ROWS[0], 'Adeel Raza'), true);
  assert.equal(ledgerCollectorMatches(ROWS[0], 'adeel raza'), true);
  assert.equal(ledgerCollectorMatches(ROWS[0], 'ADEEL RAZA'), true);
  assert.equal(ledgerCollectorMatches(ROWS[0], '  Adeel Raza '), true);
  assert.equal(ledgerCollectorMatches(ROWS[0], 'Noman Tariq'), false);
  assert.equal(ledgerCollectorMatches(ROWS[2], 'Noman Tariq'), true);
  assert.equal(ledgerCollectorMatches(ROWS[2], 'Adeel Raza'), false);
  // An entry with no collector recorded belongs to no collector.
  assert.equal(ledgerCollectorMatches(ROWS[4], 'Adeel Raza'), false);
  assert.equal(ledgerCollectorMatches({ paymentId: 'seed-462-x' }, 'Adeel Raza'), false);
  assert.equal(ledgerCollectorMatches(null, 'Adeel Raza'), false);
  // With no collector chosen every entry belongs.
  assert.equal(ledgerCollectorMatches(ROWS[0], ''), true);
  assert.equal(ledgerCollectorMatches(ROWS[4], ''), true);
  assert.equal(ledgerCollectorMatches(null, ''), true);
});

test('one collector returns exactly that collector, and no other', () => {
  assert.deepEqual(ids(searchLedgerByCollector(ROWS, 'Adeel Raza')), ['seed-462-01', 'seed-462-02', 'seed-462-04', 'seed-462-06']);
  assert.deepEqual(ids(searchLedgerByCollector(ROWS, 'adeel raza')), ['seed-462-01', 'seed-462-02', 'seed-462-04', 'seed-462-06']);
  assert.deepEqual(ids(searchLedgerByCollector(ROWS, 'Noman Tariq')), ['seed-462-03']);
  assert.deepEqual(ids(searchLedgerByCollector(ROWS, 'Nobody')), []);
});

test('with no collector chosen every entry is kept, in the same order, and the input is never mutated', () => {
  const input = [ROWS[2], ROWS[0], ROWS[1]];
  const before = JSON.stringify(input);
  const result = searchLedgerByCollector(input, 'Adeel Raza');
  assert.deepEqual(ids(result), ['seed-462-01', 'seed-462-02']);
  assert.notEqual(result, input);
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(searchLedgerByCollector(ROWS, ''), [...ROWS]);
  assert.notEqual(searchLedgerByCollector(ROWS, ''), ROWS);
  assert.deepEqual(searchLedgerByCollector(ROWS, '   '), [...ROWS]);
  assert.deepEqual(searchLedgerByCollector(null, 'Adeel Raza'), []);
  assert.deepEqual(searchLedgerByCollector(undefined, 'Adeel Raza'), []);
});

test('the collector list is distinct names in name order, casing folded', () => {
  // 'adeel raza' on row 6 is the same collector as 'Adeel Raza'
  // on rows 1, 2, and 4, and keeps the first spelling seen.
  assert.deepEqual(ledgerCollectors(ROWS), ['Adeel Raza', 'Noman Tariq']);
  assert.deepEqual(ledgerCollectors([ROWS[2], ROWS[0]]), ['Adeel Raza', 'Noman Tariq']);
  assert.deepEqual(ledgerCollectors([ROWS[4]]), []);
  assert.deepEqual(ledgerCollectors([{ collectedBy: '  ' }, { collectedBy: '' }]), []);
  assert.deepEqual(ledgerCollectors(null), []);
  assert.deepEqual(ledgerCollectors(undefined), []);
});

test('a voided entry still lists, but the summary skips it like the ledger does', () => {
  assert.deepEqual(ledgerCollectorSummary([ROWS[0], ROWS[1], ROWS[3]]), { count: 2, total: 2500 });
  assert.deepEqual(ledgerCollectorSummary([]), { count: 0, total: 0 });
  assert.deepEqual(ledgerCollectorSummary([{ amount: 'not-a-number' }, { amount: 1000 }]), { count: 2, total: 1000 });
  assert.deepEqual(ledgerCollectorSummary([{ amount: 1000, voided: true }]), { count: 0, total: 0 });
  assert.equal(ledgerCollectorSummaryText([ROWS[0], ROWS[1], ROWS[3]], 'Adeel Raza'), 'Adeel Raza: 2 entries · PKR 2,500 total');
  assert.equal(ledgerCollectorSummaryText([ROWS[0]], 'Adeel Raza'), 'Adeel Raza: 1 entry · PKR 1,000 total');
  assert.equal(ledgerCollectorSummaryText([], 'Adeel Raza'), 'Adeel Raza: 0 entries · PKR 0 total');
  assert.equal(ledgerCollectorSummaryText(ROWS, ''), '');
});

test('the collector total equals the sum of the listed non-voided entries', () => {
  const adeel = searchLedgerByCollector(ROWS, 'Adeel Raza');
  const summary = ledgerCollectorSummary(adeel);
  const listed = adeel.filter((row) => row.voided !== true).reduce((sum, row) => sum + Number(row.amount), 0);
  assert.equal(summary.total, listed);
  assert.equal(summary.total, 1000 + 1500 + 1200);
  const noman = searchLedgerByCollector(ROWS, 'Noman Tariq');
  assert.equal(ledgerCollectorSummary(noman).total, 2000);
});

test('the empty text names the collector', () => {
  assert.equal(ledgerCollectorEmptyText('Adeel Raza'), 'No entries collected by Adeel Raza.');
  assert.equal(ledgerCollectorEmptyText('Noman Tariq'), 'No entries collected by Noman Tariq.');
  assert.equal(ledgerCollectorEmptyText(''), 'No recorded payments match these filters.');
});

test('the empty text with a range names the collector and the range', () => {
  assert.equal(ledgerCollectorRangeEmptyText('Adeel Raza', '1000', '2000'), 'No entries collected by Adeel Raza between Rs 1,000 and Rs 2,000.');
  assert.equal(ledgerCollectorRangeEmptyText('Adeel Raza', '2000', '1000'), 'No entries collected by Adeel Raza between Rs 1,000 and Rs 2,000.');
  assert.equal(ledgerCollectorRangeEmptyText('Adeel Raza', 'Rs 1,000', ''), 'No entries collected by Adeel Raza of Rs 1,000 or more.');
  assert.equal(ledgerCollectorRangeEmptyText('Adeel Raza', '', '2000'), 'No entries collected by Adeel Raza up to Rs 2,000.');
  assert.equal(ledgerCollectorRangeEmptyText('Adeel Raza', '', ''), 'No entries collected by Adeel Raza.');
  assert.equal(ledgerCollectorRangeEmptyText('Adeel Raza', 'abc', 'def'), 'No entries collected by Adeel Raza.');
  assert.equal(ledgerCollectorRangeEmptyText('', '1000', '2000'), 'No recorded payments match these filters.');
});

test('the module header names no file literally and reads no storage or clock', () => {
  const module = readFileSync(new URL('../ledger-collector.js', import.meta.url), 'utf8');
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
  assert.ok(appSrc.includes("from './ledger-collector.js'"), 'app imports the collector ledger module');
  const renderStart = appSrc.indexOf('function renderTransactions()');
  const renderEnd = appSrc.indexOf('function reportStatusLabel(', renderStart);
  const renderBody = appSrc.slice(renderStart, renderEnd);
  assert.ok(renderBody.includes('normalizeLedgerCollectorFilter(transactionCollectorFilter)'), 'the render normalizes the chosen collector');
  assert.ok(renderBody.includes('searchLedgerByCollector(transactions, collector)'), 'the render narrows the ledger with the collector');
  assert.ok(renderBody.includes('ledgerCollectors(listTransactions(state))'), 'the collector options come from the full ledger');
  assert.ok(renderBody.includes("$('#lclCollectorSummary')"), 'the render updates the collector summary line');
  assert.ok(renderBody.includes('ledgerCollectorSummaryText(transactions, collector)'), 'the summary line shows the collector, count, and total');
  assert.ok(renderBody.includes('ledgerCollectorEmptyText(collector)'), 'an empty collector says so plainly');
  assert.ok(renderBody.includes('ledgerCollectorRangeEmptyText(collector, transactionAmountMin, transactionAmountMax)'), 'an empty collector inside a range names both');
});

test('wiring: choosing a collector re-renders the ledger and clearing the filters clears it', () => {
  assert.ok(appSrc.includes("$('#transactionCollectorFilter').addEventListener('change'"), 'the collector select listens for a chosen collector');
  const listenerStart = appSrc.indexOf("$('#transactionCollectorFilter').addEventListener('change'");
  const listenerBody = appSrc.slice(listenerStart, listenerStart + 300);
  assert.ok(listenerBody.includes('transactionCurrentPage = 1'), 'the listener restarts at the first page');
  assert.ok(listenerBody.includes('renderTransactions()'), 'the listener re-renders the ledger');
  const clearStart = appSrc.indexOf("$('#clearTransactionFilters').addEventListener('click'");
  const clearBody = appSrc.slice(clearStart, clearStart + 4000);
  assert.ok(clearBody.includes("$('#transactionCollectorFilter')"), 'clearing the filters clears the collector select');
  assert.ok(clearBody.includes('transactionCollectorFilter = '), 'clearing the filters resets the collector state');
});

test('wiring: the page carries the collector select and the collector summary line', () => {
  assert.ok(page.includes('id="transactionCollectorFilter"'), 'the Transactions screen has a collector select');
  assert.ok(page.includes('id="lclCollectorSummary"'), 'the collector summary line exists in the summary bar');
  const filtersStart = page.indexOf('<div class="transaction-filters">');
  const filtersEnd = page.indexOf('</div>', page.indexOf('id="rnsReceiptSearchForm"'));
  const filtersBody = page.slice(filtersStart, filtersEnd);
  assert.ok(filtersBody.includes('for="transactionCollectorFilter"'), 'the collector select is labelled');
  assert.ok(filtersBody.includes('All collectors'), 'the collector select offers all collectors');
  // The pinned first sentence of the help text stays word for word.
  assert.ok(page.includes('Customer search, recency, exact payment date, and the amount range combine'), 'the pinned help sentence is untouched');
  assert.ok(page.includes('Pick a collector to see only the entries that collector recorded'), 'the help text names the collector search');
});
