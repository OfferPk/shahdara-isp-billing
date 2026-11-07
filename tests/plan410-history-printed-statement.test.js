// Plan 410 — History printed statement per customer: some
// customers want a paper statement of their history, but the only
// statement is a WhatsApp draft, which does not help a customer
// without a phone in hand. One printable history statement per
// customer — customer details, history lines with running balance,
// totals, print date — printed from the history view. It prints
// only and changes nothing, and every figure on the printed
// statement matches the on-screen history on the same fixture,
// while the statement carries its print date.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HISTORY_PRINTED_STATEMENT_EMPTY_TEXT,
  HISTORY_PRINTED_STATEMENT_UNDATED_LABEL,
  isStrictPrintedStatementDate,
  formatPrintedStatementAmount,
  historyPrintedStatementBalanceNote,
  historyPrintedStatementTypeLabel,
  historyPrintedStatementDelta,
  historyPrintedStatementTotals,
  historyPrintedStatementLineText,
  historyPrintedStatementSummaryText,
  historyPrintedStatementRowsHtml,
  buildHistoryPrintedStatementHtml,
  historyPrintedStatementButtonMarkup,
} from '../history-printed-statement.js';
import {
  fullHistoryEntries,
  formatHistoryAmount,
} from '../full-history-list.js';

function entry(overrides = {}) {
  return {
    type: 'payment',
    date: '2026-09-05',
    month: '2026-09',
    amountCents: 200000,
    runningBalanceCents: 0,
    note: '',
    method: 'Cash',
    ref: 'RCPT-1',
    voided: false,
    ...overrides,
  };
}

function mixedEntries() {
  return [
    entry({ type: 'charge', date: '2026-09-01', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2026-09' }),
    entry({ type: 'payment', date: '2026-09-05', amountCents: 200000, runningBalanceCents: 0, method: 'Cash', ref: 'RCPT-1' }),
    entry({ type: 'charge', date: '2026-10-01', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2026-10' }),
    entry({ type: 'payment', date: '2026-10-07', amountCents: 150000, runningBalanceCents: 50000, method: 'JazzCash', ref: 'RCPT-2' }),
    entry({ type: 'refund', date: '2026-10-10', amountCents: 50000, runningBalanceCents: 100000, method: 'Cash', ref: 'REF-1' }),
  ];
}

function statementInput(overrides = {}) {
  return {
    businessName: 'Shahdara ISP',
    customerName: 'Test Customer',
    customerNumber: '36',
    mohalla: 'Mohalla A',
    entries: mixedEntries(),
    printDate: '2026-11-07',
    ...overrides,
  };
}

test('amount: whole rupees print with no decimals, paisa with one decimal', () => {
  assert.equal(formatPrintedStatementAmount(200000), 'PKR 2,000');
  assert.equal(formatPrintedStatementAmount(100), 'PKR 1');
  assert.equal(formatPrintedStatementAmount(0), 'PKR 0');
  assert.equal(formatPrintedStatementAmount(150050), 'PKR 1,500.5');
  assert.equal(formatPrintedStatementAmount(150055), 'PKR 1,500.55');
  assert.equal(formatPrintedStatementAmount(1), 'PKR 0.01');
  assert.equal(formatPrintedStatementAmount(123456700), 'PKR 1,234,567');
});

test('amount: a negative balance prints with the minus before PKR', () => {
  assert.equal(formatPrintedStatementAmount(-50000), '-PKR 500');
  assert.equal(formatPrintedStatementAmount(-150050), '-PKR 1,500.5');
});

test('amount: a figure the list cannot read prints as PKR 0, exactly as the list does', () => {
  assert.equal(formatPrintedStatementAmount(null), 'PKR 0');
  assert.equal(formatPrintedStatementAmount(undefined), 'PKR 0');
  assert.equal(formatPrintedStatementAmount(NaN), 'PKR 0');
  assert.equal(formatPrintedStatementAmount('not a number'), 'PKR 0');
});

test('amount: the statement formatter mirrors the on-screen formatter on every input', () => {
  for (const value of [200000, 150050, 1, 0, -50000, -150050, null, undefined, NaN, '', true, '2000']) {
    assert.equal(formatPrintedStatementAmount(value), formatHistoryAmount(value));
  }
});

test('balance note: settled, still owed and credit in the list’s plain words', () => {
  assert.equal(historyPrintedStatementBalanceNote(0), 'Settled');
  assert.equal(historyPrintedStatementBalanceNote(null), 'Settled');
  assert.equal(historyPrintedStatementBalanceNote(100000), 'Still owed PKR 1,000');
  assert.equal(historyPrintedStatementBalanceNote(-50000), 'Credit PKR 500');
});

test('type labels: all six history types have a plain label', () => {
  assert.equal(historyPrintedStatementTypeLabel('charge', false), 'Charge');
  assert.equal(historyPrintedStatementTypeLabel('payment', false), 'Payment');
  assert.equal(historyPrintedStatementTypeLabel('advance', false), 'Advance');
  assert.equal(historyPrintedStatementTypeLabel('credit', false), 'Credit');
  assert.equal(historyPrintedStatementTypeLabel('refund', false), 'Refund');
  assert.equal(historyPrintedStatementTypeLabel('adjustment', false), 'Adjustment');
});

test('type labels: an unknown type reads as a payment, never a guessed type', () => {
  assert.equal(historyPrintedStatementTypeLabel('mystery', false), 'Payment');
  assert.equal(historyPrintedStatementTypeLabel('', false), 'Payment');
  assert.equal(historyPrintedStatementTypeLabel(null, false), 'Payment');
});

test('type labels: a voided entry is marked plainly', () => {
  assert.equal(historyPrintedStatementTypeLabel('payment', true), 'Payment (voided)');
  assert.equal(historyPrintedStatementTypeLabel('refund', true), 'Refund (voided)');
});

test('delta: charges and refunds add to what is owed', () => {
  assert.equal(historyPrintedStatementDelta(entry({ type: 'charge', amountCents: 200000 })), 200000);
  assert.equal(historyPrintedStatementDelta(entry({ type: 'refund', amountCents: 50000 })), 50000);
});

test('delta: payments, advances and adjustments reduce what is owed', () => {
  assert.equal(historyPrintedStatementDelta(entry({ type: 'payment', amountCents: 200000 })), -200000);
  assert.equal(historyPrintedStatementDelta(entry({ type: 'advance', amountCents: 150000 })), -150000);
  assert.equal(historyPrintedStatementDelta(entry({ type: 'adjustment', amountCents: 50000 })), -50000);
});

test('delta: an adjustment-sourced credit reduces what is owed, an overpayment credit moves nothing', () => {
  assert.equal(historyPrintedStatementDelta(entry({ type: 'credit', source: 'adjustment', amountCents: 50000 })), -50000);
  assert.equal(historyPrintedStatementDelta(entry({ type: 'credit', source: 'overpayment', amountCents: 50000 })), 0);
  assert.equal(historyPrintedStatementDelta(entry({ type: 'credit', amountCents: 50000 })), 0);
});

test('delta: a voided entry is listed but moves nothing', () => {
  assert.equal(historyPrintedStatementDelta(entry({ type: 'payment', amountCents: 200000, voided: true })), 0);
  assert.equal(historyPrintedStatementDelta(entry({ type: 'charge', amountCents: 200000, voided: true })), 0);
});

test('delta: a missing or non-finite amount is not a number, never zero-filled into a movement', () => {
  assert.equal(historyPrintedStatementDelta(entry({ amountCents: null })), 0);
  assert.equal(historyPrintedStatementDelta(entry({ amountCents: undefined })), 0);
  assert.equal(historyPrintedStatementDelta(entry({ amountCents: true })), 0);
  assert.equal(historyPrintedStatementDelta(entry({ amountCents: '' })), 0);
  assert.equal(historyPrintedStatementDelta(entry({ amountCents: NaN })), 0);
  assert.equal(historyPrintedStatementDelta(entry({ type: 'mystery', amountCents: 200000 })), 0);
  assert.equal(historyPrintedStatementDelta(null), 0);
  assert.equal(historyPrintedStatementDelta('not an entry'), 0);
});

test('totals: billed, paid, still owed and the payment count on a mixed list', () => {
  const totals = historyPrintedStatementTotals(mixedEntries());
  assert.deepEqual(totals, {
    entryCount: 5,
    billedCents: 450000,
    paidCents: 350000,
    stillOwedCents: 100000,
    paymentCount: 2,
  });
});

test('totals: a voided payment never counts as a payment and moves nothing', () => {
  const totals = historyPrintedStatementTotals([
    entry({ type: 'charge', date: '2026-09-01', amountCents: 200000, runningBalanceCents: 200000 }),
    entry({ type: 'payment', date: '2026-09-05', amountCents: 200000, runningBalanceCents: 200000, voided: true }),
  ]);
  assert.equal(totals.billedCents, 200000);
  assert.equal(totals.paidCents, 0);
  assert.equal(totals.stillOwedCents, 200000);
  assert.equal(totals.paymentCount, 0);
});

test('totals: an advance counts as a payment, a credit does not', () => {
  const totals = historyPrintedStatementTotals([
    entry({ type: 'advance', amountCents: 100000 }),
    entry({ type: 'credit', source: 'overpayment', amountCents: 50000 }),
  ]);
  assert.equal(totals.paymentCount, 1);
  assert.equal(totals.paidCents, 100000);
});

test('totals: a missing list or an empty list shows zeros, not a blank', () => {
  assert.deepEqual(historyPrintedStatementTotals([]), {
    entryCount: 0, billedCents: 0, paidCents: 0, stillOwedCents: 0, paymentCount: 0,
  });
  assert.deepEqual(historyPrintedStatementTotals(null), {
    entryCount: 0, billedCents: 0, paidCents: 0, stillOwedCents: 0, paymentCount: 0,
  });
  assert.deepEqual(historyPrintedStatementTotals('not a list'), {
    entryCount: 0, billedCents: 0, paidCents: 0, stillOwedCents: 0, paymentCount: 0,
  });
});

test('line text: one entry becomes one plain line with its own running balance', () => {
  assert.equal(
    historyPrintedStatementLineText(entry({ type: 'payment', date: '2026-09-05', amountCents: 200000, runningBalanceCents: 0, method: 'Cash' })),
    '2026-09-05 · Payment · PKR 2,000 · Balance PKR 0',
  );
  assert.equal(
    historyPrintedStatementLineText(entry({ type: 'charge', date: '2026-09-01', amountCents: 200000, runningBalanceCents: 200000 })),
    '2026-09-01 · Charge · PKR 2,000 · Balance PKR 2,000',
  );
});

test('line text: an undated entry and a voided entry say so plainly', () => {
  assert.equal(
    historyPrintedStatementLineText(entry({ date: '' })),
    'date not recorded · Payment · PKR 2,000 · Balance PKR 0',
  );
  assert.equal(
    historyPrintedStatementLineText(entry({ type: 'payment', voided: true })),
    '2026-09-05 · Payment (voided) · PKR 2,000 · Balance PKR 0',
  );
  assert.equal(
    historyPrintedStatementLineText(null),
    'date not recorded · Payment · PKR 0 · Balance PKR 0',
  );
  assert.equal(HISTORY_PRINTED_STATEMENT_UNDATED_LABEL, 'date not recorded');
});

test('summary text: the totals read in plain words', () => {
  const totals = historyPrintedStatementTotals(mixedEntries());
  assert.equal(
    historyPrintedStatementSummaryText(totals),
    '5 entries · Billed PKR 4,500 · Paid PKR 3,500 · Still owed PKR 1,000 · 2 payments',
  );
  assert.equal(
    historyPrintedStatementSummaryText({ entryCount: 1, billedCents: 200000, paidCents: 200000, stillOwedCents: 0, paymentCount: 1 }),
    '1 entry · Billed PKR 2,000 · Paid PKR 2,000 · Settled · 1 payment',
  );
  assert.equal(
    historyPrintedStatementSummaryText({ entryCount: 2, billedCents: 100000, paidCents: 150000, stillOwedCents: -50000, paymentCount: 1 }),
    '2 entries · Billed PKR 1,000 · Paid PKR 1,500 · Credit PKR 500 · 1 payment',
  );
  assert.equal(historyPrintedStatementSummaryText(null), HISTORY_PRINTED_STATEMENT_EMPTY_TEXT);
  assert.equal(HISTORY_PRINTED_STATEMENT_EMPTY_TEXT, 'No transactions yet');
});

test('rows: the order given is the order kept, and the input is never mutated', () => {
  const entries = mixedEntries();
  const before = JSON.stringify(entries);
  const html = historyPrintedStatementRowsHtml(entries);
  assert.equal((html.match(/<tr>/g) || []).length, 5);
  assert.ok(html.indexOf('2026-09-01') < html.indexOf('2026-09-05'));
  assert.ok(html.indexOf('2026-09-05') < html.indexOf('2026-10-01'));
  assert.ok(html.indexOf('2026-10-01') < html.indexOf('2026-10-07'));
  assert.ok(html.indexOf('2026-10-07') < html.indexOf('2026-10-10'));
  assert.ok(html.includes('Charge'));
  assert.ok(html.includes('PKR 2,000'));
  assert.ok(html.includes('JazzCash'));
  assert.ok(html.includes('RCPT-2'));
  assert.equal(JSON.stringify(entries), before);
  assert.equal(historyPrintedStatementRowsHtml([]), '');
  assert.equal(historyPrintedStatementRowsHtml(null), '');
});

test('rows: user text is escaped, never printed raw', () => {
  const html = historyPrintedStatementRowsHtml([
    entry({ method: '<script>alert(1)</script>', ref: 'A & B "quoted"' }),
  ]);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /A &amp; B &quot;quoted&quot;/);
});

test('rows: a missing entry is an undated payment row, never a crash', () => {
  const html = historyPrintedStatementRowsHtml([null]);
  assert.match(html, /date not recorded/);
  assert.match(html, /Payment/);
});

test('page: the statement carries the customer, the print date and every line in order', () => {
  const html = buildHistoryPrintedStatementHtml(statementInput());
  assert.match(html, /Shahdara ISP/);
  assert.match(html, /Customer history statement/);
  assert.match(html, /Test Customer/);
  assert.match(html, /Customer no: 36/);
  assert.match(html, /Mohalla: Mohalla A/);
  assert.match(html, /Print date: 2026-11-07/);
  assert.ok(html.indexOf('2026-09-01') < html.indexOf('2026-09-05'));
  assert.ok(html.indexOf('2026-10-07') < html.indexOf('2026-10-10'));
  assert.match(html, /5 entries · Billed PKR 4,500 · Paid PKR 3,500 · Still owed PKR 1,000 · 2 payments/);
  assert.match(html, /<table>/);
  assert.match(html, /<thead>/);
  assert.match(html, /<tfoot>/);
});

test('page: customer details are escaped, never printed raw', () => {
  const html = buildHistoryPrintedStatementHtml(statementInput({
    customerName: '<b>Bad</b> & "Sons"',
    mohalla: 'A < B',
    businessName: 'Test <ISP>',
  }));
  assert.doesNotMatch(html, /<b>Bad<\/b>/);
  assert.match(html, /&lt;b&gt;Bad&lt;\/b&gt; &amp; &quot;Sons&quot;/);
  assert.match(html, /A &lt; B/);
  assert.match(html, /Test &lt;ISP&gt;/);
});

test('page: without a name it falls back to the plain word Customer', () => {
  const html = buildHistoryPrintedStatementHtml(statementInput({ customerName: '', customerNumber: '', mohalla: '' }));
  assert.match(html, /Customer: Customer/);
  assert.doesNotMatch(html, /Customer no:/);
  assert.doesNotMatch(html, /Mohalla:/);
});

test('page: a statement with no usable print date is refused, never printed with a guessed date', () => {
  assert.equal(buildHistoryPrintedStatementHtml(statementInput({ printDate: '' })), null);
  assert.equal(buildHistoryPrintedStatementHtml(statementInput({ printDate: null })), null);
  assert.equal(buildHistoryPrintedStatementHtml(statementInput({ printDate: '2026-11' })), null);
  assert.equal(buildHistoryPrintedStatementHtml(statementInput({ printDate: '2026-13-40' })), null);
  assert.equal(buildHistoryPrintedStatementHtml(statementInput({ printDate: '2026-02-29' })), null);
  assert.equal(buildHistoryPrintedStatementHtml(null), null);
  assert.equal(buildHistoryPrintedStatementHtml('not an input'), null);
});

test('page: strict dates keep leap days only in leap years', () => {
  assert.equal(isStrictPrintedStatementDate('2028-02-29'), true);
  assert.equal(isStrictPrintedStatementDate('2027-02-29'), false);
  assert.equal(isStrictPrintedStatementDate('2000-02-29'), true);
  assert.equal(isStrictPrintedStatementDate('1900-02-29'), false);
  assert.equal(isStrictPrintedStatementDate('2026-11-07'), true);
  assert.equal(isStrictPrintedStatementDate('2026-04-31'), false);
  assert.equal(isStrictPrintedStatementDate('2026-00-10'), false);
  assert.equal(isStrictPrintedStatementDate('2026-11-07T00:00'), false);
  assert.equal(isStrictPrintedStatementDate(20261107), false);
});

test('page: an empty history still prints, with the plain-words empty line and zero totals', () => {
  const html = buildHistoryPrintedStatementHtml(statementInput({ entries: [] }));
  assert.match(html, /No transactions yet/);
  assert.match(html, /0 entries · Billed PKR 0 · Paid PKR 0 · Settled · 0 payments/);
  assert.match(html, /Print date: 2026-11-07/);
  const noEntries = buildHistoryPrintedStatementHtml(statementInput({ entries: null }));
  assert.match(noEntries, /No transactions yet/);
});

test('acceptance: every figure on the printed statement matches the on-screen history exactly', () => {
  const bills = [
    {
      id: 'BILL-A', month: '2026-09', dueDate: '2026-09-01', dueAmount: 2000,
      payments: [{ id: 'RCPT-A1', date: '2026-09-05', amount: 2000, method: 'Cash' }],
    },
    {
      id: 'BILL-B', month: '2026-10', dueDate: '2026-10-01', dueAmount: 2000,
      payments: [{ id: 'RCPT-B1', date: '2026-10-07', amount: 1500, method: 'JazzCash' }],
    },
  ];
  const entries = fullHistoryEntries({ customerId: 'CUST-1', bills, creditEntries: [], refundRecords: [] });
  assert.equal(entries.length, 4);
  // Each printed line carries the entry's own amount and running
  // balance, formatted exactly as the on-screen list formats them.
  for (const entryItem of entries) {
    const line = historyPrintedStatementLineText(entryItem);
    assert.ok(line.includes(formatHistoryAmount(entryItem.amountCents)));
    assert.ok(line.includes(formatHistoryAmount(entryItem.runningBalanceCents)));
  }
  // The totals still owed is the last entry's own running balance.
  const totals = historyPrintedStatementTotals(entries);
  assert.equal(totals.stillOwedCents, entries[entries.length - 1].runningBalanceCents);
  assert.equal(totals.billedCents, 400000);
  assert.equal(totals.paidCents, 350000);
  assert.equal(totals.paymentCount, 2);
  // The built page carries every line and the matching summary.
  const html = buildHistoryPrintedStatementHtml({
    businessName: 'Shahdara ISP',
    customerName: 'Test Customer',
    customerNumber: '36',
    mohalla: 'Mohalla A',
    entries,
    printDate: '2026-11-07',
  });
  for (const entryItem of entries) {
    assert.ok(html.includes(historyPrintedStatementLineText(entryItem).split(' · ')[0]));
    assert.ok(html.includes(formatHistoryAmount(entryItem.amountCents)));
  }
  assert.match(html, /4 entries · Billed PKR 4,000 · Paid PKR 3,500 · Still owed PKR 500 · 2 payments/);
});

test('acceptance: a filtered view prints only what it shows', () => {
  const entries = mixedEntries();
  const paymentsOnly = entries.filter((e) => e.type === 'payment');
  const totals = historyPrintedStatementTotals(paymentsOnly);
  assert.equal(totals.entryCount, 2);
  assert.equal(totals.billedCents, 0);
  assert.equal(totals.paidCents, 350000);
  const html = buildHistoryPrintedStatementHtml(statementInput({ entries: paymentsOnly }));
  assert.doesNotMatch(html, /BILL-2026-09/);
  assert.match(html, /RCPT-1/);
  assert.match(html, /RCPT-2/);
});

test('button: the markup carries the print button id and label', () => {
  const markup = historyPrintedStatementButtonMarkup();
  assert.match(markup, /id="hpsHistoryPrintedStatement"/);
  assert.match(markup, /Print history statement/);
  assert.match(markup, /type="button"/);
});

test('entries are never mutated by any statement function', () => {
  const entries = mixedEntries();
  const before = JSON.stringify(entries);
  historyPrintedStatementTotals(entries);
  historyPrintedStatementRowsHtml(entries);
  buildHistoryPrintedStatementHtml(statementInput({ entries }));
  assert.equal(JSON.stringify(entries), before);
});

// Fences: the fenced module names are built in fragments below so
// this file never states them as literals.
test('fence: the full history list still exports its builders and is still wired', () => {
  const listName = 'full-' + 'history-list.js';
  const listSource = readFileSync(new URL(`../${listName}`, import.meta.url), 'utf8');
  assert.match(listSource, /export const FULL_HISTORY_TYPES/);
  assert.match(listSource, /export function fullHistoryEntries/);
  assert.match(listSource, /export function fullHistoryListHtml/);
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(appSource, /fullHistoryEntries/);
  assert.match(appSource, /fullHistoryListHtml/);
  assert.doesNotMatch(listSource, /historyPrintedStatement/);
});

test('fence: the type, date-range, method, amount, balance, grouping, yearly and CSV neighbours are untouched', () => {
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(appSource, /historyTypeFilterSelectMarkup/);
  assert.match(appSource, /historyDateRangeFilterMarkup/);
  assert.match(appSource, /historyMethodFilterSelectMarkup/);
  assert.match(appSource, /historyAmountSearchMarkup/);
  assert.match(appSource, /historyRunningBalanceColumnHtml/);
  assert.match(appSource, /historyMonthlyGroupingHtml/);
  assert.match(appSource, /historyYearlySummaryHtml/);
  assert.match(appSource, /historyCsvExportButtonMarkup/);
  for (const name of [
    'history-' + 'type-filter.js',
    'history-' + 'date-range-filter.js',
    'history-' + 'method-filter.js',
    'history-' + 'amount-search.js',
    'history-' + 'running-balance.js',
    'history-' + 'monthly-grouping.js',
    'history-' + 'yearly-summary.js',
    'history-' + 'csv-export.js',
  ]) {
    const source = readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /historyPrintedStatement/);
  }
});

test('fence: the WhatsApp statement draft is untouched and still wired', () => {
  const draftName = 'statement-' + 'draft.js';
  const draftSource = readFileSync(new URL(`../${draftName}`, import.meta.url), 'utf8');
  assert.match(draftSource, /export function buildMonthlyStatement/);
  assert.match(draftSource, /export function buildStatementDraftText/);
  assert.match(draftSource, /export function statementDraftHtml/);
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(appSource, /statementDraftSectionHtml/);
  assert.match(appSource, /buildStatementDraftText/);
  assert.doesNotMatch(draftSource, /historyPrintedStatement/);
});

test('fence: the roll-forward still exports its builders and is still wired', () => {
  const rollName = 'balance-' + 'rollforward.js';
  const rollSource = readFileSync(new URL(`../${rollName}`, import.meta.url), 'utf8');
  assert.match(rollSource, /export function buildCustomerRollForward/);
  assert.match(rollSource, /export function buildRollForwardTotals/);
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(appSource, /buildCustomerRollForward/);
  assert.doesNotMatch(rollSource, /historyPrintedStatement/);
});

test('purity: the module is a view only — no store, no date, no document, no fetch', () => {
  const source = readFileSync(new URL('../history-printed-statement.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /localStorage/);
  assert.doesNotMatch(source, /new Date\(/);
  assert.doesNotMatch(source, /Date\.now\(/);
  assert.doesNotMatch(source, /document\./);
  assert.doesNotMatch(source, /fetch\(/);
  assert.doesNotMatch(source, /import /);
});

test('header: the module header never names a fenced module literally', () => {
  const source = readFileSync(new URL('../history-printed-statement.js', import.meta.url), 'utf8');
  const header = source.slice(0, source.indexOf('export const'));
  for (const name of [
    'statement-' + 'draft.js',
    'full-' + 'history-list.js',
    'history-' + 'type-filter.js',
    'history-' + 'date-range-filter.js',
    'history-' + 'method-filter.js',
    'history-' + 'amount-search.js',
    'history-' + 'running-balance.js',
    'history-' + 'monthly-grouping.js',
    'history-' + 'yearly-summary.js',
    'history-' + 'csv-export.js',
    'balance-' + 'rollforward.js',
  ]) {
    assert.doesNotMatch(header, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('wiring: the app imports the statement and renders its button from the shown rows', () => {
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(appSource, /historyPrintedStatementButtonMarkup/);
  assert.match(appSource, /buildHistoryPrintedStatementHtml/);
  assert.match(appSource, /hpsHistoryPrintedStatementHost/);
  assert.match(appSource, /hpsHistoryPrintedStatement/);
  assert.match(appSource, /localDate\(\)/);
  const htmlSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(htmlSource, /id="hpsHistoryPrintedStatementHost"/);
});
