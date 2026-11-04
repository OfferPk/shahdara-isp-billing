/**
 * plan77-deposit-register.test.js — Plan 77: customer equipment
 * deposit register.
 * Pins:
 * - every deposit carries exactly one device, amount, date, and
 *   status; half-formed records are refused outright, never
 *   stored half-formed;
 * - a refunded deposit must link to the payment or concession
 *   that returned it, and an applied deposit must carry the
 *   operator-recorded reason;
 * - the total held sums correctly on the same fixture, in
 *   integer cents, and changing a status never rewrites a bill
 *   or a past payment — the module holds no such field of its
 *   own, and the stored link is only an id, never a payment row;
 * - impossible dates (2026-02-30) are never stored as a date;
 * - a stored record re-read through the normaliser keeps its
 *   amount (cents fields are used as-is, never converted twice).
 * Synthetic data only; no bill, payment, or customer record is
 * ever changed by this plan.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEPOSIT_DEVICE_TYPES,
  DEPOSIT_DEVICE_TYPE_LABELS,
  DEPOSIT_STATUSES,
  DEPOSIT_STATUS_LABELS,
  validDepositDate,
  depositMohallaKey,
  normalizeDeposit,
  normalizeDepositList,
  findDeposit,
  upsertDeposit,
  removeDeposit,
  markDepositRefunded,
  markDepositApplied,
  reopenDeposit,
  depositsFiltered,
  heldDeposits,
  buildDepositSummary,
  depositSummaryText,
  depositHtml,
  depositCsv,
  depositFilename,
} from '../deposit-register.js';

const base = {
  id: 'DEP-001',
  customerId: 'C-001',
  customerName: 'Ahmed',
  deviceType: 'onu',
  serial: 'ONU-1234',
  amount: 2000,
  dateTaken: '2026-01-05',
  status: 'held',
  mohalla: 'Bani',
};

test('strict dates: impossible dates refused, valid dates kept', () => {
  assert.equal(validDepositDate('2026-02-30'), null);
  assert.equal(validDepositDate('2026-02-28'), '2026-02-28');
  assert.equal(validDepositDate('not-a-date'), null);
  assert.equal(validDepositDate(''), null);
});

test('catalogues: three device types and three statuses, all labelled', () => {
  assert.deepEqual(DEPOSIT_DEVICE_TYPES, ['onu', 'router', 'other']);
  assert.deepEqual(DEPOSIT_STATUSES, ['held', 'refunded', 'applied']);
  for (const key of DEPOSIT_DEVICE_TYPES) assert.ok(DEPOSIT_DEVICE_TYPE_LABELS[key]);
  for (const key of DEPOSIT_STATUSES) assert.ok(DEPOSIT_STATUS_LABELS[key]);
});

test('half-formed records refused outright, never stored half-formed', () => {
  const bad = [
    { ...base, id: '' },
    { ...base, customerId: '' },
    { ...base, deviceType: 'dish' },
    { ...base, serial: '' },
    { ...base, amount: 0 },
    { ...base, amount: -500 },
    { ...base, amount: '' },
    { ...base, amount: true },
    { ...base, dateTaken: '2026-02-30' },
    { ...base, dateTaken: '' },
    { ...base, status: 'lost' },
    { ...base, status: 'refunded' },
    { ...base, status: 'applied' },
  ];
  for (const row of bad) assert.equal(normalizeDeposit(row), null, JSON.stringify(row));
  assert.equal(normalizeDeposit({ ...base, status: 'refunded', linkedId: 'PAY-9' })?.status, 'refunded');
  assert.equal(normalizeDeposit({ ...base, status: 'applied', reason: 'Device not returned' })?.status, 'applied');
});

test('amounts: rupees convert once, cents fields are used as-is on re-read', () => {
  assert.equal(normalizeDeposit(base)?.amountCents, 200000);
  assert.equal(normalizeDeposit({ ...base, amount: 333.33 })?.amountCents, 33333);
  const stored = normalizeDeposit(base);
  assert.equal(normalizeDeposit(stored)?.amountCents, 200000);
  assert.equal(normalizeDeposit({ ...base, amountCents: 150050 })?.amountCents, 150050);
});

test('mohalla canonical keys mirror the Plan T rule', () => {
  assert.equal(depositMohallaKey('bani'), 'BANII');
  assert.equal(depositMohallaKey('Mohalla Kishti'), 'KISHTII');
  assert.equal(depositMohallaKey('chamyaa'), 'CHAMYAAA');
  assert.equal(depositMohallaKey(''), null);
  assert.equal(depositMohallaKey('Gulshan'), 'GULSHAN');
});

test('upsert, find, and remove keep one record per deposit', () => {
  let list = upsertDeposit([], base);
  assert.equal(list.length, 1);
  assert.equal(findDeposit(list, 'DEP-001')?.serial, 'ONU-1234');
  list = upsertDeposit(list, { ...base, serial: 'ONU-9999' });
  assert.equal(list.length, 1);
  assert.equal(findDeposit(list, 'DEP-001')?.serial, 'ONU-9999');
  list = upsertDeposit(list, { ...base, id: '' });
  assert.equal(list.length, 1);
  list = removeDeposit(list, 'DEP-001');
  assert.equal(list.length, 0);
  assert.equal(findDeposit(list, 'DEP-001'), null);
});

test('status moves: only held deposits move, and only with their required field', () => {
  const list = upsertDeposit([], base);
  assert.deepEqual(markDepositRefunded(list, 'DEP-001', ''), list);
  const refunded = markDepositRefunded(list, 'DEP-001', 'PAY-9');
  assert.equal(findDeposit(refunded, 'DEP-001')?.status, 'refunded');
  assert.equal(findDeposit(refunded, 'DEP-001')?.linkedId, 'PAY-9');
  // Terminal: a refunded deposit cannot be applied again.
  assert.equal(findDeposit(markDepositApplied(refunded, 'DEP-001', 'No return'), 'DEP-001')?.status, 'refunded');
  const applied = markDepositApplied(list, 'DEP-001', 'Device not returned');
  assert.equal(findDeposit(applied, 'DEP-001')?.status, 'applied');
  assert.equal(findDeposit(applied, 'DEP-001')?.reason, 'Device not returned');
  assert.deepEqual(markDepositApplied(list, 'DEP-001', ''), list);
  // Reopen clears the trail and returns the deposit to held.
  const reopened = reopenDeposit(refunded, 'DEP-001');
  assert.equal(findDeposit(reopened, 'DEP-001')?.status, 'held');
  assert.equal(findDeposit(reopened, 'DEP-001')?.linkedId, '');
});

test('held list and filters: oldest first, status/device/mohalla filters', () => {
  const rows = [
    { ...base, id: 'DEP-002', dateTaken: '2026-03-01', deviceType: 'router', serial: 'R-1', mohalla: 'Kishti' },
    { ...base, id: 'DEP-003', dateTaken: '2026-01-10', status: 'refunded', linkedId: 'PAY-1' },
    { ...base, id: 'DEP-004', dateTaken: '2026-02-01', mohalla: '' },
    base,
  ];
  const held = heldDeposits(rows);
  assert.deepEqual(held.map((row) => row.id), ['DEP-001', 'DEP-004', 'DEP-002']);
  assert.deepEqual(depositsFiltered(rows, { deviceType: 'router' }).map((row) => row.id), ['DEP-002']);
  assert.deepEqual(depositsFiltered(rows, { mohalla: 'kishti' }).map((row) => row.id), ['DEP-002']);
  assert.deepEqual(depositsFiltered(rows, { mohalla: '__unassigned__' }).map((row) => row.id), ['DEP-004']);
  assert.deepEqual(depositsFiltered(rows, { status: 'refunded' }).map((row) => row.id), ['DEP-003']);
});

test('summary: total held sums exactly in integer cents', () => {
  const rows = [
    { ...base, id: 'DEP-001', amount: 333.33 },
    { ...base, id: 'DEP-002', amount: 166.67 },
    { ...base, id: 'DEP-003', status: 'refunded', linkedId: 'PAY-1', amount: 1000 },
    { ...base, id: 'DEP-004', status: 'applied', reason: 'Device kept', amount: 500 },
  ];
  const summary = buildDepositSummary(rows);
  assert.equal(summary.total, 4);
  assert.equal(summary.held, 2);
  assert.equal(summary.totalHeldCents, 50000);
  assert.equal(summary.totalRefundedCents, 100000);
  assert.equal(summary.totalAppliedCents, 50000);
  assert.equal(summary.byDeviceType.onu, 4);
  assert.match(depositSummaryText(summary), /2 held \(Rs\. 500\.00\)/);
});

test('non-mutation and no-ledger-field fence', () => {
  const input = { ...base };
  const snapshot = JSON.stringify(input);
  const entry = normalizeDeposit(input);
  assert.equal(JSON.stringify(input), snapshot);
  const keys = Object.keys(entry).sort();
  for (const forbidden of ['bill', 'payment', 'waada', 'securityDeposit', 'depositOffsets', 'depositSettlement']) {
    assert.ok(!keys.includes(forbidden), `fence: ${forbidden} must not appear`);
  }
  // The stored link is only an id, never a payment row.
  const refunded = normalizeDeposit({ ...base, status: 'refunded', linkedId: 'PAY-9' });
  assert.equal(typeof refunded.linkedId, 'string');
  assert.equal(refunded.linkedId, 'PAY-9');
  const list = upsertDeposit([], base);
  const before = JSON.stringify(list);
  markDepositRefunded(list, 'DEP-001', 'PAY-9');
  assert.equal(JSON.stringify(list), before);
});

test('HTML escaping, CSV quoting, and filename', () => {
  const row = { ...base, customerName: 'A <b>& "Q"</b>', serial: 'S,1' };
  const html = depositHtml([row]);
  assert.ok(!html.includes('<b>'));
  assert.ok(html.includes('&lt;b&gt;'));
  const csv = depositCsv([row]);
  assert.ok(csv.includes('"A <b>& ""Q""</b>"'));
  assert.ok(csv.includes('"S,1"'));
  assert.equal(depositFilename(), 'deposit-register.csv');
  assert.equal(depositHtml([]), '<p class="empty-state">No deposits recorded.</p>');
});
