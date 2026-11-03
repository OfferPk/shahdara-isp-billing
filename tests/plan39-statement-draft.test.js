// Plan 39 (Plan 1-100) — Monthly customer statement draft via WhatsApp.
// Figures are sums of the ledger rows the caller supplies; nothing is
// recomputed by allocation, and sending never alters any record.
// Fixtures are synthetic; no real customer data is used.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  STATEMENT_DRAFT_VARIANTS,
  isValidStatementMonth,
  isValidStatementDate,
  formatStatementAmount,
  formatStatementMonth,
  buildMonthlyStatement,
  buildStatementDraftText,
  statementDraftSummaryText,
  logStatementSent,
  findStatementSends,
  statementSentText,
  statementDraftHtml,
} from '../statement-draft.js';

const bill = (month, overrides = {}) => ({
  id: `bill-${month}`, month, dueAmount: 3000, dueDate: `${month}-05`,
  status: 'pending', payments: [], ...overrides,
});
const pay = (date, amount, extra = {}) => ({ id: `pay-${date}-${amount}`, date, amount, method: 'Cash', ...extra });

test('month and date validation rejects bad months and impossible dates', () => {
  assert.equal(isValidStatementMonth('2026-11'), true);
  assert.equal(isValidStatementMonth('2026-13'), false);
  assert.equal(isValidStatementMonth('2026-1'), false);
  assert.equal(isValidStatementMonth('Nov 2026'), false);
  assert.equal(isValidStatementDate('2026-11-05'), true);
  assert.equal(isValidStatementDate('2026-02-30'), false);
  assert.equal(isValidStatementDate('2026-11-5'), false);
  assert.equal(formatStatementMonth('2026-11'), 'Nov 2026');
  assert.equal(formatStatementMonth('2026-13'), '');
  assert.equal(formatStatementAmount(3000), 'PKR 3,000');
  assert.equal(formatStatementAmount(3333.33), 'PKR 3,333.33');
});

test('null for missing customer or invalid month, never a guessed statement', () => {
  assert.equal(buildMonthlyStatement({ customerId: '', month: '2026-11', bills: [], payments: [] }), null);
  assert.equal(buildMonthlyStatement({ customerId: 'c1', month: '2026-13', bills: [], payments: [] }), null);
  assert.equal(buildMonthlyStatement({ month: '2026-11', bills: [], payments: [] }), null);
  assert.equal(buildStatementDraftText(null), null);
  assert.equal(statementDraftSummaryText(null), 'Monthly statement unavailable.');
});

test('charges sum the month bill due plus its own late and shifting fees', () => {
  const statement = buildMonthlyStatement({
    customerId: 'c1', customerName: 'Ahmed', month: '2026-11',
    bills: [bill('2026-11', { dueAmount: 3000, lateFee: 200, shiftingFee: 500 })],
    payments: [],
  });
  assert.equal(statement.hasBill, true);
  assert.equal(statement.charges, 3700);
  assert.deepEqual(statement.chargeLines.map((line) => line.amount), [3000, 200, 500]);
  assert.equal(statement.openingBalance, 0);
  assert.equal(statement.closingBalance, 3700);
});

test('opening balance is prior charges minus prior payments, closing balances', () => {
  const statement = buildMonthlyStatement({
    customerId: 'c1', customerName: 'Ahmed', month: '2026-11',
    bills: [bill('2026-09', { dueAmount: 3000 }), bill('2026-10', { dueAmount: 3000 }), bill('2026-11', { dueAmount: 3000 })],
    payments: [pay('2026-09-10', 3000), pay('2026-10-10', 1000), pay('2026-11-10', 2000)],
  });
  assert.equal(statement.openingBalance, 2000);
  assert.equal(statement.charges, 3000);
  assert.equal(statement.paymentsReceived, 2000);
  assert.equal(statement.paymentCount, 1);
  assert.equal(statement.closingBalance, 3000);
});

test('payments are attributed by payment date month, not by bill month', () => {
  const statement = buildMonthlyStatement({
    customerId: 'c1', customerName: 'Ahmed', month: '2026-11',
    bills: [bill('2026-10', { dueAmount: 3000 }), bill('2026-11', { dueAmount: 3000 })],
    payments: [pay('2026-11-02', 3000)],
  });
  // The November payment settles prior balance, so opening stays 3000
  // and November's own charges stay fully open.
  assert.equal(statement.openingBalance, 3000);
  assert.equal(statement.paymentsReceived, 3000);
  assert.equal(statement.closingBalance, 3000);
});

test('voided payments are counted, never totalled; bad amounts excluded, never zero-filled', () => {
  const statement = buildMonthlyStatement({
    customerId: 'c1', customerName: 'Ahmed', month: '2026-11',
    bills: [bill('2026-11', { dueAmount: 3000 })],
    payments: [
      pay('2026-11-10', 1000),
      pay('2026-11-11', 5000, { voided: true }),
      pay('2026-11-12', 0),
      { id: 'bad', date: '2026-02-30', amount: 900 },
      pay('2026-11-13', -100),
    ],
  });
  assert.equal(statement.paymentsReceived, 1000);
  assert.equal(statement.paymentCount, 1);
  assert.equal(statement.voidedCount, 1);
  assert.equal(statement.excludedCount, 2);
  assert.equal(statement.closingBalance, 2000);
});

test('a negative opening is advance, kept as-is, and the draft says so', () => {
  const statement = buildMonthlyStatement({
    customerId: 'c1', customerName: 'Ahmed', month: '2026-11',
    bills: [bill('2026-10', { dueAmount: 3000 }), bill('2026-11', { dueAmount: 3000 })],
    payments: [pay('2026-10-10', 5000)],
  });
  assert.equal(statement.openingBalance, -2000);
  assert.equal(statement.closingBalance, 1000);
  const draft = buildStatementDraftText(statement);
  assert.match(draft.text, /Opening balance: PKR -2,000/);
});

test('a month with no bill still gets a statement that says so', () => {
  const statement = buildMonthlyStatement({
    customerId: 'c1', customerName: 'Ahmed', month: '2026-11',
    bills: [bill('2026-10', { dueAmount: 3000 })],
    payments: [],
  });
  assert.equal(statement.hasBill, false);
  assert.equal(statement.charges, 0);
  assert.equal(statement.openingBalance, 3000);
  assert.equal(statement.closingBalance, 3000);
  const draft = buildStatementDraftText(statement);
  assert.match(draft.text, /No bill was raised for this month/);
});

test('Roman draft carries figures verbatim with a baqaya line; Urdu draft mirrors it', () => {
  const statement = buildMonthlyStatement({
    customerId: 'c1', customerName: 'Ahmed', month: '2026-11',
    bills: [bill('2026-10', { dueAmount: 3000 }), bill('2026-11', { dueAmount: 3000 })],
    payments: [pay('2026-11-10', 1000)],
  });
  const roman = buildStatementDraftText(statement, STATEMENT_DRAFT_VARIANTS.ROMAN);
  assert.equal(roman.variant, 'roman');
  assert.equal(roman.month, '2026-11');
  assert.match(roman.text, /Monthly statement for Nov 2026/);
  assert.match(roman.text, /Opening balance: PKR 3,000/);
  assert.match(roman.text, /Closing balance: PKR 5,000/);
  assert.match(roman.text, /Baqaya PKR 5,000 baqi hai/);
  const urdu = buildStatementDraftText(statement, STATEMENT_DRAFT_VARIANTS.URDU);
  assert.equal(urdu.variant, 'urdu');
  assert.match(urdu.text, /اختتامی بقایا: PKR 5,000/);
  assert.match(urdu.text, /بقایا PKR 5,000 باقی ہے/);
  // An unknown variant falls back to Roman, never to a broken draft.
  assert.equal(buildStatementDraftText(statement, 'french').variant, 'roman');
});

test('a settled month says no baqaya remains', () => {
  const statement = buildMonthlyStatement({
    customerId: 'c1', customerName: 'Ahmed', month: '2026-11',
    bills: [bill('2026-11', { dueAmount: 3000 })],
    payments: [pay('2026-11-10', 3000)],
  });
  assert.equal(statement.closingBalance, 0);
  assert.match(buildStatementDraftText(statement).text, /Koi baqaya baqi nahi hai/);
});

test('inputs are never mutated', () => {
  const bills = [bill('2026-11', { dueAmount: 3000 })];
  const payments = [pay('2026-11-10', 1000)];
  const snapshot = JSON.stringify({ bills, payments });
  buildMonthlyStatement({ customerId: 'c1', customerName: 'Ahmed', month: '2026-11', bills, payments });
  assert.equal(JSON.stringify({ bills, payments }), snapshot);
});

test('send log appends, ignores bad entries, and finds sends per month', () => {
  let log = [];
  log = logStatementSent(log, { customerId: 'c1', month: '2026-11', sentAt: '2026-11-12T10:00:00.000Z', channel: 'whatsapp', variant: 'roman' });
  assert.equal(log.length, 1);
  assert.equal(log[0].channel, 'whatsapp');
  // Bad entries leave the log unchanged.
  log = logStatementSent(log, { customerId: '', month: '2026-11', sentAt: '2026-11-12T10:00:00.000Z' });
  log = logStatementSent(log, { customerId: 'c1', month: '2026-13', sentAt: '2026-11-12T10:00:00.000Z' });
  log = logStatementSent(log, { customerId: 'c1', month: '2026-11', sentAt: '' });
  assert.equal(log.length, 1);
  // A send for another month does not count for this month.
  log = logStatementSent(log, { customerId: 'c1', month: '2026-12', sentAt: '2026-12-05T10:00:00.000Z' });
  assert.equal(findStatementSends(log, 'c1', '2026-11').length, 1);
  assert.equal(findStatementSends(log, 'c1', '2026-12').length, 1);
  assert.deepEqual(findStatementSends(log, 'c2', '2026-11'), []);
  assert.deepEqual(findStatementSends('not-a-list', 'c1', '2026-11'), []);
});

test('sent text states not-sent, once, and re-send', () => {
  assert.match(statementSentText([]), /not sent yet/);
  assert.match(statementSentText([{ sentAt: '2026-11-12T10:00:00.000Z' }]), /sent on 12 Nov 2026/);
  assert.match(statementSentText([
    { sentAt: '2026-11-12T10:00:00.000Z' },
    { sentAt: '2026-11-13T10:00:00.000Z' },
  ]), /1 more time/);
});

test('summary text and HTML escape customer input', () => {
  const statement = buildMonthlyStatement({
    customerId: 'c1', customerName: '<b>Ahmed</b>', month: '2026-11',
    bills: [bill('2026-11', { dueAmount: 3000 })],
    payments: [],
  });
  assert.match(statementDraftSummaryText(statement), /Nov 2026/);
  assert.match(statementDraftSummaryText(statement), /closing PKR 3,000/);
  const html = statementDraftHtml(statement, { draftText: '<script>alert(1)</script>', sends: [] });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;b&gt;Ahmed&lt;\/b&gt;/);
  assert.match(html, /not sent yet/);
  assert.equal(statementDraftHtml(null), '<p class="empty-state">Monthly statement unavailable.</p>');
});
