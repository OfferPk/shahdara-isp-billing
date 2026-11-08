import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LEDGER_REFERENCE_SEARCH_MIN_CHARS,
  normalizeLedgerReferenceSearch,
  ledgerReferenceSearchActive,
  ledgerReferenceSearchMatches,
  searchLedgerByReference,
  ledgerReferenceSearchSummary,
  ledgerReferenceSearchSummaryText,
  ledgerReferenceSearchEmptyText,
  ledgerReferenceClearanceLabel,
  ledgerReferenceClearanceSuffix,
} from '../ledger-reference-search.js';

// Plan 467 — Search ledger by cheque or transfer reference number.
//
// Fixtures are invented and pattern-fake only: names are "First
// Last" fixtures (never a real customer), phones are the 03012345678
// family the PII ratchet allows, record ids are seed-* fixtures,
// and the references are invented TRF/CHQ fragments.
const ROWS = [
  { paymentId: 'seed-467-01', customerId: 'seed-467-c1', customerNumber: 101, customerName: 'Raja Ahmed', customerPhone: '03012345678', amount: 1000, date: '2026-03-05', month: '2026-03', method: 'Bank Transfer', status: 'paid', collectedBy: 'Saad', transactionId: 'TRF20261101AB' },
  { paymentId: 'seed-467-02', customerId: 'seed-467-c2', customerNumber: 102, customerName: 'Faisal Khan', customerPhone: '03012345679', amount: 1500, date: '2026-03-20', month: '2026-03', method: 'Bank Transfer', status: 'paid', collectedBy: 'Saad', transactionId: 'TRF20261102CD' },
  // The older reference field is the fallback when no
  // transaction id is stored.
  { paymentId: 'seed-467-03', customerId: 'seed-467-c3', customerNumber: 103, customerName: 'Bilal Hussain', customerPhone: '03012345670', amount: 2000, date: '2026-02-28', month: '2026-02', method: 'Cheque', status: 'partial', collectedBy: 'Saad', reference: 'CHQ778899' },
  // A voided entry carrying a matching reference: it still
  // lists as history, but the reference line skips it like the
  // ledger does.
  { paymentId: 'seed-467-04', customerId: 'seed-467-c4', customerNumber: 104, customerName: 'Usman Ghani', customerPhone: '03012345671', amount: 500, date: '2026-03-02', month: '2026-03', method: 'Bank Transfer', status: 'paid', voided: true, collectedBy: 'Saad', transactionId: 'TRF20261101AB' },
  // No reference at all never matches an active search.
  { paymentId: 'seed-467-05', customerId: 'seed-467-c5', customerNumber: 105, customerName: 'Ahmed Raza', customerPhone: '03012345672', amount: 3000, date: '2026-02-15', month: '2026-02', method: 'Cash', status: 'paid' },
  // A cash payment with a transaction id is still searchable by
  // its reference — the search is by reference, not by method.
  { paymentId: 'seed-467-06', customerId: 'seed-467-c6', customerNumber: 106, customerName: 'Saad Malik', customerPhone: '03012345673', amount: 1200, date: '2026-04-02', month: '2026-03', method: 'Cash', status: 'paid', transactionId: 'WALLET999' },
];

const CLEARANCES = [
  { id: 'seed-467-cl1', paymentId: 'seed-467-01', customer: 'Raja Ahmed', method: 'bank_transfer', status: 'pending', dateRecorded: '2026-03-05' },
  { id: 'seed-467-cl2', paymentId: 'seed-467-02', customer: 'Faisal Khan', method: 'bank_transfer', status: 'cleared', dateRecorded: '2026-03-20', decisionDate: '2026-03-21' },
  { id: 'seed-467-cl3', paymentId: 'seed-467-03', customer: 'Bilal Hussain', method: 'cheque', status: 'bounced', dateRecorded: '2026-02-28', decisionDate: '2026-03-01', note: 'Insufficient funds' },
];

const ids = (list) => list.map((row) => row.paymentId);

test('a reference search goes live at three characters, like the live search', () => {
  assert.equal(LEDGER_REFERENCE_SEARCH_MIN_CHARS, 3);
  assert.deepEqual(normalizeLedgerReferenceSearch('TRF'), { query: 'TRF', active: true });
  assert.deepEqual(normalizeLedgerReferenceSearch('  TRF2026  '), { query: 'TRF2026', active: true });
  assert.deepEqual(normalizeLedgerReferenceSearch('TR'), { query: '', active: false });
  assert.deepEqual(normalizeLedgerReferenceSearch(''), { query: '', active: false });
  assert.deepEqual(normalizeLedgerReferenceSearch('   '), { query: '', active: false });
  assert.deepEqual(normalizeLedgerReferenceSearch(null), { query: '', active: false });
  assert.deepEqual(normalizeLedgerReferenceSearch(undefined), { query: '', active: false });
  assert.deepEqual(normalizeLedgerReferenceSearch(123), { query: '', active: false });
  assert.equal(ledgerReferenceSearchActive('TRF'), true);
  assert.equal(ledgerReferenceSearchActive('TR'), false);
  assert.equal(ledgerReferenceSearchActive(''), false);
});

test('matching is a case-insensitive substring of the payment reference', () => {
  assert.equal(ledgerReferenceSearchMatches(ROWS[0], 'TRF20261101AB'), true);
  assert.equal(ledgerReferenceSearchMatches(ROWS[0], 'trf20261101ab'), true);
  assert.equal(ledgerReferenceSearchMatches(ROWS[0], '20261101'), true);
  assert.equal(ledgerReferenceSearchMatches(ROWS[0], 'TRF'), true);
  assert.equal(ledgerReferenceSearchMatches(ROWS[1], 'TRF20261101AB'), false);
  assert.equal(ledgerReferenceSearchMatches(ROWS[1], '20261102'), true);
  // The older reference field is the fallback.
  assert.equal(ledgerReferenceSearchMatches(ROWS[2], 'CHQ778899'), true);
  assert.equal(ledgerReferenceSearchMatches(ROWS[2], 'chq77'), true);
  assert.equal(ledgerReferenceSearchMatches(ROWS[2], 'TRF'), false);
  // The transaction id wins over the older field when both are stored.
  assert.equal(ledgerReferenceSearchMatches({ ...ROWS[2], transactionId: 'TRF000111' }, 'TRF000111'), true);
  assert.equal(ledgerReferenceSearchMatches({ ...ROWS[2], transactionId: 'TRF000111' }, 'CHQ778899'), false);
  // An entry with no reference never matches an active search.
  assert.equal(ledgerReferenceSearchMatches(ROWS[4], 'TRF'), false);
  assert.equal(ledgerReferenceSearchMatches(ROWS[4], 'CHQ'), false);
  assert.equal(ledgerReferenceSearchMatches(null, 'TRF'), false);
  assert.equal(ledgerReferenceSearchMatches('not-an-entry', 'TRF'), false);
  // An inactive search matches every entry.
  assert.equal(ledgerReferenceSearchMatches(ROWS[0], ''), true);
  assert.equal(ledgerReferenceSearchMatches(ROWS[4], ''), true);
  assert.equal(ledgerReferenceSearchMatches(null, ''), true);
});

test('one reference fragment returns every entry carrying it and no other', () => {
  assert.deepEqual(ids(searchLedgerByReference(ROWS, 'TRF20261101AB')), ['seed-467-01', 'seed-467-04']);
  assert.deepEqual(ids(searchLedgerByReference(ROWS, 'trf2026')), ['seed-467-01', 'seed-467-02', 'seed-467-04']);
  assert.deepEqual(ids(searchLedgerByReference(ROWS, 'CHQ778899')), ['seed-467-03']);
  assert.deepEqual(ids(searchLedgerByReference(ROWS, 'WALLET999')), ['seed-467-06']);
  assert.deepEqual(ids(searchLedgerByReference(ROWS, 'ZZZ999')), []);
});

test('with no reference typed every entry is kept, in the same order, and the input is never mutated', () => {
  const input = [ROWS[2], ROWS[0], ROWS[1]];
  const before = JSON.stringify(input);
  const result = searchLedgerByReference(input, 'TRF');
  assert.deepEqual(ids(result), ['seed-467-01', 'seed-467-02']);
  assert.notEqual(result, input);
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(searchLedgerByReference(ROWS, ''), [...ROWS]);
  assert.notEqual(searchLedgerByReference(ROWS, ''), ROWS);
  assert.deepEqual(searchLedgerByReference(ROWS, 'TR'), [...ROWS]);
  assert.deepEqual(searchLedgerByReference(null, 'TRF'), []);
  assert.deepEqual(searchLedgerByReference(undefined, 'TRF'), []);
});

test('a voided entry still lists, but the summary skips it like the ledger does', () => {
  assert.deepEqual(ledgerReferenceSearchSummary([ROWS[0], ROWS[1], ROWS[3]]), { count: 2, total: 2500 });
  assert.deepEqual(ledgerReferenceSearchSummary([]), { count: 0, total: 0 });
  assert.deepEqual(ledgerReferenceSearchSummary([{ amount: 'not-a-number' }, { amount: 1000 }]), { count: 2, total: 1000 });
  assert.deepEqual(ledgerReferenceSearchSummary([{ amount: 1000, voided: true }]), { count: 0, total: 0 });
  assert.equal(ledgerReferenceSearchSummaryText([ROWS[0], ROWS[3]], 'TRF20261101AB'), '"TRF20261101AB": 1 entry · PKR 1,000 total');
  assert.equal(ledgerReferenceSearchSummaryText([ROWS[0], ROWS[1]], 'TRF'), '"TRF": 2 entries · PKR 2,500 total');
  assert.equal(ledgerReferenceSearchSummaryText([], 'TRF'), '"TRF": 0 entries · PKR 0 total');
  assert.equal(ledgerReferenceSearchSummaryText(ROWS, ''), '"": 5 entries · PKR 8,700 total');
});

test('the reference total equals the sum of the listed non-voided entries', () => {
  const matched = searchLedgerByReference(ROWS, 'TRF20261101AB');
  const summary = ledgerReferenceSearchSummary(matched);
  const listed = matched.filter((row) => row.voided !== true).reduce((sum, row) => sum + Number(row.amount), 0);
  assert.equal(summary.total, listed);
  assert.equal(summary.total, 1000);
  const all = searchLedgerByReference(ROWS, 'TRF2026');
  assert.equal(ledgerReferenceSearchSummary(all).total, 1000 + 1500);
});

test('an unknown reference says so plainly', () => {
  assert.equal(ledgerReferenceSearchEmptyText('ZZZ999'), 'No entries with reference "ZZZ999".');
  assert.equal(ledgerReferenceSearchEmptyText('trf000'), 'No entries with reference "trf000".');
  assert.equal(ledgerReferenceSearchEmptyText(''), 'No recorded payments match these filters.');
  assert.equal(ledgerReferenceSearchEmptyText('TR'), 'No recorded payments match these filters.');
});

test('the clearance state reads in plain words, or nothing when untracked', () => {
  assert.equal(ledgerReferenceClearanceLabel(CLEARANCES, 'seed-467-01'), 'Pending clearance');
  assert.equal(ledgerReferenceClearanceLabel(CLEARANCES, 'seed-467-02'), 'Cleared');
  assert.equal(ledgerReferenceClearanceLabel(CLEARANCES, 'seed-467-03'), 'Bounced');
  // A payment with no clearance record has no clearance state.
  assert.equal(ledgerReferenceClearanceLabel(CLEARANCES, 'seed-467-05'), '');
  assert.equal(ledgerReferenceClearanceLabel(CLEARANCES, 'seed-467-06'), '');
  assert.equal(ledgerReferenceClearanceLabel(CLEARANCES, 'seed-467-99'), '');
  assert.equal(ledgerReferenceClearanceLabel([], 'seed-467-01'), '');
  assert.equal(ledgerReferenceClearanceLabel(null, 'seed-467-01'), '');
  assert.equal(ledgerReferenceClearanceLabel(CLEARANCES, ''), '');
  assert.equal(ledgerReferenceClearanceLabel(CLEARANCES, null), '');
});

test('the clearance suffix slots into the row meta line, or stays empty', () => {
  assert.equal(ledgerReferenceClearanceSuffix(CLEARANCES, 'seed-467-01'), ' · Clearance: Pending clearance');
  assert.equal(ledgerReferenceClearanceSuffix(CLEARANCES, 'seed-467-02'), ' · Clearance: Cleared');
  assert.equal(ledgerReferenceClearanceSuffix(CLEARANCES, 'seed-467-03'), ' · Clearance: Bounced');
  assert.equal(ledgerReferenceClearanceSuffix(CLEARANCES, 'seed-467-05'), '');
  assert.equal(ledgerReferenceClearanceSuffix([], 'seed-467-01'), '');
});

test('the module header names no file literally and reads no storage or clock', () => {
  const module = readFileSync(new URL('../ledger-reference-search.js', import.meta.url), 'utf8');
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
  assert.ok(appSrc.includes("from './ledger-reference-search.js'"), 'app imports the reference-search ledger module');
  const renderStart = appSrc.indexOf('function renderTransactions()');
  const renderEnd = appSrc.indexOf('function reportStatusLabel(', renderStart);
  const renderBody = appSrc.slice(renderStart, renderEnd);
  assert.ok(renderBody.includes('normalizeLedgerReferenceSearch(transactionReferenceSearch)'), 'the render normalizes the typed reference');
  assert.ok(renderBody.includes('searchLedgerByReference(transactions, referenceSearch.query)'), 'the render narrows the ledger with the reference');
  assert.ok(renderBody.includes("$('#lrsReferenceSummary')"), 'the render updates the reference summary line');
  assert.ok(renderBody.includes('ledgerReferenceSearchSummaryText(transactions, referenceSearch.query)'), 'the summary line shows the reference, count, and total');
  assert.ok(renderBody.includes('ledgerReferenceSearchEmptyText(referenceSearch.query)'), 'an unknown reference says so plainly');
  assert.ok(renderBody.includes('ledgerReferenceClearanceSuffix(referenceClearances, transaction.paymentId)'), 'a matched row names its clearance state');
  assert.ok(renderBody.includes('loadPaymentClearance()'), 'the render reads the clearance records for matched rows');
});

test('wiring: typing a reference re-renders the ledger and clearing the filters clears it', () => {
  assert.ok(appSrc.includes("$('#transactionReferenceSearch').addEventListener('input'"), 'the reference box listens for typed text');
  const listenerStart = appSrc.indexOf("$('#transactionReferenceSearch').addEventListener('input'");
  const listenerBody = appSrc.slice(listenerStart, listenerStart + 300);
  assert.ok(listenerBody.includes('transactionCurrentPage = 1'), 'the listener restarts at the first page');
  assert.ok(listenerBody.includes('renderTransactions()'), 'the listener re-renders the ledger');
  const clearStart = appSrc.indexOf("$('#clearTransactionFilters').addEventListener('click'");
  const clearBody = appSrc.slice(clearStart, clearStart + 4500);
  assert.ok(clearBody.includes("$('#transactionReferenceSearch')"), 'clearing the filters clears the reference box');
  assert.ok(clearBody.includes('transactionReferenceSearch = '), 'clearing the filters resets the reference state');
});

test('wiring: the page carries the reference box and the reference summary line', () => {
  assert.ok(page.includes('id="transactionReferenceSearch"'), 'the Transactions screen has a reference search box');
  assert.ok(page.includes('id="lrsReferenceSummary"'), 'the reference summary line exists in the summary bar');
  const filtersStart = page.indexOf('<div class="transaction-filters">');
  const filtersEnd = page.indexOf('</div>', page.indexOf('id="rnsReceiptSearchForm"'));
  const filtersBody = page.slice(filtersStart, filtersEnd);
  assert.ok(filtersBody.includes('for="transactionReferenceSearch"'), 'the reference box is labelled');
  assert.ok(filtersBody.includes('Cheque or transfer reference'), 'the reference box is named in plain words');
  // The pinned first sentence of the help text stays word for word.
  assert.ok(page.includes('Customer search, recency, exact payment date, and the amount range combine'), 'the pinned help sentence is untouched');
  assert.ok(page.includes('Type a cheque or transfer reference to see only the entries carrying it'), 'the help text names the reference search');
});
