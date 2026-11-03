/**
 * plan38-bill-extension.test.js — Plan 38: one-time bill extension.
 * Pins:
 * - an extension is one bill (customer + bill month), an extended
 *   due date, a reason, and who granted it; a missing customer, a
 *   bill with neither month nor id, a bad date (2026-02-30 is
 *   rejected), an extended date not later than the original, or a
 *   blank reason is rejected, never stored half-formed;
 * - a second grant on the same bill without an operator note is
 *   refused and the list is unchanged; with a note it is granted
 *   and the latest grant is the active one;
 * - the reminder ladder (Plan 12) pauses for a bill until its
 *   extended date passes, and after that date the bill returns
 *   with the extended date as its due date and the original
 *   preserved — the grace shifts the date, it does not erase it;
 * - the module holds no amount, payment-ledger, Waada, or
 *   service-state field at all, and never rewrites a bill.
 * Synthetic data only; no bill, payment total, or Waada record is
 * ever rewritten by this plan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidBillExtensionDate,
  billExtensionDaysBetween,
  billExtensionKey,
  normalizeBillExtension,
  normalizeBillExtensions,
  extensionsForBill,
  activeBillExtension,
  grantBillExtension,
  ladderPositionForBill,
  isLadderPausedForBill,
  applyExtensionsToBills,
  billExtensionSummaryText,
  billExtensionFilename,
  billExtensionHtml,
  billExtensionCsv,
} from '../bill-extension.js';

const bill = (overrides = {}) => ({
  customerId: 'c1',
  billMonth: '2026-10',
  dueDate: '2026-10-05',
  balanceDue: 2500,
  ...overrides,
});

const ext = (overrides = {}) => ({
  customerId: 'c1',
  billMonth: '2026-10',
  originalDueDate: '2026-10-05',
  extendedDueDate: '2026-10-20',
  reason: 'Salary delayed',
  grantedBy: 'Owner',
  ...overrides,
});

test('date validation rejects 2026-02-30 and non-dates', () => {
  assert.equal(isValidBillExtensionDate('2026-02-30'), false);
  assert.equal(isValidBillExtensionDate('2026-02-28'), true);
  assert.equal(isValidBillExtensionDate('2024-02-29'), true);
  assert.equal(isValidBillExtensionDate('2023-02-29'), false);
  assert.equal(isValidBillExtensionDate('not-a-date'), false);
  assert.equal(isValidBillExtensionDate(null), false);
  assert.equal(billExtensionDaysBetween('2026-10-05', '2026-10-20'), 15);
  assert.equal(billExtensionDaysBetween('2026-10-05', '2026-02-30'), null);
});

test('bill key needs a customer and a month or id', () => {
  assert.equal(billExtensionKey({ customerId: 'c1', billMonth: '2026-10' }), 'c1|2026-10');
  assert.equal(billExtensionKey({ customerId: 'c1', billId: 'b9' }), 'c1|b9');
  assert.equal(billExtensionKey({ customerId: 'c1' }), '');
  assert.equal(billExtensionKey({ billMonth: '2026-10' }), '');
  assert.equal(billExtensionKey(null), '');
});

test('normalisation rejects half-formed records, never guesses', () => {
  assert.notEqual(normalizeBillExtension(ext()), null);
  assert.equal(normalizeBillExtension({ ...ext(), customerId: '' }), null);
  assert.equal(normalizeBillExtension({ ...ext(), billMonth: '' }), null);
  assert.equal(normalizeBillExtension({ ...ext(), originalDueDate: '2026-02-30' }), null);
  assert.equal(normalizeBillExtension({ ...ext(), extendedDueDate: '2026-10-05' }), null);
  assert.equal(normalizeBillExtension({ ...ext(), extendedDueDate: '2026-10-04' }), null);
  assert.equal(normalizeBillExtension({ ...ext(), reason: '   ' }), null);
  assert.equal(normalizeBillExtension(null), null);
  const cleaned = normalizeBillExtension({ ...ext(), grantedBy: '', grantedAt: '' });
  assert.equal(cleaned.grantedBy, null);
  assert.equal(cleaned.grantedAt, null);
  assert.deepEqual(normalizeBillExtensions([ext(), { ...ext(), reason: '' }, null]), [normalizeBillExtension(ext())]);
});

test('a normalised extension carries no amount, payment, or Waada field', () => {
  const cleaned = normalizeBillExtension(ext());
  assert.equal('amount' in cleaned, false);
  assert.equal('balanceDue' in cleaned, false);
  assert.equal('paymentId' in cleaned, false);
  assert.equal('waada' in cleaned, false);
  assert.equal('waadaDate' in cleaned, false);
  assert.equal('status' in cleaned, false);
});

test('first grant is granted; second without a note is refused unchanged', () => {
  const first = grantBillExtension([], ext());
  assert.equal(first.granted, true);
  assert.equal(first.refusal, null);
  assert.equal(first.extensions.length, 1);
  const second = grantBillExtension(first.extensions, ext({ extendedDueDate: '2026-10-28', reason: 'Still delayed' }));
  assert.equal(second.granted, false);
  assert.equal(second.refusal, 'second-extension-needs-note');
  assert.equal(second.extensions.length, 1);
  assert.equal(second.extensions[0].extendedDueDate, '2026-10-20');
});

test('second grant with a note is granted and becomes the active one', () => {
  const first = grantBillExtension([], ext());
  const second = grantBillExtension(
    first.extensions,
    ext({ extendedDueDate: '2026-10-28', reason: 'Still delayed' }),
    { secondExtensionNote: 'Owner agreed again after a call' },
  );
  assert.equal(second.granted, true);
  assert.equal(second.extensions.length, 2);
  assert.equal(activeBillExtension(second.extensions, { customerId: 'c1', billMonth: '2026-10' }).extendedDueDate, '2026-10-28');
  assert.equal(activeBillExtension(second.extensions, { customerId: 'c1', billMonth: '2026-10' }).secondNote, 'Owner agreed again after a call');
  assert.equal(extensionsForBill(second.extensions, { customerId: 'c1', billMonth: '2026-10' }).length, 2);
  assert.equal(activeBillExtension(second.extensions, { customerId: 'c2', billMonth: '2026-10' }), null);
});

test('invalid grants never change the list', () => {
  const first = grantBillExtension([], ext());
  const bad = grantBillExtension(first.extensions, { ...ext(), extendedDueDate: '2026-10-01' });
  assert.equal(bad.granted, false);
  assert.equal(bad.refusal, 'invalid');
  assert.equal(bad.extensions.length, 1);
});

test('granting never mutates the input list', () => {
  const input = [normalizeBillExtension(ext())];
  const snapshot = JSON.stringify(input);
  grantBillExtension(input, ext({ billMonth: '2026-11', originalDueDate: '2026-11-05', extendedDueDate: '2026-11-20' }));
  assert.equal(JSON.stringify(input), snapshot);
});

test('ladder pauses until the extended date passes, then returns on the extended date', () => {
  const list = grantBillExtension([], ext()).extensions;
  assert.equal(isLadderPausedForBill(bill(), list, '2026-10-19'), true);
  assert.equal(isLadderPausedForBill(bill(), list, '2026-10-20'), true);
  assert.equal(isLadderPausedForBill(bill(), list, '2026-10-21'), false);
  const paused = ladderPositionForBill(bill(), list, '2026-10-10');
  assert.equal(paused.paused, true);
  assert.equal(paused.dueDate, '2026-10-20');
  const returned = ladderPositionForBill(bill(), list, '2026-10-21');
  assert.equal(returned.paused, false);
  assert.equal(returned.dueDate, '2026-10-20');
  const none = ladderPositionForBill(bill(), [], '2026-10-10');
  assert.equal(none.paused, false);
  assert.equal(none.dueDate, '2026-10-05');
  assert.equal(none.extension, null);
  const badToday = ladderPositionForBill(bill(), list, 'not-a-date');
  assert.equal(badToday.paused, false);
  assert.equal(badToday.dueDate, '2026-10-05');
});

test('applyExtensionsToBills pauses, swaps, and preserves the original', () => {
  const list = grantBillExtension([], ext()).extensions;
  const bills = [bill(), bill({ customerId: 'c2', billMonth: '2026-10', dueDate: '2026-10-05' })];
  const paused = applyExtensionsToBills(bills, list, '2026-10-10');
  assert.equal(paused.bills.length, 1);
  assert.equal(paused.bills[0].customerId, 'c2');
  assert.equal(paused.paused.length, 1);
  assert.equal(paused.paused[0].customerId, 'c1');
  assert.deepEqual(paused.counts, { total: 2, paused: 1, extended: 0, unaffected: 1 });
  const returned = applyExtensionsToBills(bills, list, '2026-10-21');
  assert.equal(returned.bills.length, 2);
  const c1 = returned.bills.find((b) => b.customerId === 'c1');
  assert.equal(c1.dueDate, '2026-10-20');
  assert.equal(c1.originalDueDate, '2026-10-05');
  assert.equal(c1.balanceDue, 2500);
  assert.equal(returned.counts.extended, 1);
  const unchanged = applyExtensionsToBills(bills, list, 'not-a-date');
  assert.equal(unchanged.bills.length, 2);
  assert.equal(unchanged.paused.length, 0);
  assert.equal(unchanged.bills[0].dueDate, '2026-10-05');
  assert.equal(JSON.stringify(bills[0].dueDate), '"2026-10-05"');
});

test('summary text, filename, HTML escaping, and CSV quoting', () => {
  assert.equal(billExtensionSummaryText([], '2026-10-10'), 'No bill extensions recorded.');
  const list = grantBillExtension([], ext()).extensions;
  assert.match(billExtensionSummaryText(list, '2026-10-10'), /1 extension on 1 bill/);
  assert.match(billExtensionSummaryText(list, '2026-10-10'), /pausing the reminder ladder/);
  assert.match(billExtensionSummaryText(list, '2026-10-21'), /1 extension on 1 bill/);
  assert.doesNotMatch(billExtensionSummaryText(list, '2026-10-21'), /pausing/);
  assert.equal(billExtensionFilename('2026-10-10'), 'bill-extensions-2026-10-10.csv');
  assert.equal(billExtensionFilename('bad'), 'bill-extensions-unknown-date.csv');
  const html = billExtensionHtml([ext({ reason: '<b>urgent</b> & "late"' })], { names: { c1: 'Ahmed <Test>' }, today: '2026-10-10' });
  assert.doesNotMatch(html, /<b>urgent<\/b>/);
  assert.match(html, /Ahmed &lt;Test&gt;/);
  assert.match(html, /Ladder paused until extended date/);
  assert.equal(billExtensionHtml([], {}), '<p class="empty-state">No bill extensions recorded.</p>');
  const csv = billExtensionCsv([ext({ reason: 'Salary, delayed "again"' })], { names: { c1: 'Ahmed' } });
  assert.match(csv, /"Salary, delayed ""again"""/);
  assert.match(csv, /^Customer, Customer name, Bill month/);
});
