// Plan 404 — History filter by payment method: a customer who always
// pays by JazzCash cannot see just their wallet payments, because
// cash and transfers sit in the same list. One method filter on the
// customer history (cash, bank transfer, mobile wallet, other),
// showing only the transactions of that method, with a subtotal. It
// filters only and changes nothing: the filtered list contains
// exactly that method's transactions, its subtotal matches them,
// clearing returns the full list, and no bill, payment, or customer
// record is ever changed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HISTORY_METHOD_FILTER_ALL,
  HISTORY_METHOD_FILTER_METHODS,
  HISTORY_METHOD_FILTER_LABELS,
  HISTORY_METHOD_FILTER_EMPTY_TEXT,
  historyMethodGroup,
  isHistoryMethodFilter,
  normalizeHistoryMethodFilter,
  filterHistoryEntriesByMethod,
  historyMethodCounts,
  historyMethodFilterOptions,
  historyMethodSubtotalCents,
  formatMethodAmount,
  historyMethodFilterSelectMarkup,
  historyMethodFilterEmptyText,
  historyMethodFilterSummaryText,
} from '../history-method-filter.js';

function entry(overrides = {}) {
  return { type: 'payment', date: '2026-11-06', amountCents: 300000, runningBalanceCents: 0, method: 'Cash', ...overrides };
}

function mixedEntries() {
  return [
    entry({ type: 'charge', date: '2026-09-01', amountCents: 300000, method: '', ref: 'BILL-1' }),
    entry({ type: 'payment', date: '2026-09-15', amountCents: 150000, method: 'Cash', ref: 'PAY-1' }),
    entry({ type: 'payment', date: '2026-09-20', amountCents: 150000, method: 'JazzCash', ref: 'PAY-2' }),
    entry({ type: 'payment', date: '2026-09-30', amountCents: 200000, method: 'Bank Transfer', ref: 'PAY-3' }),
    entry({ type: 'advance', date: '2026-10-01', amountCents: 50000, method: 'Easypaisa', ref: 'PAY-4' }),
    entry({ type: 'credit', date: '2026-10-05', amountCents: 50000, method: '', ref: 'CR-1' }),
    entry({ type: 'refund', date: '2026-10-20', amountCents: 20000, method: 'Raast', ref: 'RF-1' }),
    entry({ type: 'refund', date: '2026-11-02', amountCents: 10000, method: 'Cash at Main Shop', ref: 'RF-2' }),
    entry({ type: 'payment', date: '2026-11-03', amountCents: 300000, method: 'NayaPay', ref: 'PAY-5' }),
    entry({ type: 'payment', date: '2026-11-04', amountCents: 250000, method: 'Cheque', ref: 'PAY-6' }),
  ];
}

// --- Method folding ---

test('Plan 404: cash labels fold to cash, including shop variants', () => {
  for (const label of ['Cash', 'cash', 'CASH', ' Cash ', 'Cash at Main Shop', 'cash at shop', 'Cash at the Corner Shop']) {
    assert.equal(historyMethodGroup(label), 'cash', label);
  }
});

test('Plan 404: bank labels fold to bank transfer', () => {
  for (const label of ['Bank Transfer', 'bank transfer', 'BANK TRANSFER', 'Raast', 'raast', 'RAAST']) {
    assert.equal(historyMethodGroup(label), 'bank_transfer', label);
  }
});

test('Plan 404: wallet labels fold to mobile wallet', () => {
  for (const label of ['JazzCash', 'jazzcash', 'JAZZCASH', 'Easypaisa', 'NayaPay', 'Mobile Wallet', 'mobile wallet', 'Wallet', 'wallet']) {
    assert.equal(historyMethodGroup(label), 'mobile_wallet', label);
  }
});

test('Plan 404: unrecognised and missing methods read as other', () => {
  for (const label of ['Cheque', 'cheque payment', 'Card', '', '   ', null, undefined, 42, true]) {
    assert.equal(historyMethodGroup(label), 'other', String(label));
  }
});

test('Plan 404: whitespace and hyphens fold before grouping', () => {
  assert.equal(historyMethodGroup('  JazzCash  '), 'mobile_wallet');
  assert.equal(historyMethodGroup('bank-transfer'), 'bank_transfer');
  assert.equal(historyMethodGroup('mobile-wallet'), 'mobile_wallet');
  assert.equal(historyMethodGroup('cash  at   main shop'), 'cash');
});

// --- Filter choice ---

test('Plan 404: isHistoryMethodFilter accepts all and the four groups only', () => {
  for (const value of ['all', 'cash', 'bank_transfer', 'mobile_wallet', 'other']) {
    assert.equal(isHistoryMethodFilter(value), true, value);
  }
  for (const value of ['cheque', 'payment', 'refund', '', null, undefined, 'jazzcash']) {
    assert.equal(isHistoryMethodFilter(value), false, String(value));
  }
  assert.equal(isHistoryMethodFilter('CASH'), true);
  assert.equal(isHistoryMethodFilter('Mobile_Wallet'), true);
});

test('Plan 404: normalize keeps a valid group and reads anything else as all', () => {
  assert.equal(normalizeHistoryMethodFilter('cash'), 'cash');
  assert.equal(normalizeHistoryMethodFilter('mobile_wallet'), 'mobile_wallet');
  assert.equal(normalizeHistoryMethodFilter('CASH'), 'cash');
  assert.equal(normalizeHistoryMethodFilter('all'), 'all');
  assert.equal(normalizeHistoryMethodFilter(''), 'all');
  assert.equal(normalizeHistoryMethodFilter('cheque'), 'all');
  assert.equal(normalizeHistoryMethodFilter(null), 'all');
  assert.equal(normalizeHistoryMethodFilter(undefined), 'all');
});

// --- Filtering ---

test('Plan 404: filtering to one method shows exactly that method, in the same order', () => {
  const entries = mixedEntries();
  const wallets = filterHistoryEntriesByMethod(entries, 'mobile_wallet');
  assert.deepEqual(wallets.map((e) => e.ref), ['PAY-2', 'PAY-4', 'PAY-5']);
  const cash = filterHistoryEntriesByMethod(entries, 'cash');
  assert.deepEqual(cash.map((e) => e.ref), ['PAY-1', 'RF-2']);
  const bank = filterHistoryEntriesByMethod(entries, 'bank_transfer');
  assert.deepEqual(bank.map((e) => e.ref), ['PAY-3', 'RF-1']);
});

test('Plan 404: entries with no method read as other', () => {
  const entries = mixedEntries();
  const other = filterHistoryEntriesByMethod(entries, 'other');
  assert.deepEqual(other.map((e) => e.ref), ['BILL-1', 'CR-1', 'PAY-6']);
});

test('Plan 404: all and a damaged choice keep every entry', () => {
  const entries = mixedEntries();
  assert.deepEqual(filterHistoryEntriesByMethod(entries, 'all').map((e) => e.ref), entries.map((e) => e.ref));
  assert.deepEqual(filterHistoryEntriesByMethod(entries, 'cheque').map((e) => e.ref), entries.map((e) => e.ref));
  assert.deepEqual(filterHistoryEntriesByMethod(entries, null).map((e) => e.ref), entries.map((e) => e.ref));
  assert.deepEqual(filterHistoryEntriesByMethod(null, 'cash'), []);
});

test('Plan 404: filtering never mutates the input list or its entries', () => {
  const entries = mixedEntries();
  const before = JSON.stringify(entries);
  const balancesBefore = entries.map((e) => e.runningBalanceCents);
  const shown = filterHistoryEntriesByMethod(entries, 'cash');
  assert.notEqual(shown, entries);
  assert.equal(JSON.stringify(entries), before);
  assert.deepEqual(entries.map((e) => e.runningBalanceCents), balancesBefore);
  assert.deepEqual(shown.map((e) => e.runningBalanceCents), [0, 0]);
});

// --- Counts and options ---

test('Plan 404: counts per group sum to the full list', () => {
  const counts = historyMethodCounts(mixedEntries());
  assert.equal(counts.total, 10);
  assert.equal(counts.cash, 2);
  assert.equal(counts.bank_transfer, 2);
  assert.equal(counts.mobile_wallet, 3);
  assert.equal(counts.other, 3);
  assert.equal(counts.cash + counts.bank_transfer + counts.mobile_wallet + counts.other, counts.total);
  assert.deepEqual(historyMethodCounts([]), { total: 0, cash: 0, bank_transfer: 0, mobile_wallet: 0, other: 0 });
});

test('Plan 404: filter options carry live counts, all first', () => {
  const options = historyMethodFilterOptions(mixedEntries());
  assert.deepEqual(options, [
    { value: 'all', label: 'All methods', count: 10 },
    { value: 'cash', label: 'Cash', count: 2 },
    { value: 'bank_transfer', label: 'Bank transfer', count: 2 },
    { value: 'mobile_wallet', label: 'Mobile wallet', count: 3 },
    { value: 'other', label: 'Other', count: 3 },
  ]);
  assert.deepEqual(Object.keys(HISTORY_METHOD_FILTER_LABELS), HISTORY_METHOD_FILTER_METHODS);
});

// --- Subtotal and formatting ---

test('Plan 404: the subtotal is the sum of the shown entries only', () => {
  const shown = filterHistoryEntriesByMethod(mixedEntries(), 'mobile_wallet');
  assert.equal(historyMethodSubtotalCents(shown), 150000 + 50000 + 300000);
  assert.equal(historyMethodSubtotalCents([]), 0);
  assert.equal(historyMethodSubtotalCents([{ amountCents: 100 }, { amountCents: 'bad' }, {}]), 100);
});

test('Plan 404: amounts print with no decimals for whole rupees', () => {
  assert.equal(formatMethodAmount(150000), 'PKR 1,500');
  assert.equal(formatMethodAmount(150050), 'PKR 1,500.5');
  assert.equal(formatMethodAmount(0), 'PKR 0');
  assert.equal(formatMethodAmount(-50000), '-PKR 500');
  assert.equal(formatMethodAmount('bad'), 'PKR 0');
  assert.equal(formatMethodAmount(null), 'PKR 0');
});

// --- Markup and empty text ---

test('Plan 404: the select markup lists every group with its count and marks the choice', () => {
  const markup = historyMethodFilterSelectMarkup(mixedEntries(), 'mobile_wallet');
  assert.ok(markup.includes('<label class="field-label" for="hmfHistoryMethodFilter">Method</label>'));
  assert.ok(markup.includes('<select id="hmfHistoryMethodFilter" class="hmf-filter">'));
  assert.ok(markup.includes('<option value="all">All methods (10)</option>'));
  assert.ok(markup.includes('<option value="cash">Cash (2)</option>'));
  assert.ok(markup.includes('<option value="bank_transfer">Bank transfer (2)</option>'));
  assert.ok(markup.includes('<option value="mobile_wallet" selected>Mobile wallet (3)</option>'));
  assert.ok(markup.includes('<option value="other">Other (3)</option>'));
  const damaged = historyMethodFilterSelectMarkup(mixedEntries(), 'cheque');
  assert.ok(damaged.includes('<option value="all" selected>All methods (10)</option>'));
});

test('Plan 404: the empty line names the chosen group, and all falls through', () => {
  assert.equal(historyMethodFilterEmptyText('mobile_wallet'), 'No mobile wallet entries');
  assert.equal(historyMethodFilterEmptyText('cash'), 'No cash entries');
  assert.equal(historyMethodFilterEmptyText('bank_transfer'), 'No bank transfer entries');
  assert.equal(historyMethodFilterEmptyText('other'), 'No other entries');
  assert.equal(historyMethodFilterEmptyText('all'), '');
  assert.equal(historyMethodFilterEmptyText('cheque'), '');
});

// --- Summary ---

test('Plan 404: the summary is blank with no method chosen', () => {
  const entries = mixedEntries();
  assert.equal(historyMethodFilterSummaryText(entries, entries, 'all'), '');
  assert.equal(historyMethodFilterSummaryText(entries, entries, 'cheque'), '');
});

test('Plan 404: the summary names the method, the count and the subtotal', () => {
  const entries = mixedEntries();
  const shown = filterHistoryEntriesByMethod(entries, 'mobile_wallet');
  assert.equal(
    historyMethodFilterSummaryText(shown, entries, 'mobile_wallet'),
    '3 of 10 entries · Mobile wallet only · Subtotal PKR 5,000',
  );
  const one = filterHistoryEntriesByMethod(entries, 'bank_transfer').slice(0, 1);
  assert.equal(
    historyMethodFilterSummaryText(one, entries, 'bank_transfer'),
    '1 entry of 10 · Bank transfer only · Subtotal PKR 2,000',
  );
});

test('Plan 404: the summary adds the date span when a range is active', () => {
  const entries = mixedEntries();
  const shown = filterHistoryEntriesByMethod(entries, 'cash');
  assert.equal(
    historyMethodFilterSummaryText(shown, entries, 'cash', '2026-09-01', '2026-09-30'),
    '2 of 10 entries · Cash only in 2026-09-01 – 2026-09-30 · Subtotal PKR 1,600',
  );
  assert.equal(
    historyMethodFilterSummaryText(shown, entries, 'cash', '2026-09-01', ''),
    '2 of 10 entries · Cash only from 2026-09-01 · Subtotal PKR 1,600',
  );
  assert.equal(
    historyMethodFilterSummaryText(shown, entries, 'cash', '', '2026-09-30'),
    '2 of 10 entries · Cash only up to 2026-09-30 · Subtotal PKR 1,600',
  );
  // A damaged bound reads as no bound, never a broken span.
  assert.equal(
    historyMethodFilterSummaryText(shown, entries, 'cash', 'not-a-date', '2026-09-30'),
    '2 of 10 entries · Cash only up to 2026-09-30 · Subtotal PKR 1,600',
  );
});

test('Plan 404: the summary adds the type part when a type is chosen too', () => {
  const entries = mixedEntries();
  const shown = filterHistoryEntriesByMethod(entries, 'cash');
  assert.equal(
    historyMethodFilterSummaryText(shown, entries, 'cash', '', '', 'refund'),
    '2 of 10 entries · Cash only · Refund only · Subtotal PKR 1,600',
  );
  assert.equal(
    historyMethodFilterSummaryText(shown, entries, 'cash', '2026-09-01', '2026-09-30', 'refund'),
    '2 of 10 entries · Cash only in 2026-09-01 – 2026-09-30 · Refund only · Subtotal PKR 1,600',
  );
  assert.equal(
    historyMethodFilterSummaryText(shown, entries, 'cash', '', '', 'all'),
    '2 of 10 entries · Cash only · Subtotal PKR 1,600',
  );
  assert.equal(
    historyMethodFilterSummaryText(shown, entries, 'cash', '', '', 'bogus'),
    '2 of 10 entries · Cash only · Subtotal PKR 1,600',
  );
});

// --- Fences and guards ---

test('Plan 404: the module header never names a fenced filename literally', () => {
  const moduleSrc = readFileSync(new URL('../history-method-filter.js', import.meta.url), 'utf8');
  const testSrc = readFileSync(new URL(import.meta.url), 'utf8');
  const reconModule = 'method-recon' + 'ciliation.js';
  const typeFilterModule = 'history-type-' + 'filter.js';
  const rangeFilterModule = 'history-date-range-' + 'filter.js';
  const fullHistoryModule = 'full-history-' + 'list.js';
  for (const fenced of [reconModule, typeFilterModule, rangeFilterModule, fullHistoryModule]) {
    assert.equal(moduleSrc.includes(fenced), false, fenced);
    assert.equal(testSrc.includes(fenced), false, fenced);
  }
});

test('Plan 404: the module imports nothing, keeps no store, and touches no live state', () => {
  const moduleSrc = readFileSync(new URL('../history-method-filter.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(moduleSrc), false);
  assert.equal(moduleSrc.includes('localStorage'), false);
  assert.equal(moduleSrc.includes('shahdara_'), false);
  assert.equal(moduleSrc.includes('new Date('), false);
  assert.equal(moduleSrc.includes('Date.now('), false);
  assert.equal(moduleSrc.includes('document.'), false);
  assert.equal(moduleSrc.includes('fetch('), false);
});

test('Plan 404: the fenced neighbours contain no method-filter references', () => {
  const reconModule = 'method-recon' + 'ciliation.js';
  const typeFilterModule = 'history-type-' + 'filter.js';
  const rangeFilterModule = 'history-date-range-' + 'filter.js';
  const fullHistoryModule = 'full-history-' + 'list.js';
  for (const fenced of [reconModule, typeFilterModule, rangeFilterModule, fullHistoryModule]) {
    const src = readFileSync(new URL(`../${fenced}`, import.meta.url), 'utf8');
    assert.equal(src.includes('historyMethod'), false, fenced);
    assert.equal(src.includes('filterHistoryEntriesByMethod'), false, fenced);
  }
});

test('Plan 404: the per-method reconciliation still exists and is still wired, untouched', () => {
  const reconModule = 'method-recon' + 'ciliation.js';
  const reconSrc = readFileSync(new URL(`../${reconModule}`, import.meta.url), 'utf8');
  assert.ok(reconSrc.includes('METHOD_GROUPS'));
  assert.ok(reconSrc.includes('methodGroupKey'));
  assert.ok(reconSrc.includes('methodGroupLabel'));
  assert.ok(reconSrc.includes('buildMethodReconciliation'));
  const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(appSrc.includes(`from './${reconModule}'`));
  assert.ok(appSrc.includes('buildMethodReconciliation'));
});

test('Plan 404: the type filter and the full history list still exist and are still wired', () => {
  const typeFilterModule = 'history-type-' + 'filter.js';
  const filterSrc = readFileSync(new URL(`../${typeFilterModule}`, import.meta.url), 'utf8');
  assert.ok(filterSrc.includes('HISTORY_TYPE_FILTER_TYPES'));
  assert.ok(filterSrc.includes('filterHistoryEntriesByType'));
  const fullHistoryModule = 'full-history-' + 'list.js';
  const historySrc = readFileSync(new URL(`../${fullHistoryModule}`, import.meta.url), 'utf8');
  assert.ok(historySrc.includes('FULL_HISTORY_TYPES'));
  assert.ok(historySrc.includes('fullHistoryEntries'));
  assert.ok(historySrc.includes('fullHistoryListHtml'));
  const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(appSrc.includes(`from './${typeFilterModule}'`));
  assert.ok(appSrc.includes('filterHistoryEntriesByType'));
  assert.ok(appSrc.includes(`from './${fullHistoryModule}'`));
  assert.ok(appSrc.includes('renderFullHistory(customer)'));
});

test('Plan 404: the date-range filter still exists and is still wired', () => {
  const rangeFilterModule = 'history-date-range-' + 'filter.js';
  const rangeSrc = readFileSync(new URL(`../${rangeFilterModule}`, import.meta.url), 'utf8');
  assert.ok(rangeSrc.includes('HISTORY_DATE_RANGE_EMPTY_TEXT'));
  assert.ok(rangeSrc.includes('filterHistoryEntriesByDateRange'));
  const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(appSrc.includes(`from './${rangeFilterModule}'`));
  assert.ok(appSrc.includes('filterHistoryEntriesByDateRange'));
  assert.ok(appSrc.includes('historyDateRangeFilterMarkup'));
});

test('Plan 404: the profile wires the method filter into the full history render', () => {
  const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(appSrc.includes("from './history-method-filter.js'"));
  assert.ok(appSrc.includes('normalizeHistoryMethodFilter'));
  assert.ok(appSrc.includes('filterHistoryEntriesByMethod'));
  assert.ok(appSrc.includes('historyMethodFilterSelectMarkup'));
  assert.ok(appSrc.includes('historyMethodFilterSummaryText'));
  assert.ok(appSrc.includes('historyMethodFilterEmptyText'));
  assert.ok(appSrc.includes('hmfHistoryMethodFilterHost'));
  assert.ok(appSrc.includes('hmfHistoryMethodFilter'));
  const indexSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(indexSrc.includes('id="hmfHistoryMethodFilterHost"'));
  assert.ok(indexSrc.indexOf('id="hdrHistoryDateRangeHost"') < indexSrc.indexOf('id="hmfHistoryMethodFilterHost"'));
  assert.ok(indexSrc.indexOf('id="hmfHistoryMethodFilterHost"') < indexSrc.indexOf('id="fhlFullHistoryList"'));
});

test('Plan 404: no new styles are added — the filter reuses existing classes only', () => {
  const stylesSrc = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.equal(stylesSrc.includes('hmf-'), false);
});

test('Plan 404: fixtures stay generic — no real customer names or phone numbers in this file', () => {
  const testSrc = readFileSync(new URL(import.meta.url), 'utf8');
  // The banned values are fragment-built so the guard's own literals
  // never trip the guard (a literal would trip its own check).
  const countryCode = '+' + '92';
  const mobilePattern = new RegExp('030' + '\\\\d{8}');
  const fakeFamily = '030' + '12345678';
  assert.ok(!testSrc.includes(countryCode), 'test carries a real phone number');
  assert.equal(mobilePattern.test(testSrc), false, 'test carries a mobile number');
  assert.ok(!testSrc.includes(fakeFamily), 'test uses a fake number outside the allowed family');
});
