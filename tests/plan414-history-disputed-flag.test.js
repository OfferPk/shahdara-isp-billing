// Plan 414 — History disputed transactions flag view: a flag
// on history lines that belong to an open dispute case, with the
// case reference shown beside the line, and a filter showing only
// the flagged lines. It flags only and it changes nothing: it
// reads the entries the full history already composes plus the
// dispute cases already on this device, and it writes to no store,
// no bill, no payment, no case, and no customer record. Closing
// a case clears its flag.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HISTORY_DISPUTED_FLAG_OPEN_STATUSES,
  HISTORY_DISPUTED_FLAG_FILTER_ALL,
  HISTORY_DISPUTED_FLAG_FILTER_DISPUTED,
  HISTORY_DISPUTED_FLAG_EMPTY_TEXT,
  formatDisputedFlagAmount,
  historyDisputedFlagIsOpenCase,
  normalizeHistoryDisputedFlagFilter,
  historyDisputedFlagCaseRefForEntry,
  historyDisputedFlagEntries,
  historyDisputedFlagCounts,
  filterHistoryEntriesByDisputedFlag,
  historyDisputedFlagOptions,
  historyDisputedFlagSelectMarkup,
  historyDisputedFlagEmptyText,
  historyDisputedFlagSummaryText,
  historyDisputedFlagListHtml,
} from '../history-disputed-flag.js';
import { fullHistoryEntries, fullHistoryListHtml } from '../full-history-list.js';

function entry(overrides = {}) {
  return {
    type: 'payment',
    date: '2026-11-06',
    month: '2026-11',
    amountCents: 300000,
    runningBalanceCents: 0,
    note: '',
    method: 'Cash',
    ref: 'PAY-1',
    voided: false,
    ...overrides,
  };
}

function disputeCase(overrides = {}) {
  return {
    id: 'CASE-1',
    customerId: 'CUST-1',
    billId: 'BILL-1',
    billMonth: '2026-11',
    status: 'open',
    ...overrides,
  };
}

function bill(overrides = {}) {
  return {
    id: 'BILL-1',
    month: '2026-11',
    dueDate: '2026-11-05',
    dueAmount: 3000,
    status: 'pending',
    payments: [],
    ...overrides,
  };
}

function payment(overrides = {}) {
  return { id: 'PAY-1', amount: 3000, date: '2026-11-06', method: 'Cash', ...overrides };
}

test('open, investigating and escalated cases are open', () => {
  assert.equal(historyDisputedFlagIsOpenCase(disputeCase({ status: 'open' })), true);
  assert.equal(historyDisputedFlagIsOpenCase(disputeCase({ status: 'investigating' })), true);
  assert.equal(historyDisputedFlagIsOpenCase(disputeCase({ status: 'escalated' })), true);
  assert.deepEqual([...HISTORY_DISPUTED_FLAG_OPEN_STATUSES], ['open', 'investigating', 'escalated']);
});

test('a resolved case is not open, so closing a case clears its flag', () => {
  assert.equal(historyDisputedFlagIsOpenCase(disputeCase({ status: 'resolved' })), false);
});

test('a case with no status recorded is not open', () => {
  assert.equal(historyDisputedFlagIsOpenCase(disputeCase({ status: '' })), false);
  assert.equal(historyDisputedFlagIsOpenCase({ id: 'CASE-1', customerId: 'CUST-1' }), false);
  assert.equal(historyDisputedFlagIsOpenCase(null), false);
  assert.equal(historyDisputedFlagIsOpenCase('open'), false);
});

test('status folds case and separators', () => {
  assert.equal(historyDisputedFlagIsOpenCase(disputeCase({ status: 'Open' })), true);
  assert.equal(historyDisputedFlagIsOpenCase(disputeCase({ status: 'INVESTIGATING' })), true);
});

test('the filter normalises to disputed or all', () => {
  assert.equal(normalizeHistoryDisputedFlagFilter('disputed'), 'disputed');
  assert.equal(normalizeHistoryDisputedFlagFilter('Disputed'), 'disputed');
  assert.equal(normalizeHistoryDisputedFlagFilter('all'), 'all');
  assert.equal(normalizeHistoryDisputedFlagFilter(''), 'all');
  assert.equal(normalizeHistoryDisputedFlagFilter(null), 'all');
  assert.equal(normalizeHistoryDisputedFlagFilter(undefined), 'all');
  assert.equal(normalizeHistoryDisputedFlagFilter('settled'), 'all');
  assert.equal(HISTORY_DISPUTED_FLAG_FILTER_ALL, 'all');
  assert.equal(HISTORY_DISPUTED_FLAG_FILTER_DISPUTED, 'disputed');
});

test('a charge line matches its case by bill id', () => {
  const line = entry({ type: 'charge', ref: 'BILL-1', method: '' });
  assert.equal(historyDisputedFlagCaseRefForEntry(line, [disputeCase()], 'CUST-1'), 'CASE-1');
});

test('a payment line matches its case by bill month', () => {
  const line = entry({ ref: 'PAY-9', month: '2026-11' });
  assert.equal(historyDisputedFlagCaseRefForEntry(line, [disputeCase()], 'CUST-1'), 'CASE-1');
});

test('a line for another customer never flags', () => {
  assert.equal(historyDisputedFlagCaseRefForEntry(entry(), [disputeCase()], 'CUST-2'), '');
  assert.equal(historyDisputedFlagCaseRefForEntry(entry(), [disputeCase()], ''), '');
});

test('a line for another bill never flags', () => {
  const line = entry({ ref: 'PAY-9', month: '2026-10' });
  const cases = [disputeCase({ billId: 'BILL-9', billMonth: '2026-09' })];
  assert.equal(historyDisputedFlagCaseRefForEntry(line, cases, 'CUST-1'), '');
});

test('a resolved case never flags, so closing the case clears the flag', () => {
  assert.equal(
    historyDisputedFlagCaseRefForEntry(entry(), [disputeCase({ status: 'resolved' })], 'CUST-1'),
    '',
  );
});

test('a case with no reference recorded never flags', () => {
  assert.equal(
    historyDisputedFlagCaseRefForEntry(entry(), [disputeCase({ id: '' })], 'CUST-1'),
    '',
  );
});

test('a case with no bill id and no bill month never flags', () => {
  const cases = [disputeCase({ billId: '', billMonth: '' })];
  assert.equal(historyDisputedFlagCaseRefForEntry(entry(), cases, 'CUST-1'), '');
});

test('a case with no customer never flags', () => {
  const cases = [disputeCase({ customerId: '' })];
  assert.equal(historyDisputedFlagCaseRefForEntry(entry(), cases, 'CUST-1'), '');
});

test('a line with neither a reference nor a month never flags', () => {
  const line = entry({ ref: '', month: '' });
  assert.equal(historyDisputedFlagCaseRefForEntry(line, [disputeCase()], 'CUST-1'), '');
});

test('a missing entry or missing case list never flags', () => {
  assert.equal(historyDisputedFlagCaseRefForEntry(null, [disputeCase()], 'CUST-1'), '');
  assert.equal(historyDisputedFlagCaseRefForEntry(entry(), null, 'CUST-1'), '');
  assert.equal(historyDisputedFlagCaseRefForEntry(entry(), [], 'CUST-1'), '');
});

test('the first matching case in list order wins', () => {
  const cases = [disputeCase({ id: 'CASE-A' }), disputeCase({ id: 'CASE-B' })];
  assert.equal(historyDisputedFlagCaseRefForEntry(entry(), cases, 'CUST-1'), 'CASE-A');
  assert.equal(historyDisputedFlagCaseRefForEntry(entry(), [...cases].reverse(), 'CUST-1'), 'CASE-B');
});

test('annotation attaches the case reference and never mutates the entries', () => {
  const lines = [entry(), entry({ ref: 'PAY-2', month: '2026-10' })];
  const annotated = historyDisputedFlagEntries(lines, [disputeCase()], 'CUST-1');
  assert.equal(annotated[0].disputedCaseRef, 'CASE-1');
  assert.equal(annotated[1].disputedCaseRef, '');
  assert.equal('disputedCaseRef' in lines[0], false);
  assert.equal('disputedCaseRef' in lines[1], false);
  assert.notEqual(annotated, lines);
  assert.equal(annotated[0].ref, 'PAY-1');
});

test('annotation keeps the entry order', () => {
  const lines = [entry({ ref: 'PAY-2' }), entry({ ref: 'PAY-1' })];
  const annotated = historyDisputedFlagEntries(lines, [disputeCase()], 'CUST-1');
  assert.deepEqual(annotated.map((line) => line.ref), ['PAY-2', 'PAY-1']);
});

test('counts count flagged lines over annotated entries', () => {
  const annotated = historyDisputedFlagEntries(
    [entry(), entry({ ref: 'PAY-2', month: '2026-10' }), entry({ ref: 'PAY-3' })],
    [disputeCase()],
    'CUST-1',
  );
  assert.deepEqual(historyDisputedFlagCounts(annotated), { total: 3, disputed: 2 });
  assert.deepEqual(historyDisputedFlagCounts([]), { total: 0, disputed: 0 });
  assert.deepEqual(historyDisputedFlagCounts(null), { total: 0, disputed: 0 });
});

test('the disputed filter keeps only flagged lines', () => {
  const annotated = historyDisputedFlagEntries(
    [entry(), entry({ ref: 'PAY-2', month: '2026-10' })],
    [disputeCase()],
    'CUST-1',
  );
  const kept = filterHistoryEntriesByDisputedFlag(annotated, 'disputed');
  assert.equal(kept.length, 1);
  assert.equal(kept[0].ref, 'PAY-1');
  assert.equal(kept[0].disputedCaseRef, 'CASE-1');
});

test('the filter keeps the whole list when it is off', () => {
  const annotated = historyDisputedFlagEntries([entry(), entry({ ref: 'PAY-2' })], [disputeCase()], 'CUST-1');
  assert.equal(filterHistoryEntriesByDisputedFlag(annotated, 'all').length, 2);
  assert.equal(filterHistoryEntriesByDisputedFlag(annotated, '').length, 2);
  assert.equal(filterHistoryEntriesByDisputedFlag(annotated, null).length, 2);
  const kept = filterHistoryEntriesByDisputedFlag(annotated, 'all');
  assert.notEqual(kept, annotated);
});

test('the select carries live counts for all lines and disputed lines', () => {
  const annotated = historyDisputedFlagEntries(
    [entry(), entry({ ref: 'PAY-2', month: '2026-10' })],
    [disputeCase()],
    'CUST-1',
  );
  const markup = historyDisputedFlagSelectMarkup(annotated, 'all');
  assert.match(markup, /id="hdfHistoryDisputedFlag"/);
  assert.match(markup, /All lines \(2\)/);
  assert.match(markup, /Disputed only \(1\)/);
  assert.match(markup, /value="all" selected/);
  const disputed = historyDisputedFlagSelectMarkup(annotated, 'disputed');
  assert.match(disputed, /value="disputed" selected/);
  assert.deepEqual(historyDisputedFlagOptions(annotated), [
    { value: 'all', label: 'All lines', count: 2 },
    { value: 'disputed', label: 'Disputed only', count: 1 },
  ]);
});

test('the empty line names disputed entries only while the filter is on', () => {
  assert.equal(historyDisputedFlagEmptyText('disputed'), 'No disputed entries');
  assert.equal(historyDisputedFlagEmptyText('all'), '');
  assert.equal(historyDisputedFlagEmptyText(''), '');
  assert.equal(HISTORY_DISPUTED_FLAG_EMPTY_TEXT, 'No disputed entries');
});

test('amounts print with no decimals for whole rupees', () => {
  assert.equal(formatDisputedFlagAmount(150000), 'PKR 1,500');
  assert.equal(formatDisputedFlagAmount(150050), 'PKR 1,500.5');
  assert.equal(formatDisputedFlagAmount(0), 'PKR 0');
  assert.equal(formatDisputedFlagAmount(null), 'PKR 0');
});

test('the summary is empty while the filter is off', () => {
  assert.equal(historyDisputedFlagSummaryText([entry()], [entry()], 'all', '', '', '', 'all', 'all'), '');
});

test('the summary counts the shown disputed lines with a subtotal', () => {
  const annotated = historyDisputedFlagEntries(
    [entry(), entry({ ref: 'PAY-2', amountCents: 200000 }), entry({ ref: 'PAY-3', month: '2026-10' })],
    [disputeCase()],
    'CUST-1',
  );
  const shown = filterHistoryEntriesByDisputedFlag(annotated, 'disputed');
  assert.equal(
    historyDisputedFlagSummaryText(shown, annotated, 'disputed', '', '', '', 'all', 'all'),
    '2 of 3 entries · Disputed only · Subtotal PKR 5,000',
  );
});

test('the summary uses the singular for one shown line', () => {
  const annotated = historyDisputedFlagEntries([entry()], [disputeCase()], 'CUST-1');
  const shown = filterHistoryEntriesByDisputedFlag(annotated, 'disputed');
  assert.equal(
    historyDisputedFlagSummaryText(shown, annotated, 'disputed', '', '', '', 'all', 'all'),
    '1 entry of 1 · Disputed only · Subtotal PKR 3,000',
  );
});

test('the summary composes the date span and the other filter suffixes', () => {
  const annotated = historyDisputedFlagEntries([entry()], [disputeCase()], 'CUST-1');
  const shown = filterHistoryEntriesByDisputedFlag(annotated, 'disputed');
  assert.equal(
    historyDisputedFlagSummaryText(shown, annotated, 'disputed', '2000', '2026-09-01', '2026-09-30', 'refund', 'wallet'),
    '1 entry of 1 · Disputed only in 2026-09-01 – 2026-09-30 · Refund only · Mobile wallet only · PKR 2,000 only · Subtotal PKR 3,000',
  );
});

test('the summary ignores a damaged date span and a damaged amount search', () => {
  const annotated = historyDisputedFlagEntries([entry()], [disputeCase()], 'CUST-1');
  const shown = filterHistoryEntriesByDisputedFlag(annotated, 'disputed');
  assert.equal(
    historyDisputedFlagSummaryText(shown, annotated, 'disputed', 'abc', '2026-02-30', '', 'all', 'all'),
    '1 entry of 1 · Disputed only · Subtotal PKR 3,000',
  );
});

test('the list renders flagged rows with the case reference beside the line', () => {
  const annotated = historyDisputedFlagEntries(
    [entry(), entry({ ref: 'PAY-2', month: '2026-10' })],
    [disputeCase()],
    'CUST-1',
  );
  const html = historyDisputedFlagListHtml(annotated);
  assert.match(html, /Disputed · CASE-1/);
  assert.equal((html.match(/Disputed/g) || []).length, 1);
});

test('a settled line carries no flag', () => {
  const annotated = historyDisputedFlagEntries([entry({ ref: 'PAY-2', month: '2026-10' })], [disputeCase()], 'CUST-1');
  assert.doesNotMatch(historyDisputedFlagListHtml(annotated), /Disputed/);
});

test('with no flagged row the list is the ordinary list, unchanged', () => {
  const lines = [entry(), entry({ type: 'charge', ref: 'BILL-9', method: '', date: '2026-10-05', month: '2026-10', amountCents: 200000, runningBalanceCents: 200000 })];
  assert.equal(historyDisputedFlagListHtml(lines), fullHistoryListHtml(lines));
});

test('a voided flagged line keeps its VOID badge and its flag', () => {
  const annotated = historyDisputedFlagEntries([entry({ voided: true })], [disputeCase()], 'CUST-1');
  const html = historyDisputedFlagListHtml(annotated);
  assert.match(html, /VOID/);
  assert.match(html, /Disputed · CASE-1/);
});

test('the list escapes a hostile case reference', () => {
  const annotated = historyDisputedFlagEntries(
    [entry()],
    [disputeCase({ id: 'CASE-<b>1</b>' })],
    'CUST-1',
  );
  const html = historyDisputedFlagListHtml(annotated);
  assert.match(html, /CASE-&lt;b&gt;1&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>1<\/b>/);
});

test('the list is empty for an empty or missing history', () => {
  assert.equal(historyDisputedFlagListHtml([]), '');
  assert.equal(historyDisputedFlagListHtml(null), '');
});

test('acceptance: every line of the disputed bill is flagged and no settled line is', () => {
  const bills = [
    bill({
      id: 'BILL-1',
      month: '2026-11',
      dueDate: '2026-11-05',
      dueAmount: 3000,
      payments: [payment({ id: 'PAY-1', amount: 3000, date: '2026-11-06', method: 'Cash' })],
    }),
    bill({
      id: 'BILL-2',
      month: '2026-10',
      dueDate: '2026-10-05',
      dueAmount: 2000,
      payments: [payment({ id: 'PAY-2', amount: 2000, date: '2026-10-06', method: 'JazzCash' })],
    }),
  ];
  const entries = fullHistoryEntries({ customerId: 'CUST-1', bills, creditEntries: [], refundRecords: [] });
  const annotated = historyDisputedFlagEntries(entries, [disputeCase()], 'CUST-1');
  const flagged = annotated.filter((line) => line.disputedCaseRef !== '');
  assert.equal(flagged.length, 2);
  assert.ok(flagged.every((line) => line.disputedCaseRef === 'CASE-1'));
  assert.ok(flagged.some((line) => line.type === 'charge' && line.ref === 'BILL-1'));
  assert.ok(flagged.some((line) => line.type === 'payment' && line.ref === 'PAY-1'));
  const settled = annotated.filter((line) => line.ref === 'BILL-2' || line.ref === 'PAY-2');
  assert.equal(settled.length, 2);
  assert.ok(settled.every((line) => line.disputedCaseRef === ''));
});

test('acceptance: closing the case clears every flag on the same fixture', () => {
  const bills = [
    bill({
      id: 'BILL-1',
      month: '2026-11',
      dueDate: '2026-11-05',
      dueAmount: 3000,
      payments: [payment({ id: 'PAY-1', amount: 3000, date: '2026-11-06', method: 'Cash' })],
    }),
  ];
  const entries = fullHistoryEntries({ customerId: 'CUST-1', bills, creditEntries: [], refundRecords: [] });
  const open = historyDisputedFlagEntries(entries, [disputeCase({ status: 'open' })], 'CUST-1');
  assert.equal(open.filter((line) => line.disputedCaseRef !== '').length, 2);
  const closed = historyDisputedFlagEntries(entries, [disputeCase({ status: 'resolved' })], 'CUST-1');
  assert.equal(closed.filter((line) => line.disputedCaseRef !== '').length, 0);
  assert.equal(historyDisputedFlagListHtml(closed), fullHistoryListHtml(entries));
});

test('the module is pure: no dates from the clock, no storage, no network', () => {
  const src = readFileSync(new URL('../history-disputed-flag.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /new Date\(/);
  assert.doesNotMatch(src, /Date\.now\(/);
  assert.doesNotMatch(src, /localStorage/);
  assert.doesNotMatch(src, /sessionStorage/);
  assert.doesNotMatch(src, /fetch\(/);
  assert.doesNotMatch(src, /shahdara_[a-z_]+_v\d/);
});

test('the module header never names a fenced module file literally', () => {
  const src = readFileSync(new URL('../history-disputed-flag.js', import.meta.url), 'utf8');
  const fenced = [
    'full-history-' + 'list.js',
    'history-type-' + 'filter.js',
    'history-date-range-' + 'filter.js',
    'history-method-' + 'filter.js',
    'history-amount-' + 'search.js',
    'history-running-' + 'balance.js',
    'history-monthly-' + 'grouping.js',
    'history-yearly-' + 'summary.js',
    'history-csv-' + 'export.js',
    'history-printed-' + 'statement.js',
    'history-gap-' + 'view.js',
    'history-largest-' + 'payment.js',
    'history-first-' + 'dates.js',
    'balance-roll' + 'forward.js',
    'dispute-' + 'cases.js',
    'dispute-' + 'evidence.js',
    'dispute-' + 'followups.js',
    'dispute-' + 'letters.js',
    'dispute-' + 'resolutions.js',
    'disputed-' + 'balance.js',
  ];
  for (const name of fenced) assert.doesNotMatch(src, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('the history wires the disputed flag beside the list and the filter above it', () => {
  const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(appSrc, /import \{[^}]*historyDisputedFlagEntries[^}]*\} from '\.\/history-disputed-flag\.js';/);
  assert.match(appSrc, /#hdfHistoryDisputedFlagHost/);
  assert.match(appSrc, /#hdfHistoryDisputedFlag/);
  assert.match(appSrc, /const disputeCases = openDisputeCases\(loadDisputeCases\(\)\);/);
  assert.match(appSrc, /historyDisputedFlagEntries\(entries, disputeCases, customer\.id\)/);
  assert.match(appSrc, /filterHistoryEntriesByDisputedFlag\(/);
  assert.match(appSrc, /historyDisputedFlagListHtml\(shown\)/);
  assert.match(appSrc, /fullHistoryListHtml\(shown\)/);
  const htmlSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(htmlSrc, /id="hdfHistoryDisputedFlagHost"/);
  assert.ok(
    htmlSrc.indexOf('id="hdfHistoryDisputedFlagHost"') > htmlSrc.indexOf('id="amtHistoryAmountSearchHost"'),
    'the filter sits after the amount search, with the other filters',
  );
  assert.ok(
    htmlSrc.indexOf('id="hdfHistoryDisputedFlagHost"') < htmlSrc.indexOf('id="fhlFullHistoryList"'),
    'the filter sits above the history list',
  );
});
