// Plan 405 — History search by exact amount: a customer remembers
// the amount they paid — "Rs 2,000" — but not the date, and the
// history offers no way to search by amount. One amount search on
// the customer history (exact whole-rupee amount, listing every
// transaction of that amount with dates). It searches only and
// changes nothing: searching an amount returns every transaction of
// exactly that amount, in date order, or says plainly that none
// exists, and no bill, payment, or customer record is ever changed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HISTORY_AMOUNT_SEARCH_EMPTY_TEXT,
  normalizeHistoryAmountSearch,
  historyAmountSearchActive,
  searchHistoryEntriesByAmount,
  historyAmountSearchSubtotalCents,
  formatAmountSearchAmount,
  historyAmountSearchMarkup,
  historyAmountSearchEmptyText,
  historyAmountSearchSummaryText,
} from '../history-amount-search.js';

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
    entry({ type: 'payment', date: '2026-11-02', amountCents: 150050, method: 'Cash', ref: 'PAY-5' }),
    entry({ type: 'payment', date: '2026-11-03', amountCents: 300000, method: 'NayaPay', ref: 'PAY-6', voided: true }),
    entry({ type: 'payment', date: '2026-11-04', amountCents: 200000, method: 'Cash', ref: 'PAY-7' }),
  ];
}

// --- Amount normalization ---

test('Plan 405: digits, commas, spaces and Rs/PKR prefixes read as whole rupees', () => {
  assert.equal(normalizeHistoryAmountSearch('2000'), 2000);
  assert.equal(normalizeHistoryAmountSearch(' 2000 '), 2000);
  assert.equal(normalizeHistoryAmountSearch('2,000'), 2000);
  assert.equal(normalizeHistoryAmountSearch('Rs 2,000'), 2000);
  assert.equal(normalizeHistoryAmountSearch('Rs. 2000'), 2000);
  assert.equal(normalizeHistoryAmountSearch('PKR 1500'), 1500);
  assert.equal(normalizeHistoryAmountSearch('pkr1500'), 1500);
  assert.equal(normalizeHistoryAmountSearch('002000'), 2000);
  assert.equal(normalizeHistoryAmountSearch(2000), 2000);
  assert.equal(normalizeHistoryAmountSearch('300000'), 300000);
});

test('Plan 405: empty, missing, boolean, zero, negative and fractional amounts read as no search', () => {
  for (const value of ['', '   ', 'Rs', 'PKR', 'abc', '2,000.5', '1500.5', '-2000', '0', 'Rs 0', '1,50,0x']) {
    assert.equal(normalizeHistoryAmountSearch(value), null, JSON.stringify(value));
  }
  for (const value of [null, undefined, true, false, 0, -2000, 1500.5, NaN, Infinity]) {
    assert.equal(normalizeHistoryAmountSearch(value), null, String(value));
  }
});

test('Plan 405: historyAmountSearchActive is true only for a valid whole-rupee amount', () => {
  assert.equal(historyAmountSearchActive('2000'), true);
  assert.equal(historyAmountSearchActive(2000), true);
  assert.equal(historyAmountSearchActive('Rs 2,000'), true);
  assert.equal(historyAmountSearchActive(''), false);
  assert.equal(historyAmountSearchActive('abc'), false);
  assert.equal(historyAmountSearchActive(0), false);
  assert.equal(historyAmountSearchActive(null), false);
});

// --- The search itself ---

test('Plan 405: searching an amount returns every transaction of exactly that amount, in date order', () => {
  const entries = mixedEntries();
  const found = searchHistoryEntriesByAmount(entries, '2000');
  assert.deepEqual(found.map((row) => row.ref), ['PAY-3', 'PAY-7']);
  const fifteen = searchHistoryEntriesByAmount(entries, 1500);
  assert.deepEqual(fifteen.map((row) => row.ref), ['PAY-1', 'PAY-2']);
  const three = searchHistoryEntriesByAmount(entries, 'Rs 3,000');
  assert.deepEqual(three.map((row) => row.ref), ['BILL-1', 'PAY-6']);
});

test('Plan 405: with no valid amount the search keeps every entry, as a new array', () => {
  const entries = mixedEntries();
  for (const amount of ['', 'abc', null, undefined, 0]) {
    const found = searchHistoryEntriesByAmount(entries, amount);
    assert.deepEqual(found, entries);
    assert.notEqual(found, entries);
  }
  assert.deepEqual(searchHistoryEntriesByAmount(null, '2000'), []);
  assert.deepEqual(searchHistoryEntriesByAmount(undefined, '2000'), []);
});

test('Plan 405: searching an amount with no transactions returns an empty list', () => {
  assert.deepEqual(searchHistoryEntriesByAmount(mixedEntries(), '9999'), []);
  assert.deepEqual(searchHistoryEntriesByAmount([], '2000'), []);
});

test('Plan 405: an amount with paisa never matches a whole-rupee search', () => {
  const entries = mixedEntries();
  assert.deepEqual(searchHistoryEntriesByAmount(entries, '1500').map((row) => row.ref), ['PAY-1', 'PAY-2']);
  assert.deepEqual(searchHistoryEntriesByAmount(entries, '1500.5'), entries);
});

test('Plan 405: voided entries still match — they are transactions too', () => {
  const found = searchHistoryEntriesByAmount(mixedEntries(), '3000');
  assert.deepEqual(found.map((row) => row.ref), ['BILL-1', 'PAY-6']);
  assert.equal(found[1].voided, true);
});

test('Plan 405: the search never mutates the input list or its entries', () => {
  const entries = mixedEntries();
  const snapshot = JSON.stringify(entries);
  searchHistoryEntriesByAmount(entries, '2000');
  searchHistoryEntriesByAmount(entries, '');
  assert.equal(JSON.stringify(entries), snapshot);
  const missing = [entry({ ref: 'NO-AMT' }), entry({ ref: 'ALSO-NO', amountCents: undefined })];
  delete missing[0].amountCents;
  assert.deepEqual(searchHistoryEntriesByAmount(missing, '3000'), []);
});

// --- Subtotal and formatting ---

test('Plan 405: the subtotal is the sum of the shown entries only', () => {
  const entries = mixedEntries();
  assert.equal(historyAmountSearchSubtotalCents(searchHistoryEntriesByAmount(entries, '2000')), 400000);
  assert.equal(historyAmountSearchSubtotalCents(searchHistoryEntriesByAmount(entries, '1500')), 300000);
  assert.equal(historyAmountSearchSubtotalCents([]), 0);
  assert.equal(historyAmountSearchSubtotalCents(null), 0);
});

test('Plan 405: amounts print with no decimals for whole rupees and one decimal for a paisa remainder', () => {
  assert.equal(formatAmountSearchAmount(150000), 'PKR 1,500');
  assert.equal(formatAmountSearchAmount(150050), 'PKR 1,500.5');
  assert.equal(formatAmountSearchAmount(0), 'PKR 0');
  assert.equal(formatAmountSearchAmount(-200000), '-PKR 2,000');
  assert.equal(formatAmountSearchAmount(NaN), 'PKR 0');
});

// --- Markup and empty text ---

test('Plan 405: the search markup carries the label, input, placeholder and Clear button', () => {
  const markup = historyAmountSearchMarkup('2000');
  assert.ok(markup.includes('<label class="field-label" for="amtHistoryAmountSearch">Amount</label>'));
  assert.ok(markup.includes('id="amtHistoryAmountSearch"'));
  assert.ok(markup.includes('placeholder="e.g. 2000"'));
  assert.ok(markup.includes('value="2000"'));
  assert.ok(markup.includes('id="amtHistoryAmountSearchClear"'));
  assert.ok(markup.includes('>Clear</button>'));
  assert.equal(historyAmountSearchMarkup('Rs 2,000').includes('value="2000"'), true);
});

test('Plan 405: the search markup shows an empty value when no amount is searched', () => {
  assert.equal(historyAmountSearchMarkup('').includes('value=""'), true);
  assert.equal(historyAmountSearchMarkup('abc').includes('value=""'), true);
  assert.equal(historyAmountSearchMarkup(null).includes('value=""'), true);
});

test('Plan 405: the empty line names the searched amount, and stays empty with no search', () => {
  assert.equal(historyAmountSearchEmptyText('2000'), 'No transactions of PKR 2,000');
  assert.equal(historyAmountSearchEmptyText('Rs 1,500'), 'No transactions of PKR 1,500');
  assert.equal(historyAmountSearchEmptyText(''), '');
  assert.equal(historyAmountSearchEmptyText('abc'), '');
  assert.equal(HISTORY_AMOUNT_SEARCH_EMPTY_TEXT, 'No transactions of this amount');
});

// --- Summary ---

test('Plan 405: with no amount searched the summary stays empty for the other filters', () => {
  const entries = mixedEntries();
  assert.equal(historyAmountSearchSummaryText(entries, entries, '', '', '', 'all', 'all'), '');
  assert.equal(historyAmountSearchSummaryText(entries, entries, 'abc', '', '', 'all', 'all'), '');
});

test('Plan 405: the summary names the count, the amount and the subtotal', () => {
  const entries = mixedEntries();
  const shown = searchHistoryEntriesByAmount(entries, '2000');
  assert.equal(
    historyAmountSearchSummaryText(shown, entries, '2000', '', '', 'all', 'all'),
    '2 of 10 entries · PKR 2,000 only · Subtotal PKR 4,000',
  );
  const one = searchHistoryEntriesByAmount(entries, '200');
  assert.equal(
    historyAmountSearchSummaryText(one, entries, '200', '', '', 'all', 'all'),
    '1 entry of 10 · PKR 200 only · Subtotal PKR 200',
  );
  assert.equal(
    historyAmountSearchSummaryText([], entries, '9999', '', '', 'all', 'all'),
    '0 of 10 entries · PKR 9,999 only · Subtotal PKR 0',
  );
});

test('Plan 405: the summary adds the date span when a range is active, and ignores a damaged range', () => {
  const entries = mixedEntries();
  const shown = searchHistoryEntriesByAmount(entries, '2000');
  assert.equal(
    historyAmountSearchSummaryText(shown, entries, '2000', '2026-09-01', '2026-09-30', 'all', 'all'),
    '2 of 10 entries · PKR 2,000 only in 2026-09-01 – 2026-09-30 · Subtotal PKR 4,000',
  );
  assert.equal(
    historyAmountSearchSummaryText(shown, entries, '2000', '2026-09-01', '', 'all', 'all'),
    '2 of 10 entries · PKR 2,000 only from 2026-09-01 · Subtotal PKR 4,000',
  );
  assert.equal(
    historyAmountSearchSummaryText(shown, entries, '2000', '', '2026-09-30', 'all', 'all'),
    '2 of 10 entries · PKR 2,000 only up to 2026-09-30 · Subtotal PKR 4,000',
  );
  assert.equal(
    historyAmountSearchSummaryText(shown, entries, '2000', 'not-a-date', '2026-13-40', 'all', 'all'),
    '2 of 10 entries · PKR 2,000 only · Subtotal PKR 4,000',
  );
});

test('Plan 405: the summary adds the type and method parts when those filters are chosen too', () => {
  const entries = mixedEntries();
  const shown = searchHistoryEntriesByAmount(entries, '1500');
  assert.equal(
    historyAmountSearchSummaryText(shown, entries, '1500', '', '', 'refund', 'all'),
    '2 of 10 entries · PKR 1,500 only · Refund only · Subtotal PKR 3,000',
  );
  assert.equal(
    historyAmountSearchSummaryText(shown, entries, '1500', '', '', 'all', 'mobile_wallet'),
    '2 of 10 entries · PKR 1,500 only · Mobile wallet only · Subtotal PKR 3,000',
  );
  assert.equal(
    historyAmountSearchSummaryText(shown, entries, '1500', '2026-09-01', '2026-09-30', 'payment', 'cash'),
    '2 of 10 entries · PKR 1,500 only in 2026-09-01 – 2026-09-30 · Payment only · Cash only · Subtotal PKR 3,000',
  );
  assert.equal(
    historyAmountSearchSummaryText(shown, entries, '1500', '', '', 'bogus', 'bogus'),
    '2 of 10 entries · PKR 1,500 only · Subtotal PKR 3,000',
  );
});

// --- Fences and guards ---

test('Plan 405: the module header never names a fenced filename literally', () => {
  const moduleSrc = readFileSync(new URL('../history-amount-search.js', import.meta.url), 'utf8');
  const testSrc = readFileSync(new URL(import.meta.url), 'utf8');
  const receiptModule = 'receipt-number-' + 'search.js';
  const typeFilterModule = 'history-type-' + 'filter.js';
  const rangeFilterModule = 'history-date-range-' + 'filter.js';
  const methodFilterModule = 'history-method-' + 'filter.js';
  const fullHistoryModule = 'full-history-' + 'list.js';
  for (const fenced of [receiptModule, typeFilterModule, rangeFilterModule, methodFilterModule, fullHistoryModule]) {
    assert.equal(moduleSrc.includes(fenced), false, fenced);
    assert.equal(testSrc.includes(fenced), false, fenced);
  }
});

test('Plan 405: the module imports nothing, keeps no store, and touches no live state', () => {
  const moduleSrc = readFileSync(new URL('../history-amount-search.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(moduleSrc), false);
  assert.equal(moduleSrc.includes('localStorage'), false);
  assert.equal(moduleSrc.includes('shahdara_'), false);
  assert.equal(moduleSrc.includes('new Date('), false);
  assert.equal(moduleSrc.includes('Date.now('), false);
  assert.equal(moduleSrc.includes('document.'), false);
  assert.equal(moduleSrc.includes('fetch('), false);
});

test('Plan 405: the fenced neighbours contain no amount-search references', () => {
  const receiptModule = 'receipt-number-' + 'search.js';
  const typeFilterModule = 'history-type-' + 'filter.js';
  const rangeFilterModule = 'history-date-range-' + 'filter.js';
  const methodFilterModule = 'history-method-' + 'filter.js';
  const fullHistoryModule = 'full-history-' + 'list.js';
  for (const fenced of [receiptModule, typeFilterModule, rangeFilterModule, methodFilterModule, fullHistoryModule]) {
    const src = readFileSync(new URL(`../${fenced}`, import.meta.url), 'utf8');
    assert.equal(src.includes('historyAmount'), false, fenced);
    assert.equal(src.includes('searchHistoryEntriesByAmount'), false, fenced);
  }
});

test('Plan 405: the receipt-number search still exists and is still wired, untouched', () => {
  const receiptModule = 'receipt-number-' + 'search.js';
  const receiptSrc = readFileSync(new URL(`../${receiptModule}`, import.meta.url), 'utf8');
  assert.ok(receiptSrc.includes('findTransactionByReceiptNumber'));
  assert.ok(receiptSrc.includes('normalizeReceiptNumber'));
  const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(appSrc.includes(`from './${receiptModule}'`));
  assert.ok(appSrc.includes('findTransactionByReceiptNumber'));
});

test('Plan 405: the type, date-range and method filters and the full history list still exist and are still wired', () => {
  const typeFilterModule = 'history-type-' + 'filter.js';
  const filterSrc = readFileSync(new URL(`../${typeFilterModule}`, import.meta.url), 'utf8');
  assert.ok(filterSrc.includes('HISTORY_TYPE_FILTER_TYPES'));
  assert.ok(filterSrc.includes('filterHistoryEntriesByType'));
  const rangeFilterModule = 'history-date-range-' + 'filter.js';
  const rangeSrc = readFileSync(new URL(`../${rangeFilterModule}`, import.meta.url), 'utf8');
  assert.ok(rangeSrc.includes('HISTORY_DATE_RANGE_EMPTY_TEXT'));
  assert.ok(rangeSrc.includes('filterHistoryEntriesByDateRange'));
  const methodFilterModule = 'history-method-' + 'filter.js';
  const methodSrc = readFileSync(new URL(`../${methodFilterModule}`, import.meta.url), 'utf8');
  assert.ok(methodSrc.includes('HISTORY_METHOD_FILTER_METHODS'));
  assert.ok(methodSrc.includes('filterHistoryEntriesByMethod'));
  const fullHistoryModule = 'full-history-' + 'list.js';
  const historySrc = readFileSync(new URL(`../${fullHistoryModule}`, import.meta.url), 'utf8');
  assert.ok(historySrc.includes('FULL_HISTORY_TYPES'));
  assert.ok(historySrc.includes('fullHistoryEntries'));
  assert.ok(historySrc.includes('fullHistoryListHtml'));
  const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(appSrc.includes(`from './${typeFilterModule}'`));
  assert.ok(appSrc.includes('filterHistoryEntriesByType'));
  assert.ok(appSrc.includes(`from './${rangeFilterModule}'`));
  assert.ok(appSrc.includes('filterHistoryEntriesByDateRange'));
  assert.ok(appSrc.includes(`from './${methodFilterModule}'`));
  assert.ok(appSrc.includes('filterHistoryEntriesByMethod'));
  assert.ok(appSrc.includes(`from './${fullHistoryModule}'`));
  assert.ok(appSrc.includes('renderFullHistory(customer)'));
});

test('Plan 405: the profile wires the amount search into the full history render', () => {
  const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(appSrc.includes("from './history-amount-search.js'"));
  assert.ok(appSrc.includes('normalizeHistoryAmountSearch'));
  assert.ok(appSrc.includes('searchHistoryEntriesByAmount'));
  assert.ok(appSrc.includes('historyAmountSearchMarkup'));
  assert.ok(appSrc.includes('historyAmountSearchSummaryText'));
  assert.ok(appSrc.includes('historyAmountSearchEmptyText'));
  assert.ok(appSrc.includes('amtHistoryAmountSearchHost'));
  assert.ok(appSrc.includes('amtHistoryAmountSearch'));
  const indexSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(indexSrc.includes('id="amtHistoryAmountSearchHost"'));
  assert.ok(indexSrc.indexOf('id="hmfHistoryMethodFilterHost"') < indexSrc.indexOf('id="amtHistoryAmountSearchHost"'));
  assert.ok(indexSrc.indexOf('id="amtHistoryAmountSearchHost"') < indexSrc.indexOf('id="fhlFullHistoryList"'));
});

test('Plan 405: no new styles are added — the search reuses existing classes only', () => {
  const stylesSrc = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.equal(stylesSrc.includes('amt-'), false);
});

test('Plan 405: fixtures stay generic — no real customer names or phone numbers in this file', () => {
  const testSrc = readFileSync(new URL(import.meta.url), 'utf8');
  // The banned values are fragment-built so the guard's own literals
  // never trip the guard (a literal would trip its own check).
  const countryCode = '+' + '92';
  const mobilePattern = new RegExp('030' + '\\\\\\d{8}');
  const fakeFamily = '030' + '12345678';
  assert.ok(!testSrc.includes(countryCode), 'test carries a real phone number');
  assert.equal(mobilePattern.test(testSrc), false, 'test carries a mobile number');
  assert.ok(!testSrc.includes(fakeFamily), 'test uses a fake number outside the allowed family');
});
