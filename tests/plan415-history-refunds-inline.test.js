// Plan 415 — History refund entries shown inline: refunds live
// in their own record, so the history shows money going out
// without gathering the money that came back, and the customer's
// net position is unclear. One inline display of refund entries
// within the customer history — refund lines in date order, with
// reason, and the running balance before and after each refund
// shown visibly; it displays only and records no refund.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HISTORY_REFUNDS_INLINE_EMPTY_TEXT,
  HISTORY_REFUNDS_INLINE_NO_REFUNDS_TEXT,
  HISTORY_REFUNDS_INLINE_REASON_NOT_RECORDED_TEXT,
  HISTORY_REFUNDS_INLINE_DATE_NOT_RECORDED_TEXT,
  HISTORY_REFUNDS_INLINE_BALANCE_NOT_RECORDED_TEXT,
  historyRefundsInlineIsRefund,
  historyRefundsInlineDelta,
  historyRefundsInlineEntries,
  historyRefundsInlineTotalCents,
  formatRefundsInlineAmount,
  historyRefundsInlineBalanceNote,
  historyRefundsInlineLineText,
  historyRefundsInlineSummaryText,
  historyRefundsInlineHtml,
} from '../history-refunds-inline.js';
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

function refundEntry(overrides = {}) {
  return entry({
    type: 'refund',
    date: '2026-10-10',
    month: '2026-10',
    amountCents: 50000,
    runningBalanceCents: 100000,
    note: 'overpayment',
    method: 'Cash',
    ref: 'RF-1',
    ...overrides,
  });
}

// September settled, October part-paid then refunded, November
// charged then refunded, November settled: two refunds, in date
// order, with the running balance after each one reflecting it.
function historyWithRefunds() {
  return [
    entry({ type: 'charge', date: '2026-09-01', month: '2026-09', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2026-09' }),
    entry({ date: '2026-09-05', month: '2026-09', amountCents: 200000, runningBalanceCents: 0, ref: 'RCPT-1' }),
    entry({ type: 'charge', date: '2026-10-01', month: '2026-10', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2026-10' }),
    entry({ date: '2026-10-03', month: '2026-10', amountCents: 150000, runningBalanceCents: 50000, ref: 'RCPT-2' }),
    refundEntry(),
    entry({ type: 'charge', date: '2026-11-01', month: '2026-11', amountCents: 200000, runningBalanceCents: 300000, method: '', ref: 'BILL-2026-11' }),
    refundEntry({ date: '2026-11-07', month: '2026-11', amountCents: 100000, runningBalanceCents: 400000, note: 'customer left', method: 'JazzCash', ref: 'RF-2' }),
    entry({ date: '2026-11-12', month: '2026-11', amountCents: 400000, runningBalanceCents: 0, method: 'JazzCash', ref: 'RCPT-3' }),
  ];
}

function bill(overrides = {}) {
  return {
    id: 'BILL-2026-09',
    month: '2026-09',
    dueDate: '2026-09-01',
    dueAmount: 2000,
    payments: [],
    ...overrides,
  };
}

function payment(overrides = {}) {
  return {
    id: 'PAY-1',
    date: '2026-09-05',
    amount: 2000,
    method: 'Cash',
    note: '',
    ...overrides,
  };
}

function refundRecord(overrides = {}) {
  return {
    id: 'RF-1',
    customerId: 'CUST-1',
    sourceKind: 'overpayment',
    sourceId: 'PAY-2',
    sourceAmountCents: 150000,
    amountCents: 50000,
    reason: 'overpayment',
    method: 'Cash',
    refundDate: '2026-10-10',
    ...overrides,
  };
}

// --- Is refund ---

test('isRefund: a refund entry with a positive amount is a refund', () => {
  assert.equal(historyRefundsInlineIsRefund(refundEntry()), true);
  assert.equal(historyRefundsInlineIsRefund(refundEntry({ amountCents: '50000' })), true);
});

test('isRefund: payments, charges, credits and adjustments are not refunds', () => {
  assert.equal(historyRefundsInlineIsRefund(entry()), false);
  assert.equal(historyRefundsInlineIsRefund(entry({ type: 'charge' })), false);
  assert.equal(historyRefundsInlineIsRefund(entry({ type: 'credit', source: 'adjustment' })), false);
  assert.equal(historyRefundsInlineIsRefund(entry({ type: 'adjustment' })), false);
  assert.equal(historyRefundsInlineIsRefund(entry({ type: 'advance' })), false);
});

test('isRefund: a refund with no usable amount is not a refund line, never zero-filled', () => {
  assert.equal(historyRefundsInlineIsRefund(refundEntry({ amountCents: null })), false);
  assert.equal(historyRefundsInlineIsRefund(refundEntry({ amountCents: undefined })), false);
  assert.equal(historyRefundsInlineIsRefund(refundEntry({ amountCents: true })), false);
  assert.equal(historyRefundsInlineIsRefund(refundEntry({ amountCents: '' })), false);
  assert.equal(historyRefundsInlineIsRefund(refundEntry({ amountCents: 0 })), false);
  assert.equal(historyRefundsInlineIsRefund(refundEntry({ amountCents: -50000 })), false);
  assert.equal(historyRefundsInlineIsRefund(refundEntry({ amountCents: 'abc' })), false);
  assert.equal(historyRefundsInlineIsRefund(null), false);
  assert.equal(historyRefundsInlineIsRefund('refund'), false);
});

// --- Delta ---

test('delta: a refund adds to what is owed, a voided refund moves nothing', () => {
  assert.equal(historyRefundsInlineDelta(refundEntry()), 50000);
  assert.equal(historyRefundsInlineDelta(refundEntry({ voided: true })), 0);
  assert.equal(historyRefundsInlineDelta(entry()), 0);
  assert.equal(historyRefundsInlineDelta(entry({ type: 'charge' })), 0);
  assert.equal(historyRefundsInlineDelta(refundEntry({ amountCents: null })), 0);
  assert.equal(historyRefundsInlineDelta(null), 0);
});

// --- Entries ---

test('entries: refund lines come out in the order given, with reason and balances', () => {
  const refunds = historyRefundsInlineEntries(historyWithRefunds());
  assert.equal(refunds.length, 2);
  assert.equal(refunds[0].date, '2026-10-10');
  assert.equal(refunds[0].reason, 'overpayment');
  assert.equal(refunds[0].method, 'Cash');
  assert.equal(refunds[0].amountCents, 50000);
  assert.equal(refunds[0].balanceBeforeCents, 50000);
  assert.equal(refunds[0].balanceAfterCents, 100000);
  assert.equal(refunds[0].voided, false);
  assert.equal(refunds[1].date, '2026-11-07');
  assert.equal(refunds[1].reason, 'customer left');
  assert.equal(refunds[1].method, 'JazzCash');
  assert.equal(refunds[1].amountCents, 100000);
  assert.equal(refunds[1].balanceBeforeCents, 300000);
  assert.equal(refunds[1].balanceAfterCents, 400000);
});

test('entries: a list with no refunds gives no lines', () => {
  const entries = historyWithRefunds().filter((item) => item.type !== 'refund');
  assert.deepEqual(historyRefundsInlineEntries(entries), []);
  assert.deepEqual(historyRefundsInlineEntries([]), []);
  assert.deepEqual(historyRefundsInlineEntries(null), []);
  assert.deepEqual(historyRefundsInlineEntries('nope'), []);
});

test('entries: a voided refund is listed, marked voided, and moves nothing', () => {
  const refunds = historyRefundsInlineEntries([
    refundEntry({ voided: true, runningBalanceCents: 50000 }),
  ]);
  assert.equal(refunds.length, 1);
  assert.equal(refunds[0].voided, true);
  assert.equal(refunds[0].balanceBeforeCents, 50000);
  assert.equal(refunds[0].balanceAfterCents, 50000);
});

test('entries: a refund with no running balance carries no balance, never a guessed one', () => {
  const refunds = historyRefundsInlineEntries([
    refundEntry({ runningBalanceCents: undefined }),
  ]);
  assert.equal(refunds.length, 1);
  assert.equal(refunds[0].balanceBeforeCents, null);
  assert.equal(refunds[0].balanceAfterCents, null);
});

test('entries: the input entries are never mutated', () => {
  const entries = historyWithRefunds();
  const before = JSON.stringify(entries);
  historyRefundsInlineEntries(entries);
  assert.equal(JSON.stringify(entries), before);
});

// --- Totals ---

test('total: refunds sum, voided refunds never count', () => {
  const refunds = historyRefundsInlineEntries(historyWithRefunds());
  assert.equal(historyRefundsInlineTotalCents(refunds), 150000);
  const withVoided = historyRefundsInlineEntries([
    refundEntry(),
    refundEntry({ date: '2026-11-07', amountCents: 100000, ref: 'RF-2', voided: true }),
  ]);
  assert.equal(historyRefundsInlineTotalCents(withVoided), 50000);
  assert.equal(historyRefundsInlineTotalCents([]), 0);
  assert.equal(historyRefundsInlineTotalCents(null), 0);
});

// --- Amounts and balance notes ---

test('amount: whole rupees print plain, paisa prints one decimal, bad input prints zero', () => {
  assert.equal(formatRefundsInlineAmount(150000), 'PKR 1,500');
  assert.equal(formatRefundsInlineAmount(150050), 'PKR 1,500.5');
  assert.equal(formatRefundsInlineAmount(0), 'PKR 0');
  assert.equal(formatRefundsInlineAmount(-5000), '-PKR 50');
  assert.equal(formatRefundsInlineAmount(null), 'PKR 0');
  assert.equal(formatRefundsInlineAmount(true), 'PKR 0');
  assert.equal(formatRefundsInlineAmount(''), 'PKR 0');
});

test('balance note: settled, still owed, credit and not recorded', () => {
  assert.equal(historyRefundsInlineBalanceNote(0), 'Settled');
  assert.equal(historyRefundsInlineBalanceNote(100000), 'Still owed PKR 1,000');
  assert.equal(historyRefundsInlineBalanceNote(-50000), 'Credit PKR 500');
  assert.equal(historyRefundsInlineBalanceNote(null), HISTORY_REFUNDS_INLINE_BALANCE_NOT_RECORDED_TEXT);
  assert.equal(historyRefundsInlineBalanceNote(undefined), HISTORY_REFUNDS_INLINE_BALANCE_NOT_RECORDED_TEXT);
});

// --- Line text ---

test('line text: date, amount, reason and balance after, in plain words', () => {
  const refunds = historyRefundsInlineEntries(historyWithRefunds());
  assert.equal(
    historyRefundsInlineLineText(refunds[0]),
    '2026-10-10 · Refund PKR 500 · overpayment · Balance after Still owed PKR 1,000',
  );
  assert.equal(
    historyRefundsInlineLineText(refunds[1]),
    '2026-11-07 · Refund PKR 1,000 · customer left · Balance after Still owed PKR 4,000',
  );
});

test('line text: voided, dateless and reasonless lines say so plainly', () => {
  const refunds = historyRefundsInlineEntries([
    refundEntry({ voided: true }),
    refundEntry({ date: '', note: '', ref: 'RF-9' }),
  ]);
  assert.match(historyRefundsInlineLineText(refunds[0]), /VOID/);
  assert.equal(
    historyRefundsInlineLineText(refunds[1]),
    `${HISTORY_REFUNDS_INLINE_DATE_NOT_RECORDED_TEXT} · Refund PKR 500 · ${HISTORY_REFUNDS_INLINE_REASON_NOT_RECORDED_TEXT} · Balance after Still owed PKR 1,000`,
  );
  assert.equal(historyRefundsInlineLineText(null), '');
  assert.equal(historyRefundsInlineLineText('nope'), '');
});

// --- Summary text ---

test('summary: empty shown reads empty, shown with no refunds reads no refunds', () => {
  assert.equal(historyRefundsInlineSummaryText([], []), HISTORY_REFUNDS_INLINE_EMPTY_TEXT);
  assert.equal(historyRefundsInlineSummaryText(null, null), HISTORY_REFUNDS_INLINE_EMPTY_TEXT);
  const noRefunds = historyWithRefunds().filter((item) => item.type !== 'refund');
  assert.equal(historyRefundsInlineSummaryText(noRefunds, noRefunds), HISTORY_REFUNDS_INLINE_NO_REFUNDS_TEXT);
});

test('summary: refunds count, total returned and final balance in plain words', () => {
  const entries = historyWithRefunds();
  assert.equal(
    historyRefundsInlineSummaryText(entries, entries),
    '2 refunds · PKR 1,500 returned · Balance Still owed PKR 4,000',
  );
  const one = [refundEntry()];
  assert.equal(
    historyRefundsInlineSummaryText(one, one),
    '1 refund · PKR 500 returned · Balance Still owed PKR 1,000',
  );
});

test('summary: a filtered view names the full-history refunds too', () => {
  const entries = historyWithRefunds();
  const shown = entries.filter((item) => item.date !== '2026-11-07');
  assert.equal(
    historyRefundsInlineSummaryText(shown, entries),
    '1 refund · PKR 500 returned · Balance Still owed PKR 1,000 · Full history: 2 refunds · PKR 1,500 returned',
  );
});

// --- HTML ---

test('html: an empty shown list renders nothing', () => {
  assert.equal(historyRefundsInlineHtml([], []), '');
  assert.equal(historyRefundsInlineHtml(null, null), '');
});

test('html: a shown list with no refunds says so plainly', () => {
  const noRefunds = historyWithRefunds().filter((item) => item.type !== 'refund');
  assert.equal(
    historyRefundsInlineHtml(noRefunds, noRefunds),
    `<p class="notice">${HISTORY_REFUNDS_INLINE_NO_REFUNDS_TEXT}</p>`,
  );
});

test('html: refund rows carry date, reason, amount and both balances', () => {
  const html = historyRefundsInlineHtml(historyWithRefunds(), historyWithRefunds());
  assert.match(html, /statement-table/);
  assert.match(html, /2026-10-10/);
  assert.match(html, /overpayment/);
  assert.match(html, /2026-11-07/);
  assert.match(html, /customer left/);
  assert.match(html, /PKR 500/);
  assert.match(html, /PKR 1,000/);
  assert.match(html, /PKR 4,000/);
  assert.match(html, /Totals · 2 refunds/);
  assert.match(html, /PKR 1,500/);
  assert.doesNotMatch(html, /Full history/);
});

test('html: a filtered view totals only what it shows and names the full history too', () => {
  const entries = historyWithRefunds();
  const shown = entries.filter((item) => item.date !== '2026-11-07');
  const html = historyRefundsInlineHtml(shown, entries);
  assert.match(html, /Totals · 1 refund/);
  assert.match(html, /PKR 500/);
  assert.match(html, /Full history · 2 refunds/);
  assert.match(html, /PKR 1,500/);
  assert.doesNotMatch(html, /customer left/);
});

test('html: a voided refund is marked VOID and its amount stays out of the total', () => {
  const html = historyRefundsInlineHtml([
    refundEntry(),
    refundEntry({ date: '2026-11-07', amountCents: 100000, runningBalanceCents: 100000, note: 'customer left', ref: 'RF-2', voided: true }),
  ], null);
  assert.match(html, /VOID/);
  assert.match(html, /Totals · 2 refunds/);
  assert.match(html, /PKR 500/);
  assert.doesNotMatch(html, /PKR 1,500/);
});

test('html: user-entered reason text is escaped, never raw HTML', () => {
  const html = historyRefundsInlineHtml([
    refundEntry({ note: '<script>alert(1)</script>' }),
  ], null);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test('html: a refund with no date and no reason says so plainly', () => {
  const html = historyRefundsInlineHtml([
    refundEntry({ date: '', note: '' }),
  ], null);
  assert.match(html, new RegExp(HISTORY_REFUNDS_INLINE_DATE_NOT_RECORDED_TEXT));
  assert.match(html, new RegExp(HISTORY_REFUNDS_INLINE_REASON_NOT_RECORDED_TEXT));
});

// --- Acceptance: from the records the full history list composes ---

test('acceptance: every refund appears in date order and the balance after it reflects it', () => {
  const bills = [
    bill({ payments: [payment()] }),
    bill({
      id: 'BILL-2026-10', month: '2026-10', dueDate: '2026-10-01',
      payments: [payment({ id: 'PAY-2', date: '2026-10-03', amount: 1500 })],
    }),
    bill({
      id: 'BILL-2026-11', month: '2026-11', dueDate: '2026-11-01',
      payments: [payment({ id: 'PAY-3', date: '2026-11-12', amount: 4000, method: 'JazzCash' })],
    }),
  ];
  const refundRecords = [
    refundRecord(),
    refundRecord({
      id: 'RF-2', sourceId: 'PAY-3', sourceAmountCents: 400000, amountCents: 100000,
      reason: 'customer left', method: 'JazzCash', refundDate: '2026-11-07',
    }),
  ];
  const entries = fullHistoryEntries({
    customerId: 'CUST-1', bills, creditEntries: [], refundRecords,
  });
  const refunds = historyRefundsInlineEntries(entries);
  assert.equal(refunds.length, 2);
  assert.equal(refunds[0].date, '2026-10-10');
  assert.equal(refunds[0].amountCents, 50000);
  assert.equal(refunds[0].balanceBeforeCents, 50000);
  assert.equal(refunds[0].balanceAfterCents, 100000);
  assert.equal(refunds[1].date, '2026-11-07');
  assert.equal(refunds[1].amountCents, 100000);
  assert.equal(refunds[1].balanceBeforeCents, 300000);
  assert.equal(refunds[1].balanceAfterCents, 400000);
  assert.equal(historyRefundsInlineTotalCents(refunds), 150000);
});

test('acceptance: refunds for another customer never appear', () => {
  const entries = fullHistoryEntries({
    customerId: 'CUST-1', bills: [], creditEntries: [],
    refundRecords: [refundRecord({ customerId: 'CUST-2' })],
  });
  assert.deepEqual(historyRefundsInlineEntries(entries), []);
  // No entries at all for this customer, so the display renders
  // nothing — the "No refunds" notice is for a shown history
  // that holds transactions but no refund.
  assert.equal(historyRefundsInlineHtml(entries, entries), '');
  const ownEntries = fullHistoryEntries({
    customerId: 'CUST-1',
    bills: [bill({ payments: [payment()] })],
    creditEntries: [],
    refundRecords: [refundRecord({ customerId: 'CUST-2' })],
  });
  assert.equal(
    historyRefundsInlineHtml(ownEntries, ownEntries),
    `<p class="notice">${HISTORY_REFUNDS_INLINE_NO_REFUNDS_TEXT}</p>`,
  );
});

test('acceptance: a customer with one refund shows that one', () => {
  const entries = fullHistoryEntries({
    customerId: 'CUST-1',
    bills: [bill({ payments: [payment()] })],
    creditEntries: [],
    refundRecords: [refundRecord()],
  });
  const refunds = historyRefundsInlineEntries(entries);
  assert.equal(refunds.length, 1);
  assert.equal(refunds[0].date, '2026-10-10');
  assert.equal(refunds[0].amountCents, 50000);
});

test('acceptance: the display never changes any bill, payment, refund or customer record', () => {
  const bills = [bill({ payments: [payment()] })];
  const refundRecords = [refundRecord()];
  const billsBefore = JSON.stringify(bills);
  const refundsBefore = JSON.stringify(refundRecords);
  const entries = fullHistoryEntries({
    customerId: 'CUST-1', bills, creditEntries: [], refundRecords,
  });
  const entriesBefore = JSON.stringify(entries);
  historyRefundsInlineHtml(entries, entries);
  historyRefundsInlineSummaryText(entries, entries);
  assert.equal(JSON.stringify(bills), billsBefore);
  assert.equal(JSON.stringify(refundRecords), refundsBefore);
  assert.equal(JSON.stringify(entries), entriesBefore);
});

// --- Fences ---

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
  assert.doesNotMatch(listSource, /historyRefundsInline/);
});

test('fence: the refund record still exports its builders and is untouched by this plan', () => {
  const refundName = 'refund-' + 'records.js';
  const refundSource = readFileSync(new URL(`../${refundName}`, import.meta.url), 'utf8');
  assert.match(refundSource, /export function normalizeRefund/);
  assert.match(refundSource, /export function refundsForCustomer/);
  assert.match(refundSource, /export function upsertRefund/);
  assert.doesNotMatch(refundSource, /historyRefundsInline/);
});

test('fence: no fenced history view carries any refund-inline reference', () => {
  const fenced = [
    'history-' + 'type-filter.js',
    'history-' + 'date-range-filter.js',
    'history-' + 'method-filter.js',
    'history-' + 'amount-search.js',
    'history-' + 'running-balance.js',
    'history-' + 'monthly-grouping.js',
    'history-' + 'yearly-summary.js',
    'history-' + 'csv-export.js',
    'history-' + 'printed-statement.js',
    'history-' + 'gap-view.js',
    'history-' + 'largest-payment.js',
    'history-' + 'first-dates.js',
    'history-' + 'disputed-flag.js',
    'balance-' + 'rollforward.js',
  ];
  for (const name of fenced) {
    const source = readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /historyRefundsInline/, `${name} must not reference this plan`);
  }
});

test('header: the module header never names a fenced module literally', () => {
  const source = readFileSync(new URL('../history-refunds-inline.js', import.meta.url), 'utf8');
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
    'history-' + 'csv-export.js',
    'history-' + 'printed-statement.js',
    'history-' + 'gap-view.js',
    'history-' + 'largest-payment.js',
    'history-' + 'first-dates.js',
    'history-' + 'disputed-flag.js',
    'balance-' + 'rollforward.js',
    'refund-' + 'records.js',
  ]) {
    assert.doesNotMatch(header, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `header must not name ${name}`);
  }
});

// --- Wiring ---

test('wiring: the app renders the refund display from the shown rows', () => {
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(appSource, /import \{ historyRefundsInlineHtml \} from '\.\/history-refunds-inline\.js';/);
  assert.match(appSource, /\$\('#hriHistoryRefundsInline'\)/);
  assert.match(appSource, /historyRefundsInlineHtml\(shown, entries\)/);
  const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(indexSource, /<div id="hriHistoryRefundsInline"><\/div>/);
});

test('wiring: the display reuses the statement table classes and adds no new style rule', () => {
  const html = historyRefundsInlineHtml(historyWithRefunds(), historyWithRefunds());
  assert.match(html, /class="statement-table"/);
  assert.match(html, /balance-num/);
  const stylesSource = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.doesNotMatch(stylesSource, /hriHistoryRefundsInline/);
  assert.doesNotMatch(stylesSource, /refunds-inline/);
});
