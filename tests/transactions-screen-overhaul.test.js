// Transactions Screen Overhaul (Collect tab) — one unified search
// bar, quick-filter pills, collapsible advanced filters, no duplicate
// "Today on this device" box, rows that show time instead of a
// repeated date, short shop badges, one-row pagination, hidden FAB,
// round (i), grouped Export, and the Plan 449 full-history
// per-connection fix. Pure-module behaviour is tested directly;
// app-level wiring is pinned by source-text assertions, the repo's
// pattern for app.js (no unit test imports app.js directly).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  UNIFIED_LEDGER_SEARCH_MIN_CHARS,
  normalizeUnifiedLedgerSearch,
  unifiedLedgerSearchActive,
  unifiedLedgerSearchMatches,
  searchLedgerUnified,
} from '../ledger-unified-search.js';
import { isShopCashLedgerMethod } from '../ledger-payment-method.js';
import { fullHistoryEntries } from '../full-history-list.js';
import {
  HISTORY_CONNECTION_FILTER_ALL,
  filterHistoryEntriesByConnection,
} from '../history-connection-filter.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

// --- Unified search fixtures (generic placeholders only; the
// 0301234567x phones are the repo's pattern-fake family) ---

function ledgerFixture() {
  return [
    { paymentId: 'seed-tx-01', customerId: 'seed-tx-c1', customerNumber: 101, customerName: 'Ahmed Raza', customerPhone: '03012345670', amount: 1500, date: '2026-11-10', month: '2026-11', method: 'Cash', status: 'paid', receiptNumber: 'RCPT-101-202611-01' },
    { paymentId: 'seed-tx-02', customerId: 'seed-tx-c2', customerNumber: 102, customerName: 'Bilal Hussain', customerPhone: '03012345671', amount: 2000, date: '2026-11-09', month: '2026-11', method: 'EasyPaisa', status: 'partial', transactionId: 'TRF20261109AB', receiptNumber: 'RCPT-102-202611-01' },
    { paymentId: 'seed-tx-03', customerId: 'seed-tx-c3', customerNumber: 103, customerName: 'Usman Ghani', customerPhone: '03012345672', amount: 500, date: '2026-11-09', month: '2026-11', method: 'Cash at Hassan Balla shop', status: 'paid', receiptNumber: 'RCPT-103-202611-01' },
    { paymentId: 'seed-tx-04', customerId: 'seed-tx-c4', customerNumber: 104, customerName: 'Saad Malik', customerPhone: '03012345673', amount: 3000, date: '2026-11-08', month: '2026-11', method: 'JazzCash', status: 'paid', receiptNumber: 'RCPT-104-202611-01' },
  ];
}

const ids = (rows) => rows.map((row) => row.paymentId);

test('unified search: inactive below three characters, full list kept in order', () => {
  const list = ledgerFixture();
  assert.equal(UNIFIED_LEDGER_SEARCH_MIN_CHARS, 3);
  assert.deepEqual(normalizeUnifiedLedgerSearch(''), { query: '', active: false });
  assert.deepEqual(normalizeUnifiedLedgerSearch('ab'), { query: '', active: false });
  assert.equal(unifiedLedgerSearchActive('ab'), false);
  assert.equal(unifiedLedgerSearchActive('bil'), true);
  const out = searchLedgerUnified(list, 'ab');
  assert.deepEqual(ids(out), ids(list));
  assert.notEqual(out, list);
});

test('unified search: a name fragment finds the payment (live search)', () => {
  assert.deepEqual(ids(searchLedgerUnified(ledgerFixture(), 'bilal')), ['seed-tx-02']);
  // Amount fragments match too: '1500' is in the 1500 payment only.
  assert.deepEqual(ids(searchLedgerUnified(ledgerFixture(), '1500')), ['seed-tx-01']);
});

test('unified search: a reference finds the payment even though no live field matches it', () => {
  // 'TRF20261109AB' matches no name, phone, amount, or customer
  // number — only the reference search can find it.
  assert.deepEqual(ids(searchLedgerUnified(ledgerFixture(), 'TRF20261109AB')), ['seed-tx-02']);
  assert.deepEqual(ids(searchLedgerUnified(ledgerFixture(), 'TRF2026')), ['seed-tx-02']);
});

test('unified search: an exact receipt number finds exactly its transaction', () => {
  assert.deepEqual(ids(searchLedgerUnified(ledgerFixture(), 'RCPT-103-202611-01')), ['seed-tx-03']);
  // Case and spacing are ignored, like the receipt-number search.
  assert.deepEqual(ids(searchLedgerUnified(ledgerFixture(), 'rcpt-103-202611-01')), ['seed-tx-03']);
  // A partial receipt number is not a match — receipt matching is exact.
  assert.deepEqual(ids(searchLedgerUnified(ledgerFixture(), 'RCPT-103')), []);
});

test('unified search: a derived receipt number is found through the deriver', () => {
  const list = ledgerFixture().map((row) => ({ ...row, receiptNumber: undefined }));
  const derive = (row) => (row.paymentId === 'seed-tx-04' ? 'RCPT-104-DERIVED-01' : '');
  assert.deepEqual(ids(searchLedgerUnified(list, 'RCPT-104-DERIVED-01', { deriveReceiptNumber: derive })), ['seed-tx-04']);
  assert.deepEqual(ids(searchLedgerUnified(list, 'RCPT-104-DERIVED-01')), []);
});

test('unified search: no match is empty, and the input list is never mutated', () => {
  const list = ledgerFixture();
  const snapshot = JSON.stringify(list);
  assert.deepEqual(searchLedgerUnified(list, 'zzz-no-such'), []);
  assert.equal(JSON.stringify(list), snapshot);
});

test('unified search: per-entry matcher covers live, reference, and receipt', () => {
  const list = ledgerFixture();
  assert.equal(unifiedLedgerSearchMatches(list[0], 'ab'), true);
  assert.equal(unifiedLedgerSearchMatches(list[1], 'bilal'), true);
  assert.equal(unifiedLedgerSearchMatches(list[1], 'TRF20261109AB'), true);
  assert.equal(unifiedLedgerSearchMatches(list[2], 'RCPT-103-202611-01'), true);
  assert.equal(unifiedLedgerSearchMatches(list[2], 'RCPT-103'), false);
  assert.equal(unifiedLedgerSearchMatches(null, 'bilal'), false);
});

// --- Shop Cash pill predicate ---

test('shop cash: only "Cash at … shop" variants count, plain Cash does not', () => {
  assert.equal(isShopCashLedgerMethod('Cash at Hassan Balla shop'), true);
  assert.equal(isShopCashLedgerMethod('Cash at Waseem Abbasi shop'), true);
  assert.equal(isShopCashLedgerMethod('CASH AT HASSAN BALLA SHOP'), true);
  assert.equal(isShopCashLedgerMethod('Cash at Hassan shop'), true);
  assert.equal(isShopCashLedgerMethod('Cash'), false);
  assert.equal(isShopCashLedgerMethod('EasyPaisa'), false);
  assert.equal(isShopCashLedgerMethod('Bank Transfer'), false);
  assert.equal(isShopCashLedgerMethod(''), false);
  assert.equal(isShopCashLedgerMethod(null), false);
});

// --- Plan 449: full-history entries carry their connection ---

function bill(overrides = {}) {
  return { id: 'BILL-1', month: '2026-11', dueDate: '2026-11-05', dueAmount: 3000, status: 'pending', payments: [], ...overrides };
}

function payment(overrides = {}) {
  return { id: 'PAY-1', amount: 3000, date: '2026-11-06', method: 'Cash', ...overrides };
}

test('Plan 449: a payment recorded against a connection carries it, and the named view lists it', () => {
  const entries = fullHistoryEntries({
    customerId: 'CUST-1',
    bills: [bill({ payments: [payment({ connection: 'shop' })] })],
  });
  const paymentEntry = entries.find((entry) => entry.type === 'payment');
  assert.equal(paymentEntry.connection, 'shop');
  // The charge is untagged — the bill itself names no connection —
  // so the named view lists only the payment; the charge appears
  // only under All connections.
  assert.equal('connection' in entries.find((entry) => entry.type === 'charge'), false);
  assert.deepEqual(
    filterHistoryEntriesByConnection(entries, 'shop').map((entry) => entry.type),
    ['payment'],
  );
  assert.deepEqual(filterHistoryEntriesByConnection(entries, 'house'), []);
  assert.equal(filterHistoryEntriesByConnection(entries, HISTORY_CONNECTION_FILTER_ALL).length, entries.length);
});

test('Plan 449: a payment with no connection of its own inherits its bill’s connection', () => {
  const entries = fullHistoryEntries({
    customerId: 'CUST-1',
    bills: [bill({ connection: 'house', payments: [payment({})] })],
  });
  assert.equal(entries.find((entry) => entry.type === 'payment').connection, 'house');
  assert.equal(entries.find((entry) => entry.type === 'charge').connection, 'house');
});

test('Plan 449: an untagged entry stays untagged and appears only under All connections', () => {
  const entries = fullHistoryEntries({
    customerId: 'CUST-1',
    bills: [bill({ payments: [payment({})] })],
  });
  const paymentEntry = entries.find((entry) => entry.type === 'payment');
  assert.equal('connection' in paymentEntry, false);
  assert.deepEqual(filterHistoryEntriesByConnection(entries, 'shop'), []);
  assert.equal(filterHistoryEntriesByConnection(entries, HISTORY_CONNECTION_FILTER_ALL).length, entries.length);
});

// --- Source pins: markup, wiring, and CSS ---

test('top bar: one unified search input, six quick pills, and a collapsible advanced panel', () => {
  const html = read('index.html');
  // The unified input lives in the top bar, before the filters panel.
  assert.ok(html.indexOf('id="transactionLiveSearch"') < html.indexOf('id="txAdvancedFilters"'));
  // Transactions & Recent Receipts Polish §2: the unified placeholder
  // is the spec's "Search customer, #ID, amount, or receipt #...".
  assert.ok(html.includes('placeholder="Search customer, #ID, amount, or receipt #..."'));
  assert.ok(html.includes('id="txAdvancedFiltersToggle"'));
  assert.ok(html.includes('aria-controls="txAdvancedFilters"'));
  assert.ok(html.includes('<div class="transaction-filters" id="txAdvancedFilters" hidden>'));
  for (const pill of ['all', 'today', 'cash', 'easypaisa', 'shop', 'partial']) {
    assert.ok(html.includes(`data-tx-pill="${pill}"`), `${pill} pill present`);
  }
  // The old second search boxes are gone from the top level: refine
  // and reference live inside the advanced panel only.
  assert.ok(html.indexOf('id="transactionRefineSearch"') > html.indexOf('id="txAdvancedFilters"'));
  assert.ok(html.indexOf('id="transactionReferenceSearch"') > html.indexOf('id="txAdvancedFilters"'));
});

test('dedupe: no "Today on this device" box remains anywhere', () => {
  const html = read('index.html');
  assert.equal(html.includes('oqsQueueSection'), false);
  assert.equal(html.includes('Today on this device'), false);
  const app = read('app.js');
  assert.equal(app.includes('offlineQueueSectionHtml'), false);
  assert.equal(app.includes('todayQueueEntries'), false);
  // The receipt code the box used to show is not lost with it: the
  // row detail passes the deterministic deriver, so a payment with
  // no stored number still shows its derived REC-… code.
  assert.ok(app.includes('receiptNumberSearchRowMarkup(transaction, generateReceiptNumber)'));
});

test('export: one Export menu near the summary, CSV plus text, footer text hidden on this view', () => {
  const html = read('index.html');
  assert.ok(html.includes('id="txExportMenu"'));
  assert.ok(html.includes('id="exportTransactionsCsvBtn"'));
  assert.ok(html.includes('id="txExportAllTxtBtn"'));
  // The CSV button moved out of the filter actions into the menu.
  assert.ok(html.indexOf('id="exportTransactionsCsvBtn"') < html.indexOf('id="txAdvancedFilters"'));
  const css = read('styles.css');
  assert.ok(css.includes('body.sr-screen-mode[data-screen="transactions"] #exportAllButton { display: none; }'));
});

test('footer eye: the backup toggle is a labelled control now', () => {
  const html = read('index.html');
  assert.ok(html.includes('<span class="backup-toggle-label">Backup</span>'));
  const css = read('styles.css');
  assert.ok(css.includes('.backup-controls-toggle { width: auto;'));
});

test('pagination: one flex row, icon-only arrows, full page text kept', () => {
  const html = read('index.html');
  assert.ok(html.includes('aria-label="Previous transactions page">←</button>'));
  assert.ok(html.includes('aria-label="Next transactions page">→</button>'));
  const css = read('styles.css');
  assert.ok(css.includes('#transactionPagination { flex-wrap: nowrap;'));
  assert.ok(css.includes('#transactionPagination .pagination-size-label { width: auto;'));
  const app = read('app.js');
  assert.ok(app.includes('pageInfo.textContent = `Page ${paged.page} of ${paged.totalPages}`;'));
});

test('rows: short shop label, time-or-mohalla instead of the repeated date', () => {
  const app = read('app.js');
  assert.ok(app.includes('shortTransactionMethodLabel(transaction.method)'));
  assert.ok(app.includes('queueEntryTime(transaction.recordedAt) || transaction.collectionMohalla'));
  assert.ok(app.includes('<span class="tx-when">'));
  assert.equal(app.includes('<span class="tx-date">'), false);
  const css = read('payments-list.css');
  assert.ok(css.includes('.tx-when { flex-shrink: 0;'));
  assert.ok(css.includes('flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis;'));
  assert.equal(css.includes('.tx-date'), false);
});

test('(i) circle: the base rule lifts the 44px floor with !important', () => {
  const css = read('components.css');
  assert.ok(css.includes('min-height: 28px !important;'));
});

test('wiring: pills, toggle, unified search, and pill sync in app.js', () => {
  const app = read('app.js');
  assert.ok(app.includes("import { searchLedgerUnified } from './ledger-unified-search.js';"));
  assert.ok(app.includes("import { queueEntryTime } from './offline-queue-status.js';"));
  assert.ok(app.includes('isShopCashLedgerMethod'));
  assert.ok(app.includes('transactions = searchLedgerUnified(transactions, liveSearch.query, { deriveReceiptNumber: generateReceiptNumber });'));
  assert.ok(app.includes('applyTransactionQuickPill(pill.dataset.txPill)'));
  assert.ok(app.includes('resetTransactionFilterState()'));
  assert.ok(app.includes('syncTransactionQuickPills(listTransactions(state), todayKey)'));
  assert.ok(app.includes("$('#txExportAllTxtBtn')?.addEventListener('click'"));
  assert.ok(app.includes("$('#txAdvancedFiltersToggle')?.addEventListener('click'"));
});

test('router: the Transactions screen no longer moves its filters below the list', () => {
  const router = read('screen-router.js');
  const entry = router.slice(router.indexOf('transactions: {'), router.indexOf('reports: {'));
  assert.equal(entry.includes('filters:'), false);
  const css = read('screen-router.css');
  assert.equal(css.includes('data-screen="transactions"] .transactions-pane > .sr-moved-filters'), false);
});
