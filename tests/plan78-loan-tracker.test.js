/**
 * plan78-loan-tracker.test.js — Plan 78: temporary loan equipment
 * tracker.
 * Pins:
 * - every loan carries exactly one customer, one loan serial,
 *   and one status; half-formed records are refused outright,
 *   never stored half-formed;
 * - a loan converted to permanent must carry the operator's
 *   note; only a loan still out can be returned or converted;
 * - overdue loans are still out past their expected return date
 *   on the caller-supplied today, most overdue first, and a loan
 *   due today is not overdue;
 * - returning a loan never touches any repair or warranty
 *   record — the module holds no such field — and loan actions
 *   never create a bill or payment, so the module holds no bill,
 *   payment, package, or ticket-status field of its own;
 * - impossible dates (2026-02-30) are never stored as a date.
 * Synthetic data only; no bill, payment, ticket, or customer
 * record is ever changed by this plan.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LOAN_DEVICE_TYPES,
  LOAN_DEVICE_TYPE_LABELS,
  LOAN_STATUSES,
  LOAN_STATUS_LABELS,
  validLoanDate,
  loanMohallaKey,
  normalizeLoan,
  normalizeLoanList,
  findLoan,
  upsertLoan,
  removeLoan,
  markLoanReturned,
  convertLoanPermanent,
  reopenLoan,
  loansFiltered,
  outLoans,
  overdueLoans,
  buildLoanSummary,
  loanSummaryText,
  loanHtml,
  loanCsv,
  loanFilename,
} from '../loan-tracker.js';

const base = {
  id: 'LOAN-001',
  customerId: 'C-001',
  customerName: 'Ahmed',
  ticketId: 'T-101',
  connectionId: 'CON-7',
  deviceType: 'onu',
  loanSerial: 'ONU-LOAN-1',
  originalSerial: 'ONU-OLD-9',
  dateIssued: '2026-01-05',
  expectedReturnDate: '2026-01-20',
  status: 'out',
  mohalla: 'Bani',
};

test('strict dates: impossible dates refused, valid dates kept', () => {
  assert.equal(validLoanDate('2026-02-30'), null);
  assert.equal(validLoanDate('2026-01-05'), '2026-01-05');
  assert.equal(validLoanDate('not a date'), null);
  assert.equal(normalizeLoan({ ...base, dateIssued: '2026-02-30' }), null);
  assert.equal(normalizeLoan({ ...base, expectedReturnDate: '2026-13-01' }), null);
});

test('catalogues: three device types, three statuses', () => {
  assert.deepEqual(LOAN_DEVICE_TYPES, ['onu', 'router', 'other']);
  assert.deepEqual(LOAN_STATUSES, ['out', 'returned', 'converted']);
  assert.equal(LOAN_DEVICE_TYPE_LABELS.onu, 'ONU');
  assert.equal(LOAN_STATUS_LABELS.converted, 'Converted to permanent');
});

test('half-formed records refused outright', () => {
  assert.equal(normalizeLoan({ ...base, id: '' }), null);
  assert.equal(normalizeLoan({ ...base, customerId: '' }), null);
  assert.equal(normalizeLoan({ ...base, deviceType: 'splitter' }), null);
  assert.equal(normalizeLoan({ ...base, loanSerial: '' }), null);
  assert.equal(normalizeLoan({ ...base, status: 'lost' }), null);
  assert.equal(normalizeLoan({ ...base, status: 'converted', note: '' }), null);
  assert.equal(normalizeLoan({ ...base, status: 'converted' }), null);
  assert.notEqual(normalizeLoan({ ...base, status: 'converted', note: 'Customer kept it, agreed' }), null);
  // Ticket and connection links are optional ids, not required fields.
  assert.notEqual(normalizeLoan({ ...base, ticketId: '', connectionId: '' }), null);
  // Upsert of a half-formed record leaves the list unchanged.
  assert.deepEqual(upsertLoan([base], { ...base, id: 'LOAN-002', loanSerial: '' }), normalizeLoanList([base]));
});

test('mohalla canonical keys mirror the Plan T rule', () => {
  assert.equal(loanMohallaKey('Mohalla Bani'), 'BANII');
  assert.equal(loanMohallaKey('kishti'), 'KISHTII');
  assert.equal(loanMohallaKey('chamyaa'), 'CHAMYAAA');
  assert.equal(loanMohallaKey(''), null);
  assert.equal(loanMohallaKey('Shahdara Town'), 'SHAHDARA TOWN');
});

test('upsert, find, and remove keep one record per id', () => {
  const list = upsertLoan([], base);
  assert.equal(findLoan(list, 'LOAN-001')?.loanSerial, 'ONU-LOAN-1');
  const moved = upsertLoan(list, { ...base, loanSerial: 'ONU-LOAN-2' });
  assert.equal(moved.length, 1);
  assert.equal(findLoan(moved, 'LOAN-001')?.loanSerial, 'ONU-LOAN-2');
  assert.equal(removeLoan(moved, 'LOAN-001').length, 0);
  assert.equal(findLoan(list, 'NOPE'), null);
});

test('status moves: only out loans move; terminal states stay put', () => {
  const returned = markLoanReturned([base], 'LOAN-001', '2026-01-18');
  assert.equal(findLoan(returned, 'LOAN-001')?.status, 'returned');
  assert.equal(findLoan(returned, 'LOAN-001')?.returnDate, '2026-01-18');
  // A returned loan cannot be returned again or converted.
  assert.equal(findLoan(markLoanReturned(returned, 'LOAN-001', '2026-01-19'), 'LOAN-001')?.returnDate, '2026-01-18');
  assert.equal(findLoan(convertLoanPermanent(returned, 'LOAN-001', 'kept it'), 'LOAN-001')?.status, 'returned');
  // Conversion needs the operator note.
  assert.equal(findLoan(convertLoanPermanent([base], 'LOAN-001', ''), 'LOAN-001')?.status, 'out');
  const converted = convertLoanPermanent([base], 'LOAN-001', 'Customer kept it, agreed');
  assert.equal(findLoan(converted, 'LOAN-001')?.status, 'converted');
  assert.equal(findLoan(converted, 'LOAN-001')?.note, 'Customer kept it, agreed');
  // Reopen clears note and return date, back to out.
  const reopened = reopenLoan(converted, 'LOAN-001');
  assert.equal(findLoan(reopened, 'LOAN-001')?.status, 'out');
  assert.equal(findLoan(reopened, 'LOAN-001')?.note, '');
  assert.equal(findLoan(reopened, 'LOAN-001')?.returnDate, '');
  // Reopening an out loan is a no-op; unknown ids are no-ops.
  assert.deepEqual(reopenLoan([base], 'LOAN-001'), normalizeLoanList([base]));
  assert.deepEqual(markLoanReturned([base], 'NOPE', '2026-01-18'), normalizeLoanList([base]));
});

test('overdue list: most overdue first, due today is not overdue', () => {
  const rows = [
    { ...base, id: 'L-1', expectedReturnDate: '2026-01-10' },
    { ...base, id: 'L-2', expectedReturnDate: '2026-01-01' },
    { ...base, id: 'L-3', expectedReturnDate: '2026-01-20' },
    { ...base, id: 'L-4', expectedReturnDate: '2026-01-05', status: 'returned', returnDate: '2026-01-06' },
    { ...base, id: 'L-5', expectedReturnDate: '2026-01-02', status: 'converted', note: 'kept' },
  ];
  const overdue = overdueLoans(rows, '2026-01-20');
  assert.deepEqual(overdue.map((row) => row.id), ['L-2', 'L-1']);
  assert.deepEqual(overdue.map((row) => row.daysOverdue), [19, 10]);
  assert.equal(overdueLoans(rows, 'not a date').length, 0);
  assert.equal(overdueLoans(rows, '2026-01-01').length, 0);
});

test('out list and filters: status, device, mohalla', () => {
  const rows = [
    base,
    { ...base, id: 'LOAN-002', deviceType: 'router', loanSerial: 'RTR-1', mohalla: 'Kishti', status: 'returned', returnDate: '2026-01-15' },
    { ...base, id: 'LOAN-003', deviceType: 'router', loanSerial: 'RTR-2', mohalla: '' },
  ];
  assert.deepEqual(outLoans(rows).map((row) => row.id), ['LOAN-001', 'LOAN-003']);
  assert.deepEqual(loansFiltered(rows, { deviceType: 'router' }).map((row) => row.id), ['LOAN-002', 'LOAN-003']);
  assert.deepEqual(loansFiltered(rows, { mohalla: 'bani' }).map((row) => row.id), ['LOAN-001']);
  assert.deepEqual(loansFiltered(rows, { mohalla: '__unassigned__' }).map((row) => row.id), ['LOAN-003']);
  // Annual Owner Summary cleanup (2026-11-13): the filter
  // placeholder now reads 'Filter by mohalla (or Unassigned)', so
  // the folded word matches the same no-mohalla rows as the
  // literal sentinel.
  assert.deepEqual(loansFiltered(rows, { mohalla: 'Unassigned' }).map((row) => row.id), ['LOAN-003']);
  assert.deepEqual(loansFiltered(rows, { mohalla: 'unassigned' }).map((row) => row.id), ['LOAN-003']);
  assert.deepEqual(loansFiltered(rows, { status: 'returned' }).map((row) => row.id), ['LOAN-002']);
});

test('summary exactness on one fixture', () => {
  const rows = [
    base,
    { ...base, id: 'LOAN-002', status: 'returned', returnDate: '2026-01-15' },
    { ...base, id: 'LOAN-003', status: 'converted', note: 'kept' },
    { ...base, id: 'LOAN-004', expectedReturnDate: '2026-01-01' },
  ];
  const summary = buildLoanSummary(rows, '2026-01-20');
  assert.equal(summary.total, 4);
  assert.equal(summary.out, 2);
  assert.equal(summary.returned, 1);
  assert.equal(summary.converted, 1);
  assert.equal(summary.overdue, 1);
  assert.match(loanSummaryText(summary), /4 loans recorded/);
  assert.match(loanSummaryText(summary), /1 overdue/);
});

test('non-mutation and no-ledger-field fence', () => {
  const before = JSON.parse(JSON.stringify([base]));
  const after = markLoanReturned([base], 'LOAN-001', '2026-01-18');
  assert.deepEqual([base], before);
  assert.notEqual(after, before);
  const keys = Object.keys(normalizeLoan(base));
  for (const forbidden of ['bill', 'billId', 'payment', 'paymentId', 'amount', 'amountCents', 'package', 'ticketStatus', 'repair', 'warranty', 'stock', 'stockCount']) {
    assert.ok(!keys.includes(forbidden), `loan record must not carry ${forbidden}`);
  }
  // Links are ids only, never rows.
  assert.equal(normalizeLoan(base)?.ticketId, 'T-101');
  assert.equal(normalizeLoan(base)?.connectionId, 'CON-7');
});

test('HTML escaping, CSV quoting, filename', () => {
  const tricky = { ...base, customerName: 'A <b> & "Q"', loanSerial: 'ONU, "X"' };
  const html = loanHtml([tricky]);
  assert.ok(!html.includes('<b>'));
  assert.ok(html.includes('&lt;b&gt;'));
  const csv = loanCsv([tricky]);
  assert.ok(csv.includes('"ONU, ""X"""'));
  assert.equal(loanFilename(), 'loan-tracker.csv');
  assert.match(loanHtml([]), /No loans recorded/);
});
