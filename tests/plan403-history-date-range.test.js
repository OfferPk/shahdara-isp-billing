// Plan 403 — History filter by date range: a customer asks about
// "last three months" and the operator must scroll a years-long
// history to find it. One date-range filter on the customer history
// (a from date and a to date, both strict dates), showing only the
// transactions dated in that range, with a subtotal. It filters
// only and changes nothing: the filtered list contains exactly the
// transactions dated within the range, its subtotal matches them,
// an empty range says so plainly, and no bill, payment, or customer
// record is ever changed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HISTORY_DATE_RANGE_EMPTY_TEXT,
  isStrictRangeDate,
  normalizeHistoryDateRange,
  historyDateRangeActive,
  filterHistoryEntriesByDateRange,
  historyDateRangeSubtotalCents,
  formatDateRangeAmount,
  historyDateRangeFilterMarkup,
  historyDateRangeEmptyText,
  historyDateRangeSummaryText,
} from '../history-date-range-filter.js';

function entry(overrides = {}) {
  return { type: 'payment', date: '2026-11-06', amountCents: 300000, runningBalanceCents: 0, ...overrides };
}

function mixedEntries() {
  return [
    entry({ type: 'charge', date: '2026-09-01', amountCents: 300000, ref: 'BILL-1' }),
    entry({ type: 'payment', date: '2026-09-15', amountCents: 150000, ref: 'PAY-1' }),
    entry({ type: 'payment', date: '2026-09-30', amountCents: 150000, ref: 'PAY-2' }),
    entry({ type: 'advance', date: '2026-10-01', amountCents: 50000, ref: 'PAY-3' }),
    entry({ type: 'credit', date: '2026-10-05', amountCents: 50000, ref: 'CR-1' }),
    entry({ type: 'refund', date: '2026-10-20', amountCents: 20000, ref: 'RF-1' }),
    entry({ type: 'refund', date: '2026-11-02', amountCents: 10000, ref: 'RF-2' }),
  ];
}

// --- Strict dates ---

test('Plan 403: strict range dates accept real calendar dates only', () => {
  assert.equal(isStrictRangeDate('2026-09-01'), true);
  assert.equal(isStrictRangeDate('2026-11-30'), true);
  assert.equal(isStrictRangeDate('2028-02-29'), true);
  assert.equal(isStrictRangeDate('2000-02-29'), true);
  assert.equal(isStrictRangeDate('2026-02-29'), false);
  assert.equal(isStrictRangeDate('1900-02-29'), false);
  assert.equal(isStrictRangeDate('2100-02-29'), false);
  assert.equal(isStrictRangeDate('2026-13-01'), false);
  assert.equal(isStrictRangeDate('2026-00-10'), false);
  assert.equal(isStrictRangeDate('2026-09-00'), false);
  assert.equal(isStrictRangeDate('2026-09-31'), false);
  assert.equal(isStrictRangeDate('2026-9-1'), false);
  assert.equal(isStrictRangeDate('2026/09/01'), false);
  assert.equal(isStrictRangeDate(''), false);
  assert.equal(isStrictRangeDate(null), false);
  assert.equal(isStrictRangeDate(undefined), false);
  assert.equal(isStrictRangeDate(20260901), false);
});

test('Plan 403: normalizing a range keeps strict bounds and blanks damaged ones', () => {
  assert.deepEqual(normalizeHistoryDateRange('2026-09-01', '2026-09-30'), { from: '2026-09-01', to: '2026-09-30' });
  assert.deepEqual(normalizeHistoryDateRange('2026-02-29', '2026-09-30'), { from: '', to: '2026-09-30' });
  assert.deepEqual(normalizeHistoryDateRange('2026-09-01', 'not-a-date'), { from: '2026-09-01', to: '' });
  assert.deepEqual(normalizeHistoryDateRange('', ''), { from: '', to: '' });
  assert.deepEqual(normalizeHistoryDateRange(null, undefined), { from: '', to: '' });
  // A from date after the to date is kept as given: it matches
  // nothing, and the empty line says so plainly.
  assert.deepEqual(normalizeHistoryDateRange('2026-09-30', '2026-09-01'), { from: '2026-09-30', to: '2026-09-01' });
});

test('Plan 403: a range is active when at least one bound is set', () => {
  assert.equal(historyDateRangeActive('', ''), false);
  assert.equal(historyDateRangeActive('2026-09-01', ''), true);
  assert.equal(historyDateRangeActive('', '2026-09-30'), true);
  assert.equal(historyDateRangeActive('2026-09-01', '2026-09-30'), true);
  assert.equal(historyDateRangeActive('not-a-date', ''), false);
});

// --- Filtering ---

test('Plan 403: with no bounds every entry stays, in the same order', () => {
  const entries = mixedEntries();
  const before = JSON.stringify(entries);
  const shown = filterHistoryEntriesByDateRange(entries, '', '');
  assert.deepEqual(shown, entries);
  assert.notEqual(shown, entries);
  assert.equal(JSON.stringify(entries), before);
  assert.deepEqual(filterHistoryEntriesByDateRange(entries, 'not-a-date', ''), entries);
});

test('Plan 403: both bounds keep exactly the entries dated in the range, inclusive', () => {
  const shown = filterHistoryEntriesByDateRange(mixedEntries(), '2026-09-15', '2026-10-05');
  assert.deepEqual(shown.map((e) => e.ref), ['PAY-1', 'PAY-2', 'PAY-3', 'CR-1']);
  // Both ends are inclusive: the 15th and the 5th are in.
  assert.deepEqual(
    filterHistoryEntriesByDateRange(mixedEntries(), '2026-09-01', '2026-09-01').map((e) => e.ref),
    ['BILL-1'],
  );
});

test('Plan 403: one bound alone opens the other side of the range', () => {
  assert.deepEqual(
    filterHistoryEntriesByDateRange(mixedEntries(), '2026-10-01', '').map((e) => e.ref),
    ['PAY-3', 'CR-1', 'RF-1', 'RF-2'],
  );
  assert.deepEqual(
    filterHistoryEntriesByDateRange(mixedEntries(), '', '2026-09-15').map((e) => e.ref),
    ['BILL-1', 'PAY-1'],
  );
});

test('Plan 403: a month-only entry counts as the first of that month', () => {
  const entries = [
    entry({ type: 'charge', date: '2026-09', amountCents: 300000, ref: 'BILL-M' }),
    entry({ type: 'payment', date: '2026-09-02', amountCents: 150000, ref: 'PAY-M' }),
  ];
  // The month-only entry reads as 2026-09-01: inside a range that
  // starts on the 1st, outside one that ends on 2026-08-31.
  assert.deepEqual(
    filterHistoryEntriesByDateRange(entries, '2026-09-01', '2026-09-30').map((e) => e.ref),
    ['BILL-M', 'PAY-M'],
  );
  assert.deepEqual(
    filterHistoryEntriesByDateRange(entries, '2026-08-01', '2026-08-31').map((e) => e.ref),
    [],
  );
});

test('Plan 403: an entry with no date stays only while no bound is set', () => {
  const entries = [
    entry({ type: 'payment', date: '', amountCents: 150000, ref: 'PAY-NODATE' }),
    entry({ type: 'payment', date: '2026-09-15', amountCents: 150000, ref: 'PAY-1' }),
  ];
  assert.deepEqual(
    filterHistoryEntriesByDateRange(entries, '', '').map((e) => e.ref),
    ['PAY-NODATE', 'PAY-1'],
  );
  assert.deepEqual(
    filterHistoryEntriesByDateRange(entries, '2026-09-01', '2026-09-30').map((e) => e.ref),
    ['PAY-1'],
  );
});

test('Plan 403: a from date after the to date matches nothing', () => {
  assert.deepEqual(filterHistoryEntriesByDateRange(mixedEntries(), '2026-09-30', '2026-09-01'), []);
  assert.deepEqual(filterHistoryEntriesByDateRange(mixedEntries(), '2026-12-01', '2026-11-01'), []);
});

test('Plan 403: filtering never mutates the entries and keeps voided rows listed', () => {
  const entries = mixedEntries();
  entries.push(entry({ type: 'payment', date: '2026-09-20', amountCents: 150000, ref: 'PAY-VOID', voided: true }));
  const before = JSON.stringify(entries);
  const shown = filterHistoryEntriesByDateRange(entries, '2026-09-01', '2026-09-30');
  assert.deepEqual(shown.map((e) => e.ref), ['BILL-1', 'PAY-1', 'PAY-2', 'PAY-VOID']);
  assert.equal(JSON.stringify(entries), before);
});

test('Plan 403: a non-list input filters to nothing', () => {
  assert.deepEqual(filterHistoryEntriesByDateRange(null, '2026-09-01', '2026-09-30'), []);
  assert.deepEqual(filterHistoryEntriesByDateRange('nope', '', ''), []);
});

// --- Subtotal ---

test('Plan 403: the subtotal is the sum of the shown entries only', () => {
  const shown = filterHistoryEntriesByDateRange(mixedEntries(), '2026-09-15', '2026-10-05');
  assert.equal(historyDateRangeSubtotalCents(shown), 150000 + 150000 + 50000 + 50000);
  assert.equal(historyDateRangeSubtotalCents([]), 0);
  assert.equal(historyDateRangeSubtotalCents(null), 0);
  // The subtotal matches exactly the entries shown, entry by entry.
  const byHand = shown.reduce((sum, e) => sum + e.amountCents, 0);
  assert.equal(historyDateRangeSubtotalCents(shown), byHand);
});

test('Plan 403: range amounts print with no decimals for whole rupees', () => {
  assert.equal(formatDateRangeAmount(150000), 'PKR 1,500');
  assert.equal(formatDateRangeAmount(150050), 'PKR 1,500.5');
  assert.equal(formatDateRangeAmount(0), 'PKR 0');
  assert.equal(formatDateRangeAmount(-50000), '-PKR 500');
  assert.equal(formatDateRangeAmount(null), 'PKR 0');
  assert.equal(formatDateRangeAmount('nope'), 'PKR 0');
});

// --- Empty and summary text ---

test('Plan 403: an empty range says so plainly', () => {
  assert.equal(HISTORY_DATE_RANGE_EMPTY_TEXT, 'No transactions in this date range');
  assert.equal(historyDateRangeEmptyText('2026-09-01', '2026-09-30'), 'No transactions in this date range');
  assert.equal(historyDateRangeEmptyText('2026-09-01', ''), 'No transactions in this date range');
  assert.equal(historyDateRangeEmptyText('', ''), '');
  assert.equal(historyDateRangeEmptyText('not-a-date', ''), '');
});

test('Plan 403: the range summary names the span and the subtotal', () => {
  const shown = filterHistoryEntriesByDateRange(mixedEntries(), '2026-09-01', '2026-09-30');
  assert.equal(
    historyDateRangeSummaryText(shown, '2026-09-01', '2026-09-30', 'all'),
    '3 entries in 2026-09-01 – 2026-09-30 · Subtotal PKR 6,000',
  );
  assert.equal(
    historyDateRangeSummaryText(shown, '2026-09-01', '', 'all'),
    '3 entries from 2026-09-01 · Subtotal PKR 6,000',
  );
  assert.equal(
    historyDateRangeSummaryText(shown, '', '2026-09-30', 'all'),
    '3 entries up to 2026-09-30 · Subtotal PKR 6,000',
  );
  assert.equal(
    historyDateRangeSummaryText([entry()], '2026-11-01', '2026-11-30', 'all'),
    '1 entry in 2026-11-01 – 2026-11-30 · Subtotal PKR 3,000',
  );
  assert.equal(historyDateRangeSummaryText([], '2026-09-01', '2026-09-30', 'all'), '0 entries in 2026-09-01 – 2026-09-30 · Subtotal PKR 0');
});

test('Plan 403: the range summary names the chosen type too', () => {
  const shown = filterHistoryEntriesByDateRange(mixedEntries(), '2026-10-01', '2026-10-31');
  assert.equal(
    historyDateRangeSummaryText(shown, '2026-10-01', '2026-10-31', 'refund'),
    '3 entries in 2026-10-01 – 2026-10-31 · Refund only · Subtotal PKR 1,200',
  );
  assert.equal(
    historyDateRangeSummaryText(shown, '2026-10-01', '2026-10-31', 'unknown-type'),
    '3 entries in 2026-10-01 – 2026-10-31 · Subtotal PKR 1,200',
  );
  // With no range active the summary is blank, so the caller keeps
  // the summary the type filter already shows.
  assert.equal(historyDateRangeSummaryText(shown, '', '', 'refund'), '');
});

// --- Markup ---

test('Plan 403: the filter markup carries both date inputs and a clear button', () => {
  const markup = historyDateRangeFilterMarkup('2026-09-01', '2026-09-30');
  assert.ok(markup.includes('id="hdrHistoryDateFrom"'));
  assert.ok(markup.includes('id="hdrHistoryDateTo"'));
  assert.ok(markup.includes('id="hdrHistoryDateRangeClear"'));
  assert.ok(markup.includes('value="2026-09-01"'));
  assert.ok(markup.includes('value="2026-09-30"'));
  assert.ok(markup.includes('type="date"'));
  const blank = historyDateRangeFilterMarkup('', '');
  assert.ok(blank.includes('value=""'));
  // A damaged bound renders blank, never a broken date.
  const damaged = historyDateRangeFilterMarkup('not-a-date', '2026-09-30');
  assert.ok(damaged.includes('value=""'));
  assert.ok(damaged.includes('value="2026-09-30"'));
});

// --- Fences and guards ---

test('Plan 403: the module header never names a fenced filename literally', () => {
  const moduleSrc = readFileSync(new URL('../history-date-range-filter.js', import.meta.url), 'utf8');
  const testSrc = readFileSync(new URL(import.meta.url), 'utf8');
  const typeFilterModule = 'history-type-' + 'filter.js';
  const fullHistoryModule = 'full-history-' + 'list.js';
  const categoryTagModule = 'transaction-category-' + 'tag.js';
  for (const fenced of [typeFilterModule, fullHistoryModule, categoryTagModule]) {
    assert.equal(moduleSrc.includes(fenced), false, fenced);
    assert.equal(testSrc.includes(fenced), false, fenced);
  }
});

test('Plan 403: the module imports nothing, keeps no store, and touches no live state', () => {
  const moduleSrc = readFileSync(new URL('../history-date-range-filter.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(moduleSrc), false);
  assert.equal(moduleSrc.includes('localStorage'), false);
  assert.equal(moduleSrc.includes('shahdara_'), false);
  assert.equal(moduleSrc.includes('new Date('), false);
  assert.equal(moduleSrc.includes('Date.now('), false);
  assert.equal(moduleSrc.includes('document.'), false);
  assert.equal(moduleSrc.includes('fetch('), false);
});

test('Plan 403: the fenced neighbours contain no date-range-filter references', () => {
  const typeFilterModule = 'history-type-' + 'filter.js';
  const fullHistoryModule = 'full-history-' + 'list.js';
  const categoryTagModule = 'transaction-category-' + 'tag.js';
  for (const fenced of [typeFilterModule, fullHistoryModule, categoryTagModule]) {
    const src = readFileSync(new URL(`../${fenced}`, import.meta.url), 'utf8');
    assert.equal(src.includes('historyDateRange'), false, fenced);
    assert.equal(src.includes('filterHistoryEntriesByDateRange'), false, fenced);
  }
});

test('Plan 403: the type filter still exists and is still wired, untouched', () => {
  const typeFilterModule = 'history-type-' + 'filter.js';
  const filterSrc = readFileSync(new URL(`../${typeFilterModule}`, import.meta.url), 'utf8');
  assert.ok(filterSrc.includes('HISTORY_TYPE_FILTER_TYPES'));
  assert.ok(filterSrc.includes('filterHistoryEntriesByType'));
  const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(appSrc.includes(`from './${typeFilterModule}'`));
  assert.ok(appSrc.includes('filterHistoryEntriesByType'));
  assert.ok(appSrc.includes('historyTypeFilterSelectMarkup'));
});

test('Plan 403: the full history list still exists and is still wired, untouched', () => {
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

test('Plan 403: the profile wires the date-range filter into the full history render', () => {
  const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(appSrc.includes("from './history-date-range-filter.js'"));
  assert.ok(appSrc.includes('normalizeHistoryDateRange'));
  assert.ok(appSrc.includes('filterHistoryEntriesByDateRange'));
  assert.ok(appSrc.includes('historyDateRangeFilterMarkup'));
  assert.ok(appSrc.includes('historyDateRangeSummaryText'));
  assert.ok(appSrc.includes('HISTORY_DATE_RANGE_EMPTY_TEXT'));
  assert.ok(appSrc.includes('hdrHistoryDateRangeHost'));
  assert.ok(appSrc.includes('hdrHistoryDateFrom'));
  assert.ok(appSrc.includes('hdrHistoryDateTo'));
  assert.ok(appSrc.includes('hdrHistoryDateRangeClear'));
  const indexSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(indexSrc.includes('id="hdrHistoryDateRangeHost"'));
  assert.ok(indexSrc.indexOf('htfHistoryTypeFilterHost') < indexSrc.indexOf('id="hdrHistoryDateRangeHost"'));
  assert.ok(indexSrc.indexOf('id="hdrHistoryDateRangeHost"') < indexSrc.indexOf('id="fhlFullHistoryList"'));
});

test('Plan 403: no new styles are added — the filter reuses existing classes only', () => {
  const stylesSrc = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.equal(stylesSrc.includes('hdr-'), false);
});

test('Plan 403: fixtures stay generic — no real customer names or phone numbers in this file', () => {
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
