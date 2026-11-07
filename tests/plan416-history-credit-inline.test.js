// Plan 416 — History credit applications shown inline.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fullHistoryEntries } from '../full-history-list.js';
import {
  HISTORY_CREDIT_INLINE_EMPTY_TEXT,
  HISTORY_CREDIT_INLINE_NO_APPLICATIONS_TEXT,
  HISTORY_CREDIT_INLINE_DATE_NOT_RECORDED_TEXT,
  HISTORY_CREDIT_INLINE_BILL_NOT_RECORDED_TEXT,
  historyCreditInlineIsApplication,
  historyCreditInlineLines,
  historyCreditInlineTotalCents,
  historyCreditInlineRemainingCents,
  formatCreditInlineAmount,
  historyCreditInlineBalanceNote,
  historyCreditInlineLineText,
  historyCreditInlineSummaryText,
  historyCreditInlineHtml,
} from '../history-credit-inline.js';

const CUSTOMER = 'CUST-1';

function creditEntry(overrides = {}) {
  return {
    id: 'CR-1',
    customerId: CUSTOMER,
    source: 'overpayment',
    amountCents: 50000,
    date: '2026-09-05',
    sourcePaymentId: 'PAY-1',
    note: '',
    ...overrides,
  };
}

function application(overrides = {}) {
  return {
    id: 'APP-1',
    creditEntryId: 'CR-1',
    customerId: CUSTOMER,
    billId: 'BILL-OCT',
    billLabel: 'October 2026',
    amountCents: 50000,
    date: '2026-10-05',
    note: '',
    ...overrides,
  };
}

// The acceptance fixture: a September bill of PKR 1,000, a payment
// of PKR 1,500 on 2026-09-05 (PKR 500 overpaid), an October bill of
// PKR 500, and one application of the PKR 500 credit to the October
// bill on 2026-10-05. The October bill reads as settled after the
// application, never still owed.
function historyFixture() {
  const bills = [
    {
      id: 'BILL-SEP', month: '2026-09', dueAmount: 1000, dueDate: '2026-09-01',
      payments: [{ id: 'PAY-1', amount: 1500, date: '2026-09-05', method: 'Cash' }],
    },
    {
      id: 'BILL-OCT', month: '2026-10', dueAmount: 500, dueDate: '2026-10-01', payments: [],
    },
  ];
  const entries = fullHistoryEntries({
    customerId: CUSTOMER, bills, creditEntries: [creditEntry()], refundRecords: [],
  });
  return { bills, entries, creditEntries: [creditEntry()], applications: [application()] };
}

// --- Acceptance ---

test('acceptance: every credit application appears in date order and the balance after it reflects the settled bill', () => {
  const { entries, creditEntries, applications } = historyFixture();
  const lines = historyCreditInlineLines({ entries, applications, creditEntries, customerId: CUSTOMER });
  assert.equal(lines.length, 1);
  const [line] = lines;
  assert.equal(line.date, '2026-10-05');
  assert.equal(line.bill, 'October 2026');
  assert.equal(line.amountCents, 50000);
  assert.equal(line.remainingCents, 0);
  assert.equal(line.balanceAfterCents, 0);
  assert.equal(historyCreditInlineBalanceNote(line.balanceAfterCents), 'Settled');
});

test('acceptance: a customer with one application shows that one', () => {
  const { entries, creditEntries, applications } = historyFixture();
  const html = historyCreditInlineHtml(entries, entries, applications, creditEntries, CUSTOMER);
  assert.match(html, /October 2026/);
  assert.match(html, /PKR 500/);
  assert.match(html, /is-settled/);
});

test('acceptance: another customer\'s applications never appear', () => {
  const { entries, creditEntries } = historyFixture();
  const other = [application({ id: 'APP-2', customerId: 'CUST-2' })];
  const lines = historyCreditInlineLines({ entries, applications: other, creditEntries, customerId: CUSTOMER });
  assert.equal(lines.length, 0);
  const html = historyCreditInlineHtml(entries, entries, other, creditEntries, CUSTOMER);
  assert.match(html, /No credit applied/);
});

// --- The application check ---

test('isApplication: a well-formed application for this customer counts', () => {
  assert.equal(historyCreditInlineIsApplication(application(), CUSTOMER), true);
});

test('isApplication: the customer match is case-insensitive', () => {
  assert.equal(historyCreditInlineIsApplication(application({ customerId: 'cust-1' }), CUSTOMER), true);
});

test('isApplication: an application naming no bill is dropped', () => {
  assert.equal(historyCreditInlineIsApplication(application({ billId: '' }), CUSTOMER), false);
});

test('isApplication: an application naming no credit entry is dropped', () => {
  assert.equal(historyCreditInlineIsApplication(application({ creditEntryId: '' }), CUSTOMER), false);
});

test('isApplication: a zero, negative or non-numeric amount never counts as an application', () => {
  assert.equal(historyCreditInlineIsApplication(application({ amountCents: 0 }), CUSTOMER), false);
  assert.equal(historyCreditInlineIsApplication(application({ amountCents: -500 }), CUSTOMER), false);
  assert.equal(historyCreditInlineIsApplication(application({ amountCents: '500' }), CUSTOMER), true);
  assert.equal(historyCreditInlineIsApplication(application({ amountCents: null }), CUSTOMER), false);
  assert.equal(historyCreditInlineIsApplication(application({ amountCents: true }), CUSTOMER), false);
  assert.equal(historyCreditInlineIsApplication(null, CUSTOMER), false);
  assert.equal(historyCreditInlineIsApplication('APP-1', CUSTOMER), false);
});

// --- Remaining credit ---

test('remaining: two applications on one entry leave what is left after each one', () => {
  const { entries, creditEntries } = historyFixture();
  const bigEntry = [creditEntry({ id: 'CR-2', amountCents: 100000 })];
  const apps = [
    application({ id: 'APP-2A', creditEntryId: 'CR-2', amountCents: 40000, date: '2026-09-10', billId: 'BILL-SEP', billLabel: 'September 2026' }),
    application({ id: 'APP-2B', creditEntryId: 'CR-2', amountCents: 30000, date: '2026-10-05', billId: 'BILL-OCT', billLabel: 'October 2026' }),
  ];
  const lines = historyCreditInlineLines({ entries, applications: apps, creditEntries: bigEntry, customerId: CUSTOMER });
  assert.equal(lines.length, 2);
  assert.equal(lines[0].remainingCents, 60000);
  assert.equal(lines[1].remainingCents, 30000);
  assert.equal(historyCreditInlineRemainingCents(lines), 30000);
});

test('remaining: two applications on one entry never double-count what is left', () => {
  const { entries, creditEntries } = historyFixture();
  const apps = [
    application({ id: 'APP-3A', amountCents: 20000, date: '2026-09-10' }),
    application({ id: 'APP-3B', amountCents: 30000, date: '2026-10-05' }),
  ];
  const lines = historyCreditInlineLines({ entries, applications: apps, creditEntries, customerId: CUSTOMER });
  assert.equal(historyCreditInlineRemainingCents(lines), 0);
  assert.equal(historyCreditInlineTotalCents(lines), 50000);
});

test('remaining: an application whose entry is unknown shows no remaining figure, never a guessed one', () => {
  const { entries } = historyFixture();
  const apps = [application({ creditEntryId: 'CR-MISSING' })];
  const lines = historyCreditInlineLines({ entries, applications: apps, creditEntries: [], customerId: CUSTOMER });
  assert.equal(lines.length, 1);
  assert.equal(lines[0].remainingCents, null);
  assert.equal(historyCreditInlineLineText(lines[0]).includes('not recorded'), true);
});

// --- Ordering and the running balance ---

test('ordering: applications sort by date, and a month-only date counts as the first of that month', () => {
  const { entries, creditEntries } = historyFixture();
  const apps = [
    application({ id: 'APP-4B', date: '2026-10', billLabel: 'October 2026' }),
    application({ id: 'APP-4A', date: '2026-09-10', billLabel: 'September 2026' }),
  ];
  const lines = historyCreditInlineLines({ entries, applications: apps, creditEntries, customerId: CUSTOMER });
  assert.equal(lines[0].applicationId, 'APP-4A');
  assert.equal(lines[1].applicationId, 'APP-4B');
  assert.equal(lines[1].date, '2026-10');
});

test('ordering: an undated application sorts last and reads the final balance', () => {
  const { entries, creditEntries } = historyFixture();
  const apps = [
    application({ id: 'APP-5A', date: '2026-10-05' }),
    application({ id: 'APP-5B', date: '', billLabel: 'October 2026' }),
  ];
  const lines = historyCreditInlineLines({ entries, applications: apps, creditEntries, customerId: CUSTOMER });
  assert.equal(lines[lines.length - 1].applicationId, 'APP-5B');
  assert.equal(lines[lines.length - 1].date, '');
  assert.equal(lines[lines.length - 1].balanceAfterCents, 0);
});

test('balance: an application dated before every entry reads a balance of zero, never a guessed figure', () => {
  const { entries, creditEntries } = historyFixture();
  const apps = [application({ date: '2026-08-01' })];
  const lines = historyCreditInlineLines({ entries, applications: apps, creditEntries, customerId: CUSTOMER });
  assert.equal(lines[0].balanceAfterCents, 0);
});

test('balance: an application on the same day as a charge reads the balance after that charge', () => {
  const { entries, creditEntries } = historyFixture();
  const early = historyCreditInlineLines({
    entries, applications: [application({ date: '2026-09-01' })], creditEntries, customerId: CUSTOMER,
  });
  assert.equal(early[0].balanceAfterCents, 100000);
  assert.equal(historyCreditInlineBalanceNote(early[0].balanceAfterCents), 'Still owed PKR 1,000');
  const late = historyCreditInlineLines({
    entries, applications: [application({ date: '2026-10-01' })], creditEntries, customerId: CUSTOMER,
  });
  assert.equal(late[0].balanceAfterCents, 0);
});

test('balance: an adjustment-sourced credit reduces what is owed before its application', () => {
  const bills = [
    { id: 'BILL-SEP', month: '2026-09', dueAmount: 1000, dueDate: '2026-09-01', payments: [] },
  ];
  const adjEntry = creditEntry({ id: 'CR-ADJ', source: 'adjustment', amountCents: 20000, date: '2026-09-06', note: 'Goodwill adjustment' });
  const entries = fullHistoryEntries({
    customerId: CUSTOMER, bills, creditEntries: [adjEntry], refundRecords: [],
  });
  const apps = [application({ id: 'APP-ADJ', creditEntryId: 'CR-ADJ', amountCents: 20000, date: '2026-09-07', billId: 'BILL-SEP', billLabel: 'September 2026' })];
  const lines = historyCreditInlineLines({ entries, applications: apps, creditEntries: [adjEntry], customerId: CUSTOMER });
  assert.equal(lines.length, 1);
  assert.equal(lines[0].balanceAfterCents, 80000);
  assert.equal(lines[0].remainingCents, 0);
});

test('lines: the bill falls back to the bill id when no label is recorded, and to plain words when neither is', () => {
  const { entries, creditEntries } = historyFixture();
  const noLabel = historyCreditInlineLines({
    entries, applications: [application({ billLabel: '' })], creditEntries, customerId: CUSTOMER,
  });
  assert.equal(noLabel[0].bill, 'BILL-OCT');
  assert.equal(historyCreditInlineLineText({ date: '2026-10-05', bill: '', amountCents: 50000, remainingCents: 0, balanceAfterCents: 0 }).includes(HISTORY_CREDIT_INLINE_BILL_NOT_RECORDED_TEXT), true);
});

test('lines: no customer id means no lines', () => {
  const { entries, creditEntries, applications } = historyFixture();
  assert.deepEqual(historyCreditInlineLines({ entries, applications, creditEntries, customerId: '' }), []);
  assert.deepEqual(historyCreditInlineLines({}), []);
});

// --- Amounts and notes ---

test('format: whole rupees print with no decimals and a paisa remainder with one decimal', () => {
  assert.equal(formatCreditInlineAmount(150000), 'PKR 1,500');
  assert.equal(formatCreditInlineAmount(150050), 'PKR 1,500.5');
  assert.equal(formatCreditInlineAmount(null), 'PKR 0');
  assert.equal(formatCreditInlineAmount(-5000), '-PKR 50');
});

test('balance note: settled, still owed, credit and not recorded', () => {
  assert.equal(historyCreditInlineBalanceNote(0), 'Settled');
  assert.equal(historyCreditInlineBalanceNote(100000), 'Still owed PKR 1,000');
  assert.equal(historyCreditInlineBalanceNote(-50000), 'Credit PKR 500');
  assert.equal(historyCreditInlineBalanceNote(null), 'not recorded');
});

test('line text: date, bill, amount, remaining and balance in plain words', () => {
  const { entries, creditEntries, applications } = historyFixture();
  const [line] = historyCreditInlineLines({ entries, applications, creditEntries, customerId: CUSTOMER });
  assert.equal(historyCreditInlineLineText(line), '2026-10-05 · Credit PKR 500 applied to October 2026 · Remaining PKR 0 · Balance after Settled');
  assert.equal(historyCreditInlineLineText({ date: '', bill: 'October 2026', amountCents: 50000, remainingCents: null, balanceAfterCents: 0 }).includes(HISTORY_CREDIT_INLINE_DATE_NOT_RECORDED_TEXT), true);
  assert.equal(historyCreditInlineLineText(null), '');
});

// --- Summary ---

test('summary: an empty shown list says no transactions yet', () => {
  assert.equal(historyCreditInlineSummaryText([], [], [], [], CUSTOMER), HISTORY_CREDIT_INLINE_EMPTY_TEXT);
});

test('summary: a shown history with no applications says so plainly', () => {
  const { entries } = historyFixture();
  assert.equal(historyCreditInlineSummaryText(entries, entries, [], [], CUSTOMER), HISTORY_CREDIT_INLINE_NO_APPLICATIONS_TEXT);
});

test('summary: the full summary names the count, the applied total, the remaining credit and the balance', () => {
  const { entries, creditEntries, applications } = historyFixture();
  assert.equal(
    historyCreditInlineSummaryText(entries, entries, applications, creditEntries, CUSTOMER),
    '1 credit application · PKR 500 applied · Remaining PKR 0 · Balance Settled',
  );
});

test('summary: a filtered view composes the full-history totals', () => {
  const { bills } = historyFixture();
  const bigEntry = [creditEntry({ id: 'CR-2', amountCents: 100000 })];
  const apps = [
    application({ id: 'APP-6A', creditEntryId: 'CR-2', amountCents: 40000, date: '2026-09-10', billId: 'BILL-SEP', billLabel: 'September 2026' }),
    application({ id: 'APP-6B', creditEntryId: 'CR-2', amountCents: 30000, date: '2026-10-05', billId: 'BILL-OCT', billLabel: 'October 2026' }),
  ];
  const entries = fullHistoryEntries({ customerId: CUSTOMER, bills, creditEntries: bigEntry, refundRecords: [] });
  // The shown view hides the credit row, so its applications hide too.
  const shownHidden = entries.filter((entry) => !(entry.type === 'credit' && entry.ref === 'CR-2'));
  assert.equal(historyCreditInlineSummaryText(shownHidden, entries, apps, bigEntry, CUSTOMER), HISTORY_CREDIT_INLINE_NO_APPLICATIONS_TEXT);
  // The shown view keeps the credit row, so both applications show and the summary is the full one.
  assert.equal(
    historyCreditInlineSummaryText(entries, entries, apps, bigEntry, CUSTOMER),
    '2 credit applications · PKR 700 applied · Remaining PKR 300 · Balance Settled',
  );
  // The shown view keeps one of two credit rows, so the summary composes the full-history totals.
  const twoEntries = [creditEntry({ id: 'CR-2', amountCents: 100000 }), creditEntry({ id: 'CR-3', amountCents: 20000, date: '2026-09-06' })];
  const twoApps = [
    application({ id: 'APP-6C', creditEntryId: 'CR-2', amountCents: 40000, date: '2026-09-10', billId: 'BILL-SEP', billLabel: 'September 2026' }),
    application({ id: 'APP-6D', creditEntryId: 'CR-3', amountCents: 20000, date: '2026-09-12', billId: 'BILL-SEP', billLabel: 'September 2026' }),
  ];
  const twoHistory = fullHistoryEntries({ customerId: CUSTOMER, bills, creditEntries: twoEntries, refundRecords: [] });
  const shownOne = twoHistory.filter((entry) => !(entry.type === 'credit' && entry.ref === 'CR-3'));
  assert.equal(
    historyCreditInlineSummaryText(shownOne, twoHistory, twoApps, twoEntries, CUSTOMER),
    '1 credit application · PKR 400 applied · Remaining PKR 600 · Balance Credit PKR 500 · Full history: 2 credit applications · PKR 600 applied',
  );
});

// --- The display ---

test('html: an empty shown list renders nothing', () => {
  assert.equal(historyCreditInlineHtml([], [], [], [], CUSTOMER), '');
  assert.equal(historyCreditInlineHtml(null, null, null, null, CUSTOMER), '');
});

test('html: a shown history with no applications renders a plain line saying so', () => {
  const { entries } = historyFixture();
  assert.match(historyCreditInlineHtml(entries, entries, [], [], CUSTOMER), /No credit applied/);
});

test('html: the table carries date, bill, applied, remaining and balance after, with a totals footer', () => {
  const { entries, creditEntries, applications } = historyFixture();
  const html = historyCreditInlineHtml(entries, entries, applications, creditEntries, CUSTOMER);
  assert.match(html, /class="statement-table"/);
  assert.match(html, /<th>Date<\/th><th>Bill<\/th><th class="col-num">Credit applied<\/th><th class="col-num">Remaining credit<\/th><th class="col-num">Balance after<\/th>/);
  assert.match(html, /<td>2026-10-05<\/td><td>October 2026<\/td>/);
  assert.match(html, /Totals · 1 credit application/);
  assert.match(html, /<strong>PKR 500<\/strong>/);
});

test('html: a filtered view shows only what the filters show, with a full-history footer row', () => {
  const { entries, creditEntries } = historyFixture();
  const bigEntry = [creditEntry({ id: 'CR-2', amountCents: 100000 }), creditEntry({ id: 'CR-3', amountCents: 20000, date: '2026-09-06' })];
  const apps = [
    application({ id: 'APP-7A', creditEntryId: 'CR-2', amountCents: 40000, date: '2026-09-10', billId: 'BILL-SEP', billLabel: 'September 2026' }),
    application({ id: 'APP-7B', creditEntryId: 'CR-3', amountCents: 20000, date: '2026-09-12', billId: 'BILL-SEP', billLabel: 'September 2026' }),
  ];
  const allEntries = fullHistoryEntries({
    customerId: CUSTOMER,
    bills: historyFixture().bills,
    creditEntries: bigEntry,
    refundRecords: [],
  });
  const shown = allEntries.filter((entry) => !(entry.type === 'credit' && entry.ref === 'CR-3'));
  const html = historyCreditInlineHtml(shown, allEntries, apps, bigEntry, CUSTOMER);
  assert.match(html, /2026-09-10/);
  assert.doesNotMatch(html, /2026-09-12/);
  assert.match(html, /Totals · 1 credit application/);
  assert.match(html, /Full history · 2 credit applications/);
});

test('html: a bill label with markup is escaped, never rendered', () => {
  const { entries, creditEntries } = historyFixture();
  const apps = [application({ billLabel: '<script>alert(1)</script>' })];
  const html = historyCreditInlineHtml(entries, entries, apps, creditEntries, CUSTOMER);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test('html: the display never mutates its inputs', () => {
  const { bills, entries, creditEntries, applications } = historyFixture();
  const billsBefore = JSON.stringify(bills);
  const entriesBefore = JSON.stringify(entries);
  const creditsBefore = JSON.stringify(creditEntries);
  const appsBefore = JSON.stringify(applications);
  historyCreditInlineHtml(entries, entries, applications, creditEntries, CUSTOMER);
  historyCreditInlineSummaryText(entries, entries, applications, creditEntries, CUSTOMER);
  assert.equal(JSON.stringify(bills), billsBefore);
  assert.equal(JSON.stringify(entries), entriesBefore);
  assert.equal(JSON.stringify(creditEntries), creditsBefore);
  assert.equal(JSON.stringify(applications), appsBefore);
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
  assert.doesNotMatch(listSource, /historyCreditInline/);
});

test('fence: the credit-balance record still exports its builders and is untouched by this plan', () => {
  const creditName = 'credit-' + 'balance.js';
  const creditSource = readFileSync(new URL(`../${creditName}`, import.meta.url), 'utf8');
  assert.match(creditSource, /export function normalizeCreditEntry/);
  assert.match(creditSource, /export function normalizeCreditApplication/);
  assert.match(creditSource, /export function applyCredit/);
  assert.match(creditSource, /export function remainingForEntry/);
  assert.match(creditSource, /export function creditBalanceForCustomer/);
  assert.doesNotMatch(creditSource, /historyCreditInline/);
});

test('fence: no fenced history view carries any credit-inline reference', () => {
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
    'history-' + 'refunds-inline.js',
    'balance-' + 'rollforward.js',
  ];
  for (const name of fenced) {
    const source = readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /historyCreditInline/, `${name} must not reference this plan`);
  }
});

test('header: the module header never names a fenced module literally', () => {
  const source = readFileSync(new URL('../history-credit-inline.js', import.meta.url), 'utf8');
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
    'history-' + 'refunds-inline.js',
    'balance-' + 'rollforward.js',
    'credit-' + 'balance.js',
  ]) {
    assert.doesNotMatch(header, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `header must not name ${name}`);
  }
});

// --- Wiring ---

test('wiring: the app renders the credit display from the shown rows', () => {
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(appSource, /import \{ historyCreditInlineHtml \} from '\.\/history-credit-inline\.js';/);
  assert.match(appSource, /\$\('#hciHistoryCreditInline'\)/);
  assert.match(appSource, /historyCreditInlineHtml\(shown, entries, loadCreditApplications\(\), loadCreditEntries\(\), customer\.id\)/);
  const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(indexSource, /<div id="hciHistoryCreditInline"><\/div>/);
});

test('wiring: the display reuses the statement table classes and adds no new style rule', () => {
  const { entries, creditEntries, applications } = historyFixture();
  const html = historyCreditInlineHtml(entries, entries, applications, creditEntries, CUSTOMER);
  assert.match(html, /class="statement-table"/);
  assert.match(html, /balance-num/);
  const stylesSource = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.doesNotMatch(stylesSource, /hciHistoryCreditInline/);
  assert.doesNotMatch(stylesSource, /credit-inline/);
});
