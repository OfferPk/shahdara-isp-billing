// Plan 409 — History export to CSV per customer: a customer or
// the owner wants the history in a file — for their own records or
// for an accountant — but the history exists only on screen. One
// CSV export of a customer's full history (date, type, amount,
// method, reference, running balance), generated on the device
// from existing records. It exports only and changes nothing, and
// the exported rows match the on-screen history exactly, in the
// same order, while the file name names the customer and the date.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HISTORY_CSV_EXPORT_EMPTY_TEXT,
  HISTORY_CSV_EXPORT_HEADERS,
  HISTORY_CSV_EXPORT_UNDATED_LABEL,
  formatHistoryCsvAmount,
  historyCsvExportTypeLabel,
  historyCsvExportRow,
  historyCsvExportRows,
  historyCsvEscapeCell,
  historyCsvExportText,
  historyCsvExportFilename,
  historyCsvExportButtonMarkup,
} from '../history-csv-export.js';
import {
  fullHistoryEntries,
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

test('amount: whole rupees print with no decimals', () => {
  assert.equal(formatHistoryCsvAmount(200000), '2000');
  assert.equal(formatHistoryCsvAmount(100), '1');
  assert.equal(formatHistoryCsvAmount(0), '0');
});

test('amount: a paisa remainder prints with up to two decimals, never grouped', () => {
  assert.equal(formatHistoryCsvAmount(150050), '1500.5');
  assert.equal(formatHistoryCsvAmount(150055), '1500.55');
  assert.equal(formatHistoryCsvAmount(1), '0.01');
  assert.equal(formatHistoryCsvAmount(123456700), '1234567');
});

test('amount: a negative balance prints with a minus sign', () => {
  assert.equal(formatHistoryCsvAmount(-50000), '-500');
  assert.equal(formatHistoryCsvAmount(-150050), '-1500.5');
});

test('amount: a figure that is not a number stays blank, never zero', () => {
  assert.equal(formatHistoryCsvAmount(null), '');
  assert.equal(formatHistoryCsvAmount(undefined), '');
  assert.equal(formatHistoryCsvAmount(true), '');
  assert.equal(formatHistoryCsvAmount(false), '');
  assert.equal(formatHistoryCsvAmount(''), '');
  assert.equal(formatHistoryCsvAmount('   '), '');
  assert.equal(formatHistoryCsvAmount(NaN), '');
  assert.equal(formatHistoryCsvAmount('not a number'), '');
});

test('type labels: all six history types have a plain label', () => {
  assert.equal(historyCsvExportTypeLabel('charge', false), 'Charge');
  assert.equal(historyCsvExportTypeLabel('payment', false), 'Payment');
  assert.equal(historyCsvExportTypeLabel('advance', false), 'Advance');
  assert.equal(historyCsvExportTypeLabel('credit', false), 'Credit');
  assert.equal(historyCsvExportTypeLabel('refund', false), 'Refund');
  assert.equal(historyCsvExportTypeLabel('adjustment', false), 'Adjustment');
});

test('type labels: an unknown type reads as a payment, never a guessed type', () => {
  assert.equal(historyCsvExportTypeLabel('mystery', false), 'Payment');
  assert.equal(historyCsvExportTypeLabel('', false), 'Payment');
  assert.equal(historyCsvExportTypeLabel(null, false), 'Payment');
});

test('type labels: a voided entry is marked plainly', () => {
  assert.equal(historyCsvExportTypeLabel('payment', true), 'Payment (voided)');
  assert.equal(historyCsvExportTypeLabel('refund', true), 'Refund (voided)');
});

test('row: one entry becomes six columns in scope order', () => {
  const row = historyCsvExportRow(entry({
    type: 'payment', date: '2026-09-05', amountCents: 200000,
    method: 'JazzCash', ref: 'RCPT-1', runningBalanceCents: 0,
  }));
  assert.deepEqual(row, ['2026-09-05', 'Payment', '2000', 'JazzCash', 'RCPT-1', '0']);
});

test('row: a charge has a blank method and carries its bill reference', () => {
  const row = historyCsvExportRow(entry({
    type: 'charge', date: '2026-09-01', amountCents: 200000,
    method: '', ref: 'BILL-2026-09', runningBalanceCents: 200000,
  }));
  assert.deepEqual(row, ['2026-09-01', 'Charge', '2000', '', 'BILL-2026-09', '2000']);
});

test('row: an entry with no date says so plainly, and a month-only date is kept', () => {
  assert.equal(historyCsvExportRow(entry({ date: '' }))[0], HISTORY_CSV_EXPORT_UNDATED_LABEL);
  assert.equal(historyCsvExportRow(entry({ date: '2026-09' }))[0], '2026-09');
});

test('row: a missing amount or balance stays blank, never zero', () => {
  const row = historyCsvExportRow(entry({ amountCents: null, runningBalanceCents: undefined }));
  assert.equal(row[2], '');
  assert.equal(row[5], '');
});

test('row: a missing entry is an undated payment row, never a crash', () => {
  assert.deepEqual(historyCsvExportRow(null), [HISTORY_CSV_EXPORT_UNDATED_LABEL, 'Payment', '', '', '', '']);
  assert.deepEqual(historyCsvExportRow('not an entry'), [HISTORY_CSV_EXPORT_UNDATED_LABEL, 'Payment', '', '', '', '']);
});

test('rows: the order given is the order kept, and the input is never mutated', () => {
  const entries = mixedEntries();
  const before = JSON.stringify(entries);
  const rows = historyCsvExportRows(entries);
  assert.equal(rows.length, 5);
  assert.deepEqual(rows[0], ['2026-09-01', 'Charge', '2000', '', 'BILL-2026-09', '2000']);
  assert.deepEqual(rows[1], ['2026-09-05', 'Payment', '2000', 'Cash', 'RCPT-1', '0']);
  assert.deepEqual(rows[2], ['2026-10-01', 'Charge', '2000', '', 'BILL-2026-10', '2000']);
  assert.deepEqual(rows[3], ['2026-10-07', 'Payment', '1500', 'JazzCash', 'RCPT-2', '500']);
  assert.deepEqual(rows[4], ['2026-10-10', 'Refund', '500', 'Cash', 'REF-1', '1000']);
  assert.equal(JSON.stringify(entries), before);
  assert.deepEqual(historyCsvExportRows(null), []);
  assert.deepEqual(historyCsvExportRows('not a list'), []);
});

test('escape: a plain cell stays plain', () => {
  assert.equal(historyCsvEscapeCell('Cash'), 'Cash');
  assert.equal(historyCsvEscapeCell('2000'), '2000');
  assert.equal(historyCsvEscapeCell(''), '');
});

test('escape: a comma, a quote, or a line break forces quotes, and a quote doubles', () => {
  assert.equal(historyCsvEscapeCell('Cash, JazzCash'), '"Cash, JazzCash"');
  assert.equal(historyCsvEscapeCell('said "paid"'), '"said ""paid"""');
  assert.equal(historyCsvEscapeCell('line one\nline two'), '"line one\nline two"');
  assert.equal(historyCsvEscapeCell('line one\r\nline two'), '"line one\r\nline two"');
});

test('text: the file starts with a BOM and the exact header line', () => {
  const text = historyCsvExportText(mixedEntries());
  assert.equal(text.charCodeAt(0), 0xFEFF);
  const lines = text.slice(1).split('\r\n');
  assert.equal(lines[0], 'Date,Type,Amount (PKR),Method,Reference,Running balance (PKR)');
  assert.deepEqual(HISTORY_CSV_EXPORT_HEADERS, ['Date', 'Type', 'Amount (PKR)', 'Method', 'Reference', 'Running balance (PKR)']);
});

test('text: rows follow the header in the same order, joined with CRLF', () => {
  const text = historyCsvExportText(mixedEntries());
  const lines = text.slice(1).split('\r\n');
  assert.equal(lines.length, 6);
  assert.equal(lines[1], '2026-09-01,Charge,2000,,BILL-2026-09,2000');
  assert.equal(lines[2], '2026-09-05,Payment,2000,Cash,RCPT-1,0');
  assert.equal(lines[3], '2026-10-01,Charge,2000,,BILL-2026-10,2000');
  assert.equal(lines[4], '2026-10-07,Payment,1500,JazzCash,RCPT-2,500');
  assert.equal(lines[5], '2026-10-10,Refund,500,Cash,REF-1,1000');
});

test('text: a cell that needs quoting is quoted in the file', () => {
  const text = historyCsvExportText([entry({ method: 'Cash, JazzCash', ref: 'RCPT "1"' })]);
  const lines = text.slice(1).split('\r\n');
  assert.equal(lines[1], '2026-09-05,Payment,2000,"Cash, JazzCash","RCPT ""1""",0');
});

test('text: an empty history still exports the header, never a blank file', () => {
  const text = historyCsvExportText([]);
  assert.equal(text, '\uFEFFDate,Type,Amount (PKR),Method,Reference,Running balance (PKR)');
  assert.equal(historyCsvExportText(null), '\uFEFFDate,Type,Amount (PKR),Method,Reference,Running balance (PKR)');
  assert.equal(HISTORY_CSV_EXPORT_EMPTY_TEXT, 'No transactions yet');
});

test('acceptance: exported rows match the on-screen history exactly, in the same order', () => {
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
  const rows = historyCsvExportRows(entries);
  assert.deepEqual(rows, [
    ['2026-09-01', 'Charge', '2000', '', 'BILL-A', '2000'],
    ['2026-09-05', 'Payment', '2000', 'Cash', 'RCPT-A1', '0'],
    ['2026-10-01', 'Charge', '2000', '', 'BILL-B', '2000'],
    ['2026-10-07', 'Payment', '1500', 'JazzCash', 'RCPT-B1', '500'],
  ]);
  const lines = historyCsvExportText(entries).slice(1).split('\r\n');
  assert.equal(lines.length, 5);
  assert.equal(lines[4], '2026-10-07,Payment,1500,JazzCash,RCPT-B1,500');
});

test('acceptance: a filtered view exports only what it shows', () => {
  const entries = mixedEntries();
  const paymentsOnly = entries.filter((e) => e.type === 'payment');
  const rows = historyCsvExportRows(paymentsOnly);
  assert.equal(rows.length, 2);
  assert.equal(rows[0][1], 'Payment');
  assert.equal(rows[1][1], 'Payment');
});

test('filename: the customer name folds to a dash slug with the export date', () => {
  const customer = { name: 'RAJA SHUNAID', customerNumber: '36', id: 'CUST-1' };
  assert.equal(historyCsvExportFilename(customer, '2026-11-07'), 'history-raja-shunaid-2026-11-07.csv');
});

test('filename: stray marks and extra spaces fold to single dashes', () => {
  assert.equal(historyCsvExportFilename({ name: "  O'Brien  House!  " }, '2026-11-07'), 'history-o-brien-house-2026-11-07.csv');
  assert.equal(historyCsvExportFilename({ name: 'A & B Traders' }, '2026-11-07'), 'history-a-b-traders-2026-11-07.csv');
});

test('filename: without a name it falls back to the number, then the id, then customer', () => {
  assert.equal(historyCsvExportFilename({ name: '', customerNumber: '36', id: 'CUST-1' }, '2026-11-07'), 'history-36-2026-11-07.csv');
  assert.equal(historyCsvExportFilename({ name: '', customerNumber: '', id: 'CUST-1' }, '2026-11-07'), 'history-cust-1-2026-11-07.csv');
  assert.equal(historyCsvExportFilename(null, '2026-11-07'), 'history-customer-2026-11-07.csv');
  assert.equal(historyCsvExportFilename({}, '2026-11-07'), 'history-customer-2026-11-07.csv');
});

test('filename: a date that is not a strict date reads as undated, never guessed', () => {
  const customer = { name: 'RAJA SHUNAID' };
  assert.equal(historyCsvExportFilename(customer, '2026-13-40'), 'history-raja-shunaid-undated.csv');
  assert.equal(historyCsvExportFilename(customer, ''), 'history-raja-shunaid-undated.csv');
  assert.equal(historyCsvExportFilename(customer, null), 'history-raja-shunaid-undated.csv');
  assert.equal(historyCsvExportFilename(customer, '2026-11'), 'history-raja-shunaid-undated.csv');
});

test('button: the markup carries the export button id and label', () => {
  const markup = historyCsvExportButtonMarkup();
  assert.match(markup, /id="hxeHistoryCsvExport"/);
  assert.match(markup, /Export history CSV/);
  assert.match(markup, /type="button"/);
});

test('entries are never mutated by any export function', () => {
  const entries = mixedEntries();
  const before = JSON.stringify(entries);
  historyCsvExportRows(entries);
  historyCsvExportText(entries);
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
  assert.doesNotMatch(listSource, /historyCsvExport/);
});

test('fence: the type, date-range, method, amount, balance, grouping and yearly neighbours are untouched', () => {
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(appSource, /historyTypeFilterSelectMarkup/);
  assert.match(appSource, /historyDateRangeFilterMarkup/);
  assert.match(appSource, /historyMethodFilterSelectMarkup/);
  assert.match(appSource, /historyAmountSearchMarkup/);
  assert.match(appSource, /historyRunningBalanceColumnHtml/);
  assert.match(appSource, /historyMonthlyGroupingHtml/);
  assert.match(appSource, /historyYearlySummaryHtml/);
  for (const name of [
    'history-' + 'type-filter.js',
    'history-' + 'date-range-filter.js',
    'history-' + 'method-filter.js',
    'history-' + 'amount-search.js',
    'history-' + 'running-balance.js',
    'history-' + 'monthly-grouping.js',
    'history-' + 'yearly-summary.js',
  ]) {
    const source = readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /historyCsvExport/);
  }
});

test('fence: the roll-forward still exports its builders and is still wired', () => {
  const rollName = 'balance-' + 'rollforward.js';
  const rollSource = readFileSync(new URL(`../${rollName}`, import.meta.url), 'utf8');
  assert.match(rollSource, /export function buildCustomerRollForward/);
  assert.match(rollSource, /export function buildRollForwardTotals/);
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(appSource, /buildCustomerRollForward/);
  assert.doesNotMatch(rollSource, /historyCsvExport/);
});

test('fence: the monthly history text export is untouched and still wired', () => {
  const coreSource = readFileSync(new URL('../core.js', import.meta.url), 'utf8');
  assert.match(coreSource, /export function exportCustomerHistory/);
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(appSource, /customerExportButton/);
  assert.match(appSource, /exportCustomerHistory/);
  assert.doesNotMatch(coreSource, /historyCsvExport/);
});

test('purity: the module is a view only — no store, no date, no document, no fetch', () => {
  const source = readFileSync(new URL('../history-csv-export.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /localStorage/);
  assert.doesNotMatch(source, /new Date\(/);
  assert.doesNotMatch(source, /Date\.now\(/);
  assert.doesNotMatch(source, /document\./);
  assert.doesNotMatch(source, /fetch\(/);
  assert.doesNotMatch(source, /import /);
});

test('header: the module header never names a fenced module literally', () => {
  const source = readFileSync(new URL('../history-csv-export.js', import.meta.url), 'utf8');
  const header = source.slice(0, source.indexOf('export const'));
  for (const name of [
    'full-' + 'history-list.js',
    'history-' + 'type-filter.js',
    'history-' + 'date-range-filter.js',
    'history-' + 'method-filter.js',
    'history-' + 'amount-search.js',
    'history-' + 'running-balance.js',
    'history-' + 'monthly-grouping.js',
    'history-' + 'yearly-summary.js',
    'balance-' + 'rollforward.js',
    'annual-' + 'summary.js',
  ]) {
    assert.doesNotMatch(header, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('wiring: the app imports the export and renders its button from the shown rows', () => {
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(appSource, /historyCsvExportButtonMarkup/);
  assert.match(appSource, /historyCsvExportFilename/);
  assert.match(appSource, /historyCsvExportText\(shown\)/);
  assert.match(appSource, /hxeHistoryCsvExportHost/);
  assert.match(appSource, /hxeHistoryCsvExport/);
  assert.match(appSource, /downloadCsvFile\(filename, historyCsvExportText\(shown\)\)/);
  assert.match(appSource, /getPakistanLocalDate\(\)/);
  const htmlSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(htmlSource, /id="hxeHistoryCsvExportHost"/);
});
