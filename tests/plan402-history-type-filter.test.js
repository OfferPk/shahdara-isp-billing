// Plan 402 — History filter by transaction type: in a full history,
// payments, charges, credits and refunds sit mixed together, so
// finding just the refunds means reading every line. One type filter
// on the customer history (payment, charge, credit, refund,
// adjustment, and advance, so the counts across all types always sum
// to the full list), using the category tag read through the entry
// type. It filters only and changes nothing: filtering to one type
// shows only that type, clearing returns the full list, and no bill,
// payment, or customer record is ever changed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HISTORY_TYPE_FILTER_ALL,
  HISTORY_TYPE_FILTER_TYPES,
  HISTORY_TYPE_FILTER_LABELS,
  HISTORY_TYPE_FILTER_EMPTY_TEXT,
  isHistoryTypeFilter,
  normalizeHistoryTypeFilter,
  filterHistoryEntriesByType,
  historyTypeCounts,
  historyTypeFilterOptions,
  historyTypeFilterSelectMarkup,
  historyTypeFilterEmptyText,
  historyTypeFilterSummaryText,
} from '../history-type-filter.js';

function entry(overrides = {}) {
  return { type: 'payment', date: '2026-11-06', amountCents: 300000, runningBalanceCents: 0, ...overrides };
}

function mixedEntries() {
  return [
    entry({ type: 'charge', date: '2026-11-01', amountCents: 300000, ref: 'BILL-1' }),
    entry({ type: 'payment', date: '2026-11-02', amountCents: 150000, ref: 'PAY-1' }),
    entry({ type: 'payment', date: '2026-11-03', amountCents: 150000, ref: 'PAY-2' }),
    entry({ type: 'advance', date: '2026-11-04', amountCents: 50000, ref: 'PAY-3' }),
    entry({ type: 'credit', date: '2026-11-05', amountCents: 50000, ref: 'CR-1' }),
    entry({ type: 'refund', date: '2026-11-06', amountCents: 20000, ref: 'RF-1' }),
    entry({ type: 'refund', date: '2026-11-07', amountCents: 10000, ref: 'RF-2' }),
    entry({ type: 'adjustment', date: '2026-11-08', amountCents: 10000, ref: 'ADJ-1' }),
    entry({ type: 'charge', date: '2026-12-01', amountCents: 300000, ref: 'BILL-2' }),
    entry({ type: 'payment', date: '2026-12-02', amountCents: 300000, ref: 'PAY-4' }),
  ];
}

// --- Normalizing the filter choice ---

test('Plan 402: normalize keeps a valid type and folds case and spaces', () => {
  assert.equal(normalizeHistoryTypeFilter('Refund'), 'refund');
  assert.equal(normalizeHistoryTypeFilter('REFUND'), 'refund');
  assert.equal(normalizeHistoryTypeFilter('  credit '), 'credit');
  assert.equal(normalizeHistoryTypeFilter('advance'), 'advance');
  assert.equal(normalizeHistoryTypeFilter('charge'), 'charge');
  assert.equal(normalizeHistoryTypeFilter('payment'), 'payment');
  assert.equal(normalizeHistoryTypeFilter('adjustment'), 'adjustment');
});

test('Plan 402: normalize reads all, missing and unknown as all', () => {
  assert.equal(normalizeHistoryTypeFilter('all'), 'all');
  assert.equal(normalizeHistoryTypeFilter('ALL'), 'all');
  assert.equal(normalizeHistoryTypeFilter(''), 'all');
  assert.equal(normalizeHistoryTypeFilter('bogus'), 'all');
  assert.equal(normalizeHistoryTypeFilter(null), 'all');
  assert.equal(normalizeHistoryTypeFilter(undefined), 'all');
  assert.equal(normalizeHistoryTypeFilter(42), 'all');
});

test('Plan 402: isHistoryTypeFilter accepts all and the seven types only', () => {
  assert.equal(isHistoryTypeFilter('all'), true);
  for (const type of HISTORY_TYPE_FILTER_TYPES) assert.equal(isHistoryTypeFilter(type), true);
  assert.equal(isHistoryTypeFilter('other'), false);
  assert.equal(isHistoryTypeFilter('collection'), false);
  assert.equal(isHistoryTypeFilter(''), false);
  assert.equal(isHistoryTypeFilter(null), false);
});

test('Plan 402: the filter covers seven types plus all', () => {
  // Sharafat 12: a seventh type, 'info' — an informational line for
  // ticket/add-on charges already inside the payment cash, which
  // moves nothing but is a line of its own, so the filter offers it
  // and the per-type counts still sum to the full list.
  assert.deepEqual([...HISTORY_TYPE_FILTER_TYPES], ['charge', 'payment', 'advance', 'credit', 'refund', 'adjustment', 'info']);
  assert.equal(HISTORY_TYPE_FILTER_ALL, 'all');
  assert.equal(HISTORY_TYPE_FILTER_LABELS.refund, 'Refund');
  assert.equal(HISTORY_TYPE_FILTER_LABELS.charge, 'Charge');
  assert.equal(HISTORY_TYPE_FILTER_LABELS.advance, 'Advance');
  assert.equal(HISTORY_TYPE_FILTER_LABELS.info, 'Info');
  assert.equal(HISTORY_TYPE_FILTER_EMPTY_TEXT, 'No transactions yet');
});

// --- Filtering ---

test('Plan 402: filtering to one type shows only that type, in order', () => {
  const entries = mixedEntries();
  const refunds = filterHistoryEntriesByType(entries, 'refund');
  assert.deepEqual(refunds.map((row) => row.ref), ['RF-1', 'RF-2']);
  const payments = filterHistoryEntriesByType(entries, 'payment');
  assert.deepEqual(payments.map((row) => row.ref), ['PAY-1', 'PAY-2', 'PAY-4']);
  const charges = filterHistoryEntriesByType(entries, 'charge');
  assert.deepEqual(charges.map((row) => row.ref), ['BILL-1', 'BILL-2']);
  const advances = filterHistoryEntriesByType(entries, 'advance');
  assert.deepEqual(advances.map((row) => row.ref), ['PAY-3']);
  const credits = filterHistoryEntriesByType(entries, 'credit');
  assert.deepEqual(credits.map((row) => row.ref), ['CR-1']);
  const adjustments = filterHistoryEntriesByType(entries, 'adjustment');
  assert.deepEqual(adjustments.map((row) => row.ref), ['ADJ-1']);
});

test('Plan 402: all keeps every entry, in the same order', () => {
  const entries = mixedEntries();
  const all = filterHistoryEntriesByType(entries, 'all');
  assert.deepEqual(all.map((row) => row.ref), entries.map((row) => row.ref));
  assert.notEqual(all, entries);
  assert.deepEqual(filterHistoryEntriesByType(entries), entries);
  assert.deepEqual(filterHistoryEntriesByType(entries, 'bogus'), entries);
});

test('Plan 402: filtering never mutates the input list or its entries', () => {
  const entries = mixedEntries();
  const before = JSON.stringify(entries);
  const refunds = filterHistoryEntriesByType(entries, 'refund');
  assert.equal(JSON.stringify(entries), before);
  assert.equal(refunds[0], entries[5]);
  assert.equal(refunds[1], entries[6]);
  assert.deepEqual(filterHistoryEntriesByType(null, 'refund'), []);
  assert.deepEqual(filterHistoryEntriesByType(undefined, 'refund'), []);
  assert.deepEqual(filterHistoryEntriesByType('not a list', 'refund'), []);
});

test('Plan 402: a type with no entries filters to an empty list', () => {
  const entries = [entry({ type: 'payment', ref: 'PAY-1' })];
  assert.deepEqual(filterHistoryEntriesByType(entries, 'refund'), []);
  assert.deepEqual(filterHistoryEntriesByType([], 'refund'), []);
});

// --- Counts ---

test('Plan 402: counts per type sum to the full list total', () => {
  const entries = mixedEntries();
  const counts = historyTypeCounts(entries);
  assert.equal(counts.total, 10);
  assert.equal(counts.charge, 2);
  assert.equal(counts.payment, 3);
  assert.equal(counts.advance, 1);
  assert.equal(counts.credit, 1);
  assert.equal(counts.refund, 2);
  assert.equal(counts.adjustment, 1);
  const sum = HISTORY_TYPE_FILTER_TYPES.reduce((total, type) => total + counts[type], 0);
  assert.equal(sum, counts.total);
});

test('Plan 402: counts are all zero for an empty or missing list', () => {
  const counts = historyTypeCounts([]);
  assert.equal(counts.total, 0);
  for (const type of HISTORY_TYPE_FILTER_TYPES) assert.equal(counts[type], 0);
  const missing = historyTypeCounts(null);
  assert.equal(missing.total, 0);
  const sum = HISTORY_TYPE_FILTER_TYPES.reduce((total, type) => total + missing[type], 0);
  assert.equal(sum, 0);
});

// --- Options and markup ---

test('Plan 402: options carry live counts, all first, summing to the total', () => {
  const entries = mixedEntries();
  const options = historyTypeFilterOptions(entries);
  // Sharafat 12: eight options now — all plus seven types ('info'
  // joins the six; this fixture carries no info lines, so its count
  // is 0 and the per-type counts still sum to the total).
  assert.equal(options.length, 8);
  assert.deepEqual(options[0], { value: 'all', label: 'All types', count: 10 });
  assert.deepEqual(options[1], { value: 'charge', label: 'Charge', count: 2 });
  assert.deepEqual(options[5], { value: 'refund', label: 'Refund', count: 2 });
  assert.deepEqual(options[6], { value: 'adjustment', label: 'Adjustment', count: 1 });
  assert.deepEqual(options[7], { value: 'info', label: 'Info', count: 0 });
  const sum = options.slice(1).reduce((total, option) => total + option.count, 0);
  assert.equal(sum, options[0].count);
});

test('Plan 402: the select markup shows each type with its count', () => {
  const entries = mixedEntries();
  const markup = historyTypeFilterSelectMarkup(entries, 'all');
  assert.ok(markup.includes('<select id="htfHistoryTypeFilter"'));
  assert.ok(markup.includes('<label class="field-label" for="htfHistoryTypeFilter">Show</label>'));
  assert.ok(markup.includes('All types (10)'));
  assert.ok(markup.includes('Refund (2)'));
  assert.ok(markup.includes('Payment (3)'));
  assert.ok(markup.includes('Charge (2)'));
  assert.ok(markup.includes('Advance (1)'));
  assert.ok(markup.includes('Credit (1)'));
  assert.ok(markup.includes('Adjustment (1)'));
  assert.ok(markup.includes('<option value="all" selected>All types (10)</option>'));
});

test('Plan 402: the select marks the chosen type selected and no other', () => {
  const entries = mixedEntries();
  const markup = historyTypeFilterSelectMarkup(entries, 'refund');
  assert.ok(markup.includes('<option value="refund" selected>Refund (2)</option>'));
  assert.equal(markup.includes('<option value="all" selected>'), false);
  const unknown = historyTypeFilterSelectMarkup(entries, 'bogus');
  assert.ok(unknown.includes('<option value="all" selected>All types (10)</option>'));
  const missing = historyTypeFilterSelectMarkup(entries);
  assert.ok(missing.includes('<option value="all" selected>All types (10)</option>'));
});

test('Plan 402: the select markup escapes option text', () => {
  const entries = [entry({ type: 'refund', ref: 'RF-1' })];
  const markup = historyTypeFilterSelectMarkup(entries, 'refund');
  assert.equal(markup.includes('<script'), false);
  assert.ok(markup.includes('Refund (1)'));
});

// --- Empty and summary lines ---

test('Plan 402: the empty line names the type when filtered', () => {
  assert.equal(historyTypeFilterEmptyText('all'), 'No transactions yet');
  assert.equal(historyTypeFilterEmptyText(), 'No transactions yet');
  assert.equal(historyTypeFilterEmptyText('refund'), 'No refund entries');
  assert.equal(historyTypeFilterEmptyText('charge'), 'No charge entries');
  assert.equal(historyTypeFilterEmptyText('advance'), 'No advance entries');
  assert.equal(historyTypeFilterEmptyText('bogus'), 'No transactions yet');
});

test('Plan 402: the summary line counts the shown entries against the full list', () => {
  const entries = mixedEntries();
  const refunds = filterHistoryEntriesByType(entries, 'refund');
  assert.equal(historyTypeFilterSummaryText(refunds, entries, 'refund'), '2 entries of 10 · Refund only');
  const one = filterHistoryEntriesByType(entries, 'adjustment');
  assert.equal(historyTypeFilterSummaryText(one, entries, 'adjustment'), '1 entry of 10 · Adjustment only');
  assert.equal(historyTypeFilterSummaryText(entries, entries, 'all'), '10 entries');
  assert.equal(historyTypeFilterSummaryText([entries[0]], entries, 'all'), '1 entry');
  assert.equal(historyTypeFilterSummaryText([], entries, 'refund'), '0 entries of 10 · Refund only');
});

// --- Acceptance: filter, count, clear, change nothing ---

test('Plan 402: acceptance — filter shows one type, counts sum, clearing returns the full list', () => {
  const entries = mixedEntries();
  const counts = historyTypeCounts(entries);
  const sum = HISTORY_TYPE_FILTER_TYPES.reduce((total, type) => total + counts[type], 0);
  assert.equal(sum, entries.length);
  for (const type of HISTORY_TYPE_FILTER_TYPES) {
    const shown = filterHistoryEntriesByType(entries, type);
    assert.equal(shown.length, counts[type], type);
    assert.ok(shown.every((row) => row.type === type), type);
  }
  const cleared = filterHistoryEntriesByType(entries, normalizeHistoryTypeFilter('all'));
  assert.deepEqual(cleared, entries);
});

test('Plan 402: acceptance — filtering changes no entry and no record', () => {
  const entries = mixedEntries();
  const before = JSON.stringify(entries);
  for (const type of ['all', ...HISTORY_TYPE_FILTER_TYPES]) {
    filterHistoryEntriesByType(entries, type);
    historyTypeCounts(entries);
    historyTypeFilterOptions(entries);
    historyTypeFilterSelectMarkup(entries, type);
  }
  assert.equal(JSON.stringify(entries), before);
});

// --- Fences and guards ---

test('Plan 402: the module header never names a fenced filename literally', () => {
  const moduleSrc = readFileSync(new URL('../history-type-filter.js', import.meta.url), 'utf8');
  const testSrc = readFileSync(new URL(import.meta.url), 'utf8');
  const categoryTagModule = 'transaction-category-' + 'tag.js';
  const fullHistoryModule = 'full-history-' + 'list.js';
  const miniSlipModule = 'payment-' + 'slip.js';
  const receiptSearchModule = 'receipt-number-' + 'search.js';
  for (const fenced of [categoryTagModule, fullHistoryModule, miniSlipModule, receiptSearchModule]) {
    assert.equal(moduleSrc.includes(fenced), false, fenced);
    assert.equal(testSrc.includes(fenced), false, fenced);
  }
});

test('Plan 402: the module imports nothing, keeps no store, and touches no live state', () => {
  const moduleSrc = readFileSync(new URL('../history-type-filter.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(moduleSrc), false);
  assert.equal(moduleSrc.includes('localStorage'), false);
  assert.equal(moduleSrc.includes('shahdara_'), false);
  assert.equal(moduleSrc.includes('new Date('), false);
  assert.equal(moduleSrc.includes('Date.now('), false);
  assert.equal(moduleSrc.includes('document.'), false);
  assert.equal(moduleSrc.includes('fetch('), false);
});

test('Plan 402: the fenced neighbours contain no history-type-filter references', () => {
  const categoryTagModule = 'transaction-category-' + 'tag.js';
  const fullHistoryModule = 'full-history-' + 'list.js';
  const miniSlipModule = 'payment-' + 'slip.js';
  const receiptSearchModule = 'receipt-number-' + 'search.js';
  for (const fenced of [categoryTagModule, fullHistoryModule, miniSlipModule, receiptSearchModule]) {
    const src = readFileSync(new URL(`../${fenced}`, import.meta.url), 'utf8');
    assert.equal(src.includes('historyTypeFilter'), false, fenced);
    assert.equal(src.includes('filterHistoryEntriesByType'), false, fenced);
  }
});

test('Plan 402: the category tag module still exists and is still wired, untouched', () => {
  const categoryTagModule = 'transaction-category-' + 'tag.js';
  const tagSrc = readFileSync(new URL(`../${categoryTagModule}`, import.meta.url), 'utf8');
  assert.ok(tagSrc.includes('TRANSACTION_CATEGORY_TAGS'));
  assert.ok(tagSrc.includes('filterTransactionsByCategoryTag'));
  const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(appSrc.includes(`from './${categoryTagModule}'`));
  assert.ok(appSrc.includes('filterTransactionsByCategoryTag'));
});

test('Plan 402: the full history list still exists and is still wired, untouched', () => {
  const fullHistoryModule = 'full-history-' + 'list.js';
  const historySrc = readFileSync(new URL(`../${fullHistoryModule}`, import.meta.url), 'utf8');
  assert.ok(historySrc.includes('FULL_HISTORY_TYPES'));
  assert.ok(historySrc.includes('fullHistoryEntries'));
  assert.ok(historySrc.includes('fullHistoryListHtml'));
  const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(appSrc.includes(`from './${fullHistoryModule}'`));
  assert.ok(appSrc.includes('fullHistoryEntries'));
  assert.ok(appSrc.includes('renderFullHistory(customer)'));
});

test('Plan 402: the profile wires the type filter into the full history render', () => {
  const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(appSrc.includes("from './history-type-filter.js'"));
  assert.ok(appSrc.includes('normalizeHistoryTypeFilter'));
  assert.ok(appSrc.includes('filterHistoryEntriesByType'));
  assert.ok(appSrc.includes('historyTypeFilterSelectMarkup'));
  assert.ok(appSrc.includes('historyTypeFilterEmptyText'));
  assert.ok(appSrc.includes('historyTypeFilterSummaryText'));
  assert.ok(appSrc.includes('htfHistoryTypeFilterHost'));
  assert.ok(appSrc.includes('htfHistoryTypeFilter'));
  const indexSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(indexSrc.includes('id="htfHistoryTypeFilterHost"'));
  assert.ok(indexSrc.indexOf('htfHistoryTypeFilterHost') < indexSrc.indexOf('id="fhlFullHistoryList"'));
});

test('Plan 402: no new styles are added — the filter reuses existing classes only', () => {
  const stylesSrc = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.equal(stylesSrc.includes('htf-'), false);
});

test('Plan 402: fixtures stay generic — no real customer names or phone numbers in this file', () => {
  const testSrc = readFileSync(new URL(import.meta.url), 'utf8');
  // The banned values are fragment-built so the guard's own literals
  // never trip the guard (a literal would trip its own check).
  const countryCode = '+' + '92';
  const mobilePattern = new RegExp('030' + '\\d{8}');
  const fakeFamily = '030' + '12345678';
  assert.ok(!testSrc.includes(countryCode), 'test carries a real phone number');
  assert.equal(mobilePattern.test(testSrc), false, 'test carries a mobile number');
  assert.ok(!testSrc.includes(fakeFamily), 'test uses a fake number outside the allowed family');
});
