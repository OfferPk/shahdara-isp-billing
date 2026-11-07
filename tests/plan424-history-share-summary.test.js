// Plan 424 — History share as a plain-text summary:
// one plain-text summary of a customer's history — customer name,
// period covered, totals billed, paid, and still owed, plus the
// last five transactions — prepared as a draft the operator sends.
// It drafts only and sends nothing automatically: every figure
// matches the on-screen history on the same fixture, and the
// summary names its period plainly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HISTORY_SHARE_SUMMARY_EMPTY_TEXT,
  HISTORY_SHARE_SUMMARY_LAST_FIVE_COUNT,
  HISTORY_SHARE_SUMMARY_BUTTON_TEXT,
  HISTORY_SHARE_SUMMARY_SEND_TEXT,
  HISTORY_SHARE_SUMMARY_NO_NUMBER_TEXT,
  HISTORY_SHARE_SUMMARY_DO_NOT_MESSAGE_TEXT,
  historyShareSummaryTotals,
  historyShareSummaryPeriod,
  historyShareSummaryLastFive,
  historyShareSummaryEntryLineText,
  historyShareSummaryText,
  historyShareSummaryButtonMarkup,
  historyShareSummaryDraftHtml,
} from '../history-share-summary.js';
import {
  fullHistoryEntries,
  fullHistoryEntryLineText,
} from '../full-history-list.js';

function entry(overrides = {}) {
  return {
    type: 'payment',
    date: '2026-11-07',
    month: '2026-11',
    amountCents: 100000,
    runningBalanceCents: 0,
    note: '',
    method: 'Cash',
    ref: 'PAY-1',
    voided: false,
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

// --- Totals: billed, paid, still owed ---

test('Plan 424: billed is charges plus refunds, paid is payments, advances and adjustments', () => {
  const totals = historyShareSummaryTotals([
    entry({ type: 'charge', date: '2026-09-05', amountCents: 100000, ref: 'BILL-1' }),
    entry({ type: 'payment', date: '2026-09-06', amountCents: 50000, ref: 'PAY-1' }),
    entry({ type: 'advance', date: '2026-09-07', amountCents: 30000, ref: 'PAY-2' }),
    entry({ type: 'adjustment', date: '2026-09-08', amountCents: 10000, ref: 'ADJ-1' }),
    entry({ type: 'refund', date: '2026-09-09', amountCents: 20000, ref: 'RF-1' }),
  ]);
  assert.equal(totals.billedCents, 120000);
  assert.equal(totals.paidCents, 90000);
  assert.equal(totals.stillOwedCents, 30000);
});

test('Plan 424: an adjustment-sourced credit counts as paid, an overpayment credit moves nothing', () => {
  const totals = historyShareSummaryTotals([
    entry({ type: 'charge', date: '2026-09-05', amountCents: 100000, ref: 'BILL-1' }),
    entry({ type: 'credit', date: '2026-09-06', amountCents: 40000, ref: 'CR-1', source: 'overpayment' }),
    entry({ type: 'credit', date: '2026-09-07', amountCents: 15000, ref: 'CR-2', source: 'adjustment' }),
  ]);
  assert.equal(totals.billedCents, 100000);
  assert.equal(totals.paidCents, 15000);
  assert.equal(totals.stillOwedCents, 85000);
});

test('Plan 424: a voided entry moves nothing in the totals', () => {
  const totals = historyShareSummaryTotals([
    entry({ type: 'charge', date: '2026-09-05', amountCents: 100000, ref: 'BILL-1' }),
    entry({ type: 'payment', date: '2026-09-06', amountCents: 99900, ref: 'PAY-1', voided: true }),
    entry({ type: 'charge', date: '2026-09-07', amountCents: 50000, ref: 'BILL-2', voided: true }),
  ]);
  assert.equal(totals.billedCents, 100000);
  assert.equal(totals.paidCents, 0);
  assert.equal(totals.stillOwedCents, 100000);
});

test('Plan 424: a missing, boolean or blank figure is not a number, never zero', () => {
  const totals = historyShareSummaryTotals([
    entry({ type: 'charge', date: '2026-09-05', amountCents: null, ref: 'BILL-1' }),
    entry({ type: 'charge', date: '2026-09-05', amountCents: true, ref: 'BILL-2' }),
    entry({ type: 'payment', date: '2026-09-06', amountCents: '', ref: 'PAY-1' }),
    entry({ type: 'payment', date: '2026-09-06', amountCents: 'abc', ref: 'PAY-2' }),
    entry({ type: 'charge', date: '2026-09-05', amountCents: 0, ref: 'BILL-3' }),
  ]);
  assert.deepEqual(totals, { billedCents: 0, paidCents: 0, stillOwedCents: 0 });
});

test('Plan 424: an unknown type moves nothing in the totals', () => {
  const totals = historyShareSummaryTotals([
    entry({ type: 'charge', date: '2026-09-05', amountCents: 100000, ref: 'BILL-1' }),
    entry({ type: 'mystery', date: '2026-09-06', amountCents: 50000, ref: 'X-1' }),
  ]);
  assert.equal(totals.billedCents, 100000);
  assert.equal(totals.paidCents, 0);
  assert.equal(totals.stillOwedCents, 100000);
});

test('Plan 424: totals of no entries are all zero', () => {
  assert.deepEqual(historyShareSummaryTotals([]), { billedCents: 0, paidCents: 0, stillOwedCents: 0 });
  assert.deepEqual(historyShareSummaryTotals(), { billedCents: 0, paidCents: 0, stillOwedCents: 0 });
});

// --- Agreement with the on-screen history ---

test('Plan 424: still owed equals the running balance after the last on-screen entry', () => {
  const bills = [
    bill({ id: 'BILL-SEP', month: '2026-09', dueDate: '2026-09-05', dueAmount: 1000, payments: [payment({ id: 'PAY-1', amount: 1000, date: '2026-09-06' })] }),
    bill({ id: 'BILL-OCT', month: '2026-10', dueDate: '2026-10-05', dueAmount: 2000, payments: [payment({ id: 'PAY-2', amount: 1500, date: '2026-10-06', method: 'JazzCash' })] }),
    bill({ id: 'BILL-NOV', month: '2026-11', dueDate: '2026-11-05', dueAmount: 3000, payments: [payment({ id: 'PAY-3', amount: 1000, date: '2026-11-07' })] }),
  ];
  const entries = fullHistoryEntries({ customerId: 'CUST-1', bills, creditEntries: [], refundRecords: [] });
  assert.equal(entries.length, 6);
  const totals = historyShareSummaryTotals(entries);
  assert.equal(totals.billedCents, 600000);
  assert.equal(totals.paidCents, 350000);
  assert.equal(totals.stillOwedCents, 250000);
  assert.equal(totals.stillOwedCents, entries[entries.length - 1].runningBalanceCents);
  const text = historyShareSummaryText({ customerName: 'Customer One', entries });
  assert.ok(text.includes('Billed: PKR 6,000'), 'billed matches the list');
  assert.ok(text.includes('Paid: PKR 3,500'), 'paid matches the list');
  assert.ok(text.includes('Still owed: PKR 2,500'), 'still owed matches the list');
});

test('Plan 424: every last-five line matches the on-screen entry line on the same fixture', () => {
  const bills = [
    bill({ id: 'BILL-SEP', month: '2026-09', dueDate: '2026-09-05', dueAmount: 1000, payments: [payment({ id: 'PAY-1', amount: 1000, date: '2026-09-06' })] }),
    bill({ id: 'BILL-OCT', month: '2026-10', dueDate: '2026-10-05', dueAmount: 2000, payments: [payment({ id: 'PAY-2', amount: 1500, date: '2026-10-06', method: 'JazzCash' })] }),
    bill({ id: 'BILL-NOV', month: '2026-11', dueDate: '2026-11-05', dueAmount: 3000, payments: [payment({ id: 'PAY-3', amount: 1000, date: '2026-11-07' })] }),
  ];
  const entries = fullHistoryEntries({ customerId: 'CUST-1', bills, creditEntries: [], refundRecords: [] });
  const lastFive = historyShareSummaryLastFive(entries);
  assert.equal(lastFive.length, 5);
  for (const row of lastFive) {
    assert.equal(historyShareSummaryEntryLineText(row), fullHistoryEntryLineText(row));
  }
});

test('Plan 424: a refund returns money, so what is still owed goes up by the refund', () => {
  const bills = [
    bill({ id: 'BILL-1', month: '2026-11', dueDate: '2026-11-05', dueAmount: 3000, payments: [payment({ id: 'PAY-1', amount: 3000, date: '2026-11-06' })] }),
  ];
  const refunds = [{
    id: 'RF-1', customerId: 'CUST-1', amountCents: 50000, reason: 'Overcharge', method: 'Cash', refundDate: '2026-11-07',
  }];
  const entries = fullHistoryEntries({ customerId: 'CUST-1', bills, creditEntries: [], refundRecords: refunds });
  const totals = historyShareSummaryTotals(entries);
  assert.equal(totals.billedCents, 350000);
  assert.equal(totals.paidCents, 300000);
  assert.equal(totals.stillOwedCents, 50000);
  assert.equal(totals.stillOwedCents, entries[entries.length - 1].runningBalanceCents);
});

// --- Period ---

test('Plan 424: period runs from the first dated entry to the last dated entry', () => {
  const period = historyShareSummaryPeriod([
    entry({ type: 'charge', date: '2026-09-05', ref: 'BILL-1' }),
    entry({ type: 'payment', date: '2026-11-07', ref: 'PAY-1' }),
    entry({ type: 'charge', date: '2026-10-05', ref: 'BILL-2' }),
  ]);
  assert.deepEqual(period, { from: '2026-09-05', to: '2026-11-07' });
});

test('Plan 424: a month-only date counts as the first of that month and is shown as recorded', () => {
  const period = historyShareSummaryPeriod([
    entry({ type: 'charge', date: '2026-09', ref: 'BILL-1' }),
    entry({ type: 'payment', date: '2026-11-07', ref: 'PAY-1' }),
  ]);
  assert.deepEqual(period, { from: '2026-09', to: '2026-11-07' });
});

test('Plan 424: undated entries never define the period', () => {
  const period = historyShareSummaryPeriod([
    entry({ type: 'charge', date: '', ref: 'BILL-1' }),
    entry({ type: 'payment', date: '2026-11-07', ref: 'PAY-1' }),
    entry({ type: 'charge', date: '', ref: 'BILL-2' }),
  ]);
  assert.deepEqual(period, { from: '2026-11-07', to: '2026-11-07' });
});

test('Plan 424: no dated entry means no period, never a guessed date', () => {
  assert.deepEqual(historyShareSummaryPeriod([entry({ date: '' })]), { from: '', to: '' });
  assert.deepEqual(historyShareSummaryPeriod([]), { from: '', to: '' });
});

test('Plan 424: a single dated entry names that one date as the whole period', () => {
  const text = historyShareSummaryText({
    customerName: 'Customer One',
    entries: [entry({ type: 'charge', date: '2026-09-05', amountCents: 100000, runningBalanceCents: 100000, ref: 'BILL-1' })],
  });
  assert.ok(text.includes('Period: 2026-09-05\n'), 'one date, no range');
  assert.ok(!text.includes(' to 2026-09-05'), 'no range when from equals to');
});

// --- Last five ---

test('Plan 424: the last five are the five latest entries, in order', () => {
  const rows = [];
  for (let day = 1; day <= 7; day += 1) {
    rows.push(entry({ date: `2026-11-0${day}`, ref: `PAY-${day}` }));
  }
  const lastFive = historyShareSummaryLastFive(rows);
  assert.equal(lastFive.length, 5);
  assert.deepEqual(lastFive.map((row) => row.ref), ['PAY-3', 'PAY-4', 'PAY-5', 'PAY-6', 'PAY-7']);
});

test('Plan 424: fewer than five entries means all of them, in order', () => {
  const rows = [
    entry({ date: '2026-11-05', ref: 'PAY-1' }),
    entry({ date: '2026-11-06', ref: 'PAY-2' }),
    entry({ date: '2026-11-07', ref: 'PAY-3' }),
  ];
  assert.deepEqual(historyShareSummaryLastFive(rows).map((row) => row.ref), ['PAY-1', 'PAY-2', 'PAY-3']);
  assert.deepEqual(historyShareSummaryLastFive([]), []);
});

test('Plan 424: the last-five count is five', () => {
  assert.equal(HISTORY_SHARE_SUMMARY_LAST_FIVE_COUNT, 5);
});

// --- Full text ---

test('Plan 424: the summary text names the customer, period, totals and last five exactly', () => {
  const entries = [
    entry({ type: 'charge', date: '2026-09-05', amountCents: 100000, runningBalanceCents: 100000, ref: 'BILL-SEP' }),
    entry({ type: 'payment', date: '2026-09-06', amountCents: 100000, runningBalanceCents: 0, ref: 'PAY-1' }),
    entry({ type: 'charge', date: '2026-10-05', amountCents: 200000, runningBalanceCents: 200000, ref: 'BILL-OCT' }),
    entry({ type: 'payment', date: '2026-10-06', amountCents: 150000, runningBalanceCents: 50000, method: 'JazzCash', ref: 'PAY-2' }),
    entry({ type: 'charge', date: '2026-11-05', amountCents: 300000, runningBalanceCents: 350000, ref: 'BILL-NOV' }),
    entry({ type: 'payment', date: '2026-11-07', amountCents: 100000, runningBalanceCents: 250000, ref: 'PAY-3' }),
  ];
  const text = historyShareSummaryText({ customerName: 'Customer One', entries });
  assert.equal(text, [
    'History — Customer One',
    'Period: 2026-09-05 to 2026-11-07',
    'Billed: PKR 6,000',
    'Paid: PKR 3,500',
    'Still owed: PKR 2,500',
    'Last 5 transactions:',
    '2026-09-06 · Payment · PKR 1,000 · Settled',
    '2026-10-05 · Charge · PKR 2,000 · Still owed PKR 2,000',
    '2026-10-06 · Payment · PKR 1,500 · Still owed PKR 500',
    '2026-11-05 · Charge · PKR 3,000 · Still owed PKR 3,500',
    '2026-11-07 · Payment · PKR 1,000 · Still owed PKR 2,500',
  ].join('\n'));
});

test('Plan 424: five or fewer entries list every transaction under a plain heading', () => {
  const text = historyShareSummaryText({
    customerName: 'Customer One',
    entries: [
      entry({ type: 'charge', date: '2026-11-05', amountCents: 100000, runningBalanceCents: 100000, ref: 'BILL-1' }),
      entry({ type: 'payment', date: '2026-11-06', amountCents: 100000, runningBalanceCents: 0, ref: 'PAY-1' }),
    ],
  });
  assert.ok(text.includes('\nTransactions:\n'), 'plain heading when nothing is cut');
  assert.ok(!text.includes('Last 5 transactions:'), 'no last-five heading when nothing is cut');
  assert.ok(text.includes('2026-11-05 · Charge · PKR 1,000 · Still owed PKR 1,000'));
  assert.ok(text.includes('2026-11-06 · Payment · PKR 1,000 · Settled'));
});

test('Plan 424: a settled history says Settled, never a guessed figure', () => {
  const text = historyShareSummaryText({
    customerName: 'Customer One',
    entries: [
      entry({ type: 'charge', date: '2026-11-05', amountCents: 100000, runningBalanceCents: 100000, ref: 'BILL-1' }),
      entry({ type: 'payment', date: '2026-11-06', amountCents: 100000, runningBalanceCents: 0, ref: 'PAY-1' }),
    ],
  });
  assert.ok(text.includes('\nSettled\n'), 'settled line, no figure');
  assert.ok(!text.includes('Still owed:'), 'no still-owed line when settled');
});

test('Plan 424: an overpaid history shows a credit, never a negative still-owed figure', () => {
  const text = historyShareSummaryText({
    customerName: 'Customer One',
    entries: [
      entry({ type: 'charge', date: '2026-11-05', amountCents: 100000, runningBalanceCents: 100000, ref: 'BILL-1' }),
      entry({ type: 'payment', date: '2026-11-06', amountCents: 150000, runningBalanceCents: -50000, ref: 'PAY-1' }),
    ],
  });
  assert.ok(text.includes('Credit: PKR 500'), 'credit line');
  assert.ok(!text.includes('Still owed: PKR -500'), 'never a negative still-owed figure');
});

test('Plan 424: a paisa amount prints with one decimal, like the entry screen', () => {
  const text = historyShareSummaryText({
    customerName: 'Customer One',
    entries: [
      entry({ type: 'charge', date: '2026-11-05', amountCents: 150050, runningBalanceCents: 150050, ref: 'BILL-1' }),
    ],
  });
  assert.ok(text.includes('Billed: PKR 1,500.5'), 'min-0 decimals');
  assert.ok(text.includes('2026-11-05 · Charge · PKR 1,500.5 · Still owed PKR 1,500.5'));
});

test('Plan 424: a voided line is marked VOID in the last five', () => {
  const text = historyShareSummaryText({
    customerName: 'Customer One',
    entries: [
      entry({ type: 'charge', date: '2026-11-05', amountCents: 100000, runningBalanceCents: 100000, ref: 'BILL-1' }),
      entry({ type: 'payment', date: '2026-11-06', amountCents: 100000, runningBalanceCents: 100000, ref: 'PAY-1', voided: true }),
    ],
  });
  assert.ok(text.includes('2026-11-06 · Payment · VOID · PKR 1,000 · Still owed PKR 1,000'), 'voided line marked');
  assert.ok(text.includes('Paid: PKR 0'), 'voided payment counts for no paid total');
});

test('Plan 424: an undated line says date not recorded, never a guessed day', () => {
  const line = historyShareSummaryEntryLineText(entry({ date: '', amountCents: 100000, runningBalanceCents: 100000 }));
  assert.ok(line.startsWith('date not recorded · Payment · PKR 1,000 · Still owed PKR 1,000'));
});

test('Plan 424: an unknown type reads as Payment in the line, and moves nothing in the totals', () => {
  const line = historyShareSummaryEntryLineText(entry({ type: 'mystery', date: '2026-11-07' }));
  assert.ok(line.includes(' · Payment · '), 'unknown type falls back to Payment');
});

test('Plan 424: a missing name reads Customer, never a guessed name', () => {
  const text = historyShareSummaryText({
    entries: [entry({ type: 'charge', date: '2026-11-05', amountCents: 100000, runningBalanceCents: 100000, ref: 'BILL-1' })],
  });
  assert.ok(text.startsWith('History — Customer\n'), 'fallback name');
  const blank = historyShareSummaryText({
    customerName: '   ',
    entries: [entry({ type: 'charge', date: '2026-11-05', amountCents: 100000, runningBalanceCents: 100000, ref: 'BILL-1' })],
  });
  assert.ok(blank.startsWith('History — Customer\n'), 'blank name falls back too');
});

test('Plan 424: no dated entry names the period as not recorded', () => {
  const text = historyShareSummaryText({
    customerName: 'Customer One',
    entries: [entry({ type: 'charge', date: '', amountCents: 100000, runningBalanceCents: 100000, ref: 'BILL-1' })],
  });
  assert.ok(text.includes('Period: not recorded\n'), 'period never guessed');
});

test('Plan 424: an empty history has no summary text', () => {
  assert.equal(historyShareSummaryText({ customerName: 'Customer One', entries: [] }), '');
  assert.equal(historyShareSummaryText({}), '');
  assert.equal(historyShareSummaryText(), '');
  assert.equal(HISTORY_SHARE_SUMMARY_EMPTY_TEXT, 'No transactions yet');
});

// --- Button markup and draft HTML ---

test('Plan 424: the share button carries the hsx id and the export-button styling', () => {
  const markup = historyShareSummaryButtonMarkup();
  assert.ok(markup.includes('id="hsxHistoryShareSummary"'), 'button id');
  assert.ok(markup.includes('class="secondary-button export-button"'), 'button styling');
  assert.ok(markup.includes(HISTORY_SHARE_SUMMARY_BUTTON_TEXT), 'button text');
  assert.ok(markup.includes('id="hsxHistoryShareSummaryResult"'), 'result area');
});

test('Plan 424: the draft shows the text escaped, with a send button', () => {
  const html = historyShareSummaryDraftHtml('History — Customer One\nBilled: PKR 1,000 <script>');
  assert.ok(html.includes('<pre class="hsx-share-summary-text">'), 'draft pre');
  assert.ok(html.includes('&lt;script&gt;'), 'text escaped');
  assert.ok(!html.includes('<script>'), 'no raw script tag');
  assert.ok(html.includes('id="hsxHistoryShareSummarySend"'), 'send button id');
  assert.ok(html.includes(HISTORY_SHARE_SUMMARY_SEND_TEXT), 'send button text');
  assert.equal(historyShareSummaryDraftHtml(''), '');
});

test('Plan 424: the no-number and do-not-message texts are plain words', () => {
  assert.equal(HISTORY_SHARE_SUMMARY_NO_NUMBER_TEXT, 'No WhatsApp number');
  assert.equal(HISTORY_SHARE_SUMMARY_DO_NOT_MESSAGE_TEXT, 'Do not message');
});

// --- Purity: the module drafts only — no clock, storage, page, or network ---

test('module is pure: no clock, storage, page, network, or imports', () => {
  const source = readFileSync(new URL('../history-share-summary.js', import.meta.url), 'utf8');
  assert.ok(!source.includes('new Date('), 'no new Date(');
  assert.ok(!source.includes('Date.now('), 'no Date.now(');
  assert.ok(!source.includes('localStorage'), 'no localStorage');
  assert.ok(!source.includes('document'), 'no document');
  assert.ok(!source.includes('fetch('), 'no fetch(');
  assert.ok(!source.includes('window.'), 'no window.');
  assert.ok(!source.includes('import '), 'no imports');
  assert.ok(!source.includes('shahdara_'), 'no store key: the summary is derived, not stored');
});

test('module header names no fenced module file literally', () => {
  const source = readFileSync(new URL('../history-share-summary.js', import.meta.url), 'utf8');
  const fenced = [
    'full' + '-history-list',
    'history' + '-type-filter',
    'history' + '-date-range-filter',
    'history' + '-method-filter',
    'history' + '-amount-search',
    'history' + '-running-balance',
    'history' + '-monthly-grouping',
    'history' + '-yearly-summary',
    'history' + '-csv-export',
    'history' + '-printed-statement',
    'history' + '-gap-view',
    'history' + '-largest-payment',
    'history' + '-first-dates',
    'history' + '-disputed-flag',
    'history' + '-refunds-inline',
    'history' + '-credit-inline',
    'history' + '-adjustments-inline',
    'history' + '-month-comparison',
    'history' + '-connection-filter',
    'history' + '-entry-annotation',
    'history' + '-struck-through',
    'history' + '-jump-to-bill',
    'history' + '-jump-to-receipt',
    'statement' + '-draft',
    'receipt' + '-number-search',
  ].map((name) => `${name}.js`);
  for (const name of fenced) {
    assert.ok(!source.includes(name), `header must not name ${name}`);
  }
});

// --- Wiring in app.js and the host in index.html ---

test('wiring: app.js imports the share module and wires it from the history render', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './history-share-summary.js'"), 'imports the module');
  assert.ok(app.includes('historyShareSummaryText'), 'builds the summary text');
  assert.ok(app.includes('historyShareSummaryButtonMarkup'), 'renders the share button');
  assert.ok(app.includes('historyShareSummaryDraftHtml'), 'shows the draft before sending');
  assert.ok(app.includes('hsxHistoryShareSummaryHost'), 'share host id');
  assert.ok(app.includes('hsxHistoryShareSummaryResult'), 'draft result id');
  assert.ok(app.includes('hsxHistoryShareSummarySend'), 'send button id');
  assert.ok(app.includes('formatWhatsAppUrl'), 'opens WhatsApp with the text prefilled');
  assert.ok(app.includes('whatsappPhoneFor(customer)'), 'sends to the customer number');
  assert.ok(app.includes('HISTORY_SHARE_SUMMARY_NO_NUMBER_TEXT'), 'says plainly when there is no number');
  assert.ok(app.includes('HISTORY_SHARE_SUMMARY_DO_NOT_MESSAGE_TEXT'), 'respects do-not-message');
});

test('wiring: index.html carries the share host beside the CSV export and printed statement', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const csvAt = html.indexOf('hxeHistoryCsvExportHost');
  const printAt = html.indexOf('hpsHistoryPrintedStatementHost');
  const shareAt = html.indexOf('hsxHistoryShareSummaryHost');
  assert.ok(csvAt !== -1 && printAt !== -1 && shareAt !== -1, 'all three hosts exist');
  assert.ok(shareAt > printAt, 'share host sits beside the printed statement host');
});

test('wiring: the share drafts only — no record is written from the button', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const start = app.indexOf('// Plan 424');
  const end = app.indexOf('// Plan 411', start);
  assert.ok(start !== -1 && end !== -1 && end > start, 'Plan 424 wiring block found');
  const block = app.slice(start, end);
  assert.ok(block.includes("toast('No transactions to share.')"), 'plain empty-history message');
  assert.ok(block.includes('window.open(wa.url'), 'sending opens WhatsApp, nothing is sent by the app');
  for (const forbidden of ['addPayment', 'correctPayment', 'updateCustomer', 'saveHistory', 'recordHistory', 'removeHistory', 'localStorage', 'saveStatement', 'logStatementSent', 'fetch(']) {
    assert.ok(!block.includes(forbidden), `share wiring must not contain ${forbidden}`);
  }
});

test('wiring: the summary is drawn from the full entries, never the filtered shown rows', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const start = app.indexOf('// Plan 424');
  const end = app.indexOf('// Plan 411', start);
  assert.ok(start !== -1 && end !== -1 && end > start, 'Plan 424 wiring block found');
  const block = app.slice(start, end);
  assert.ok(block.includes('historyShareSummaryText({ customerName: customer.name || customer.customerName, entries })'), 'whole-history entries');
  assert.ok(!block.includes('historyShareSummaryText({ customerName: customer.name || customer.customerName, entries: shown })'), 'never the shown rows');
});
