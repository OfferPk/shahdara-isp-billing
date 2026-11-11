import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LIVE_LEDGER_SEARCH_MIN_CHARS,
  normalizeLiveLedgerSearch,
  liveLedgerSearchActive,
  liveLedgerSearchMatches,
  searchLedgerLive,
  ledgerLiveSearchSummary,
  ledgerLiveSearchSummaryText,
  ledgerLiveSearchEmptyText,
} from '../ledger-live-search.js';

// Plan 460 — Live ledger search as you type.
//
// Fixtures are invented and pattern-fake only: names are "First
// Last" fixtures (never a real customer), phones are the 03012345678
// family the PII ratchet allows, record ids are seed-* fixtures.
const ROWS = [
  { paymentId: 'seed-460-01', customerId: 'seed-460-c1', customerNumber: 101, customerName: 'Raja Ahmed', customerPhone: '03012345678', paidBy: 'Raja Ahmed', amount: 1000, date: '2026-11-05', method: 'Cash', status: 'paid' },
  { paymentId: 'seed-460-02', customerId: 'seed-460-c2', customerNumber: 102, customerName: 'Faisal Khan', customerPhone: '03012345679', paidBy: 'Faisal Khan', amount: 1500, date: '2026-11-04', method: 'JazzCash', status: 'paid' },
  { paymentId: 'seed-460-03', customerId: 'seed-460-c3', customerNumber: 103, customerName: 'Bilal Hussain', customerPhone: '03012345670', paidBy: 'Ahmed Raza', amount: 10000, date: '2026-11-03', method: 'Cash', status: 'partial' },
  { paymentId: 'seed-460-04', customerId: 'seed-460-c4', customerNumber: 104, customerName: 'Usman Ghani', customerPhone: '03012345671', paidBy: 'Usman Ghani', amount: 500, date: '2026-11-02', method: 'Easypaisa', status: 'paid', voided: true },
];

const ids = (list) => list.map((row) => row.paymentId);

test('the search goes live at three characters', () => {
  assert.equal(LIVE_LEDGER_SEARCH_MIN_CHARS, 3);
  assert.deepEqual(normalizeLiveLedgerSearch(''), { query: '', active: false });
  assert.deepEqual(normalizeLiveLedgerSearch('  '), { query: '', active: false });
  assert.deepEqual(normalizeLiveLedgerSearch('ra'), { query: '', active: false });
  assert.deepEqual(normalizeLiveLedgerSearch('raj'), { query: 'raj', active: true });
  assert.deepEqual(normalizeLiveLedgerSearch('  raj  '), { query: 'raj', active: true });
  assert.deepEqual(normalizeLiveLedgerSearch(null), { query: '', active: false });
  assert.deepEqual(normalizeLiveLedgerSearch(undefined), { query: '', active: false });
  assert.deepEqual(normalizeLiveLedgerSearch(1000), { query: '', active: false });
  assert.equal(liveLedgerSearchActive('ra'), false);
  assert.equal(liveLedgerSearchActive('raj'), true);
});

test('a name fragment matches the customer name, case-insensitively', () => {
  assert.equal(liveLedgerSearchMatches(ROWS[0], 'raj'), true);
  assert.equal(liveLedgerSearchMatches(ROWS[0], 'RAJA'), true);
  assert.equal(liveLedgerSearchMatches(ROWS[0], 'raja ahmed'), true);
  assert.equal(liveLedgerSearchMatches(ROWS[1], 'raj'), false);
  assert.equal(liveLedgerSearchMatches(ROWS[2], 'bil'), true);
  assert.equal(liveLedgerSearchMatches(ROWS[2], 'hussain'), true);
});

test('a name fragment also matches the payer name', () => {
  // Row 3 is Bilal Hussain, but Ahmed Raza paid for him.
  assert.equal(liveLedgerSearchMatches(ROWS[2], 'ahm'), true);
  assert.equal(liveLedgerSearchMatches(ROWS[2], 'raza'), true);
  assert.equal(liveLedgerSearchMatches(ROWS[0], 'raza'), false);
});

test('a spelling variant still finds the name, like the ledger search does', () => {
  assert.equal(liveLedgerSearchMatches(ROWS[1], 'Fesal'), true);
  assert.equal(liveLedgerSearchMatches(ROWS[1], 'fesal'), true);
  assert.equal(liveLedgerSearchMatches(ROWS[0], 'Fesal'), false);
});

test('a phone fragment matches the digits', () => {
  assert.equal(liveLedgerSearchMatches(ROWS[0], '5678'), true);
  assert.equal(liveLedgerSearchMatches(ROWS[1], '5678'), false);
  assert.equal(liveLedgerSearchMatches(ROWS[0], '0301'), true);
  assert.equal(liveLedgerSearchMatches(ROWS[3], '0301'), true);
  assert.equal(liveLedgerSearchMatches(ROWS[0], '0301-234'), true);
});

test('an amount fragment matches the amount, formatted or bare', () => {
  assert.equal(liveLedgerSearchMatches(ROWS[0], '1000'), true);
  assert.equal(liveLedgerSearchMatches(ROWS[2], '1000'), true);
  assert.equal(liveLedgerSearchMatches(ROWS[1], '1000'), false);
  assert.equal(liveLedgerSearchMatches(ROWS[0], '1,000'), true);
  assert.equal(liveLedgerSearchMatches(ROWS[1], '150'), true);
  assert.equal(liveLedgerSearchMatches(ROWS[1], '500'), true);
  assert.equal(liveLedgerSearchMatches(ROWS[3], '500'), true);
  assert.equal(liveLedgerSearchMatches(ROWS[0], '500'), false);
});

test('the customer number matches, with or without the hash', () => {
  assert.equal(liveLedgerSearchMatches(ROWS[1], '102'), true);
  assert.equal(liveLedgerSearchMatches(ROWS[1], '#102'), true);
  assert.equal(liveLedgerSearchMatches(ROWS[0], '102'), false);
});

test('method, date, month, and status are not searched here — each has its own filter', () => {
  assert.equal(liveLedgerSearchMatches(ROWS[0], 'cash'), false);
  assert.equal(liveLedgerSearchMatches(ROWS[1], 'jazzcash'), false);
  assert.equal(liveLedgerSearchMatches(ROWS[0], '2026'), false);
  assert.equal(liveLedgerSearchMatches(ROWS[0], 'paid'), false);
  assert.equal(liveLedgerSearchMatches(ROWS[0], 'zzz'), false);
});

test('an inactive search matches every entry', () => {
  assert.equal(liveLedgerSearchMatches(ROWS[0], ''), true);
  assert.equal(liveLedgerSearchMatches(ROWS[0], 'ra'), true);
  assert.equal(liveLedgerSearchMatches(null, 'raj'), false);
  assert.equal(liveLedgerSearchMatches(undefined, 'raj'), false);
});

test('each extra character narrows the list', () => {
  assert.deepEqual(ids(searchLedgerLive(ROWS, '10')), ids(ROWS));
  assert.deepEqual(ids(searchLedgerLive(ROWS, '100')), ['seed-460-01', 'seed-460-03']);
  assert.deepEqual(ids(searchLedgerLive(ROWS, '1000')), ['seed-460-01', 'seed-460-03']);
  assert.deepEqual(ids(searchLedgerLive(ROWS, '10000')), ['seed-460-03']);
  assert.deepEqual(ids(searchLedgerLive(ROWS, 'ahm')), ['seed-460-01', 'seed-460-03']);
  assert.deepEqual(ids(searchLedgerLive(ROWS, 'raja ahmed')), ['seed-460-01']);
});

test('the search keeps input order and never mutates the input', () => {
  const input = [ROWS[2], ROWS[0], ROWS[1]];
  const before = JSON.stringify(input);
  const result = searchLedgerLive(input, '1000');
  assert.deepEqual(ids(result), ['seed-460-03', 'seed-460-01']);
  assert.notEqual(result, input);
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(searchLedgerLive(ROWS, 'ra'), [...ROWS]);
  assert.notEqual(searchLedgerLive(ROWS, 'ra'), ROWS);
  assert.deepEqual(searchLedgerLive(null, 'raj'), []);
  assert.deepEqual(searchLedgerLive(undefined, 'raj'), []);
});

test('a voided entry still lists, but the summary skips it like the ledger does', () => {
  assert.deepEqual(ids(searchLedgerLive(ROWS, '500')), ['seed-460-02', 'seed-460-04']);
  assert.deepEqual(ledgerLiveSearchSummary([ROWS[0], ROWS[1], ROWS[3]]), { count: 2, total: 2500 });
  assert.deepEqual(ledgerLiveSearchSummary([]), { count: 0, total: 0 });
  assert.equal(ledgerLiveSearchSummaryText([ROWS[0], ROWS[1], ROWS[3]], 'raj'), '"raj": 2 entries · PKR 2,500 total');
  assert.equal(ledgerLiveSearchSummaryText([ROWS[2]], 'bil'), '"bil": 1 entry · PKR 10,000 total');
  assert.equal(ledgerLiveSearchSummaryText([], 'zzz'), '"zzz": 0 entries · PKR 0 total');
});

test('the empty text names the typed search', () => {
  assert.equal(ledgerLiveSearchEmptyText('raj'), 'No entries match "raj".');
  assert.equal(ledgerLiveSearchEmptyText('ra'), 'No recorded payments match these filters.');
  assert.equal(ledgerLiveSearchEmptyText(''), 'No recorded payments match these filters.');
});

test('the module header names no file literally and reads no storage or clock', () => {
  const module = readFileSync(new URL('../ledger-live-search.js', import.meta.url), 'utf8');
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
  assert.ok(appSrc.includes("from './ledger-live-search.js'"), 'app imports the live ledger search module');
  const renderStart = appSrc.indexOf('function renderTransactions()');
  const renderEnd = appSrc.indexOf('function reportStatusLabel(', renderStart);
  const renderBody = appSrc.slice(renderStart, renderEnd);
  assert.ok(renderBody.includes('normalizeLiveLedgerSearch(transactionLiveSearch)'), 'the render normalizes the typed live search');
  // Transactions Screen Overhaul: the live search now runs through
  // the unified search (live + reference + receipt in one bar) —
  // the live match is still the foundation, inside that module.
  assert.ok(renderBody.includes('searchLedgerUnified(transactions, liveSearch.query, { deriveReceiptNumber: generateReceiptNumber })'), 'the render narrows the ledger with the unified search');
  const unifiedSrc = readFileSync(new URL('../ledger-unified-search.js', import.meta.url), 'utf8');
  assert.ok(unifiedSrc.includes("from './ledger-live-search.js'"), 'the unified search still applies the live search');
  assert.ok(unifiedSrc.includes('liveLedgerSearchMatches(entry, search.query)'), 'the unified search still matches names, phones, and amounts');
  assert.ok(renderBody.includes("$('#llsLiveSummary')"), 'the render updates the live summary line');
  assert.ok(renderBody.includes('ledgerLiveSearchSummaryText(transactions, liveSearch.query)'), 'the summary line shows the typed text, count, and total');
  assert.ok(renderBody.includes('ledgerLiveSearchEmptyText(liveSearch.query)'), 'an empty live search says so plainly');
});

test('wiring: typing in the live box re-renders the ledger and clearing the filters clears it', () => {
  assert.ok(appSrc.includes("$('#transactionLiveSearch').addEventListener('input'"), 'the live box listens on every keystroke');
  const listenerStart = appSrc.indexOf("$('#transactionLiveSearch').addEventListener('input'");
  const listenerBody = appSrc.slice(listenerStart, listenerStart + 300);
  assert.ok(listenerBody.includes('transactionLiveSearch = event.currentTarget.value'), 'the listener keeps the typed text');
  assert.ok(listenerBody.includes('transactionCurrentPage = 1'), 'the listener restarts at the first page');
  assert.ok(listenerBody.includes('renderTransactions()'), 'the listener re-renders the ledger');
  const clearStart = appSrc.indexOf("$('#clearTransactionFilters').addEventListener('click'");
  const clearBody = appSrc.slice(clearStart, clearStart + 1500);
  assert.ok(clearBody.includes('resetTransactionFilterState()'), 'clearing the filters resets the transaction state');
  assert.ok(clearBody.includes("transactionQuickPill = 'all'"), 'clearing the filters restores the All pill');
  // Transactions Screen Overhaul: the per-field clearing moved into
  // resetTransactionFilterState (shared with the All pill) — the
  // clear button calls it, so the same state is reset both ways.
  const resetStart = appSrc.indexOf('function resetTransactionFilterState()');
  const resetBody = appSrc.slice(resetStart, resetStart + 2900);
  assert.ok(resetBody.includes("$('#transactionLiveSearch')"), 'the reset clears the live box');
  assert.ok(resetBody.includes("transactionLiveSearch = '';"), 'the reset clears the live search state');
});

test('wiring: the page carries the live search box and the live summary line', () => {
  assert.ok(page.includes('id="transactionLiveSearch"'), 'the Transactions screen has a live search box');
  assert.ok(page.includes('id="llsLiveSummary"'), 'the live summary line exists in the summary bar');
  // Transactions Screen Overhaul: the live box moved out of the
  // filters panel into the top search bar, with an accessible label
  // instead of a <label> — it is a search input either way.
  const topbarStart = page.indexOf('<div class="tx-topbar">');
  const topbarEnd = page.indexOf('id="txAdvancedFilters"');
  const topbarBody = page.slice(topbarStart, topbarEnd);
  assert.ok(topbarBody.includes('id="transactionLiveSearch"'), 'the live search box sits in the top bar');
  assert.ok(topbarBody.includes('aria-label="Search payments by name, phone, amount, reference, or receipt number"'), 'the live search box is labelled');
  assert.ok(topbarBody.includes('type="search"'), 'the live search box is a search input');
});
