/**
 * plan81-recovery-queue.test.js — Plan 81: end-of-service equipment
 * recovery queue.
 * Pins:
 * - the queue lists exactly the departed customers with unreturned
 *   ISP-owned equipment on the same fixture, ordered by time since
 *   service ended (oldest ended first, undated last);
 * - marking a device collected removes it from the queue and keeps
 *   the collection date and collector; a not-returned case keeps
 *   its reason visible and never silently closes;
 * - queue actions never alter any bill, payment, or
 *   departed-customer record, so the module holds no bill,
 *   payment, charge, package, or ticket field;
 * - half-formed records are refused outright, never stored
 *   half-formed; impossible dates (2026-02-30) are never stored
 *   as a date.
 * Synthetic data only; no bill, payment, or customer record is
 * ever changed by this plan.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RECOVERY_STATUSES,
  RECOVERY_STATUS_LABELS,
  RECOVERY_DEVICE_TYPES,
  validRecoveryDate,
  canonicalRecoveryMohalla,
  normalizeRecovery,
  normalizeRecoveryList,
  findRecovery,
  upsertRecovery,
  removeRecovery,
  markRecoveryCollected,
  markRecoveryNotReturned,
  reopenRecovery,
  buildRecoveryQueue,
  recoveryQueueFiltered,
  buildRecoverySummary,
  recoverySummaryText,
  recoveryHtml,
  recoveryCsv,
  recoveryFilename,
} from '../recovery-queue.js';

const TODAY = '2026-01-20';

function departedFixture() {
  return [
    { customerId: 'c1', customerName: 'Ayesha', mohalla: 'Bani', dateEnded: '2026-01-01', exitReason: 'moving_house' },
    { customerId: 'c2', customerName: 'Bilal', mohalla: 'Kishti', dateEnded: '2026-01-10' },
    { customerId: 'c3', customerName: 'Chand', mohalla: '', dateEnded: null },
    { customerId: 'c4', customerName: 'Dania', mohalla: 'Chamyaa', dateEnded: '2025-12-20' },
  ];
}

function equipmentFixture() {
  return [
    { customerId: 'c1', serial: 'ONU-001', deviceType: 'onu', ispOwned: true },
    { customerId: 'c2', serial: 'RT-002', deviceType: 'router', ispOwned: true },
    { customerId: 'c3', serial: 'ONU-003', deviceType: 'onu' },
    { customerId: 'c4', serial: 'ONU-004', deviceType: 'onu', ispOwned: true },
    { customerId: 'c4', serial: 'ONU-005', deviceType: 'onu', ispOwned: false },
    { customerId: 'c9', serial: 'ONU-009', deviceType: 'onu', ispOwned: true },
    { customerId: 'c1', serial: '', deviceType: 'onu', ispOwned: true },
  ];
}

test('strict dates: impossible dates are refused, real dates kept', () => {
  assert.equal(validRecoveryDate('2026-02-30'), null);
  assert.equal(validRecoveryDate('2026-01-20'), '2026-01-20');
  assert.equal(validRecoveryDate('not a date'), null);
  assert.equal(validRecoveryDate(''), null);
});

test('catalogues are fixed: three statuses, three device types', () => {
  assert.deepEqual(RECOVERY_STATUSES, ['pending', 'collected', 'not_returned']);
  assert.deepEqual(RECOVERY_DEVICE_TYPES, ['onu', 'router', 'other']);
  assert.equal(RECOVERY_STATUS_LABELS.collected, 'Collected');
});

test('canonical mohalla: aliases resolve, unassigned never dropped', () => {
  assert.equal(canonicalRecoveryMohalla('Mohalla Bani').key, 'BANII');
  assert.equal(canonicalRecoveryMohalla('banii').key, 'BANII');
  assert.equal(canonicalRecoveryMohalla('kishti').key, 'KISHTII');
  assert.equal(canonicalRecoveryMohalla('chamyaa').key, 'CHAMYAAA');
  assert.equal(canonicalRecoveryMohalla('').key, '__unassigned__');
  assert.equal(canonicalRecoveryMohalla('   ').key, '__unassigned__');
});

test('half-formed records are refused outright', () => {
  assert.equal(normalizeRecovery(null), null);
  assert.equal(normalizeRecovery({ customerId: 'c1' }), null);
  assert.equal(normalizeRecovery({ customerId: 'c1', serial: 'S1', deviceType: 'onu', status: 'pending', dateEnded: '2026-02-30' }), null);
  assert.equal(normalizeRecovery({ customerId: 'c1', serial: 'S1', deviceType: 'dish', status: 'pending' }), null);
  assert.equal(normalizeRecovery({ customerId: 'c1', serial: 'S1', deviceType: 'onu', status: 'lost' }), null);
  assert.equal(normalizeRecovery({ customerId: 'c1', serial: 'S1', deviceType: 'onu', status: 'collected' }), null);
  assert.equal(normalizeRecovery({ customerId: 'c1', serial: 'S1', deviceType: 'onu', status: 'collected', collectedDate: '2026-01-15' }), null);
  assert.equal(normalizeRecovery({ customerId: 'c1', serial: 'S1', deviceType: 'onu', status: 'not_returned' }), null);
});

test('id defaults to customerId|serial and upsert/find/remove work', () => {
  const record = normalizeRecovery({ customerId: 'c1', serial: 'ONU-001', deviceType: 'onu', status: 'pending' });
  assert.equal(record.id, 'c1|ONU-001');
  const list = upsertRecovery([], record);
  assert.equal(findRecovery(list, 'c1|ONU-001').serial, 'ONU-001');
  assert.equal(findRecovery(list, 'nobody'), null);
  assert.equal(removeRecovery(list, 'c1|ONU-001').length, 0);
  assert.equal(upsertRecovery(list, { customerId: 'c1' }).length, 1);
  assert.equal(normalizeRecoveryList([record, record]).length, 1);
});

test('queue lists exactly the departed with unreturned ISP-owned equipment', () => {
  const queue = buildRecoveryQueue({ departed: departedFixture(), equipment: equipmentFixture(), recoveries: [], today: TODAY });
  assert.deepEqual(queue.map((entry) => entry.serial), ['ONU-004', 'ONU-001', 'RT-002', 'ONU-003']);
  assert.ok(!queue.some((entry) => entry.serial === 'ONU-005'), 'customer-owned device is never queued');
  assert.ok(!queue.some((entry) => entry.serial === 'ONU-009'), 'non-departed customer is never queued');
  assert.ok(!queue.some((entry) => entry.serial === ''), 'serial-less row is never queued');
});

test('queue ordering: oldest ended first, undated last, days since ended exact', () => {
  const queue = buildRecoveryQueue({ departed: departedFixture(), equipment: equipmentFixture(), recoveries: [], today: TODAY });
  assert.equal(queue[0].serial, 'ONU-004');
  assert.equal(queue[0].daysSinceEnded, 31);
  assert.equal(queue[1].serial, 'ONU-001');
  assert.equal(queue[1].daysSinceEnded, 19);
  assert.equal(queue[2].serial, 'RT-002');
  assert.equal(queue[2].daysSinceEnded, 10);
  assert.equal(queue[3].serial, 'ONU-003');
  assert.equal(queue[3].daysSinceEnded, null);
});

test('collected devices leave the queue; not-returned stays with its reason', () => {
  const recoveries = [
    { customerId: 'c1', serial: 'ONU-001', deviceType: 'onu', status: 'collected', collectedDate: '2026-01-18', collector: 'Saad', visitId: 'V-9' },
    { customerId: 'c2', serial: 'RT-002', deviceType: 'router', status: 'not_returned', reason: 'House locked, nobody home' },
  ];
  const queue = buildRecoveryQueue({ departed: departedFixture(), equipment: equipmentFixture(), recoveries, today: TODAY });
  assert.ok(!queue.some((entry) => entry.serial === 'ONU-001'), 'collected device leaves the queue');
  const stuck = queue.find((entry) => entry.serial === 'RT-002');
  assert.equal(stuck.status, 'not_returned');
  assert.equal(stuck.reason, 'House locked, nobody home');
});

test('status moves: only pending moves, reopen clears outcome fields', () => {
  const base = [{ id: 'c1|ONU-001', customerId: 'c1', serial: 'ONU-001', deviceType: 'onu', status: 'pending' }];
  const collected = markRecoveryCollected(base, 'c1|ONU-001', '2026-01-18', 'Saad', 'V-9');
  assert.equal(collected[0].status, 'collected');
  assert.equal(collected[0].collector, 'Saad');
  assert.equal(collected[0].visitId, 'V-9');
  assert.equal(markRecoveryCollected(collected, 'c1|ONU-001', '2026-01-19', 'Saad').length, 1);
  assert.equal(markRecoveryCollected(collected, 'c1|ONU-001', '2026-01-19', 'Saad')[0].collectedDate, '2026-01-18');
  const stuck = markRecoveryNotReturned(base, 'c1|ONU-001', 'Refused entry');
  assert.equal(stuck[0].status, 'not_returned');
  assert.equal(stuck[0].reason, 'Refused entry');
  assert.equal(markRecoveryNotReturned(base, 'c1|ONU-001', '').length, 1);
  assert.equal(markRecoveryNotReturned(base, 'c1|ONU-001', '')[0].status, 'pending');
  const reopened = reopenRecovery(collected, 'c1|ONU-001');
  assert.equal(reopened[0].status, 'pending');
  assert.equal(reopened[0].collectedDate, null);
  assert.equal(reopened[0].collector, null);
  assert.equal(reopened[0].visitId, null);
  assert.equal(reopenRecovery(base, 'c1|ONU-001')[0].status, 'pending');
});

test('queue filters by status and mohalla, including __unassigned__', () => {
  const queue = buildRecoveryQueue({ departed: departedFixture(), equipment: equipmentFixture(), recoveries: [], today: TODAY });
  assert.equal(recoveryQueueFiltered(queue, { status: 'pending' }).length, 4);
  assert.deepEqual(recoveryQueueFiltered(queue, { mohalla: 'bani' }).map((entry) => entry.serial), ['ONU-001']);
  assert.deepEqual(recoveryQueueFiltered(queue, { mohalla: '__unassigned__' }).map((entry) => entry.serial), ['ONU-003']);
  // More Tab Operational Registries polish (§1): the filter
  // placeholder invites the word "Unassigned", so the folded word
  // matches the same no-mohalla rows as the literal sentinel.
  assert.deepEqual(recoveryQueueFiltered(queue, { mohalla: 'Unassigned' }).map((entry) => entry.serial), ['ONU-003']);
  assert.deepEqual(recoveryQueueFiltered(queue, { mohalla: 'unassigned' }).map((entry) => entry.serial), ['ONU-003']);
  assert.equal(recoveryQueueFiltered(queue, { mohalla: 'nowhere' }).length, 0);
});

test('summary counts queue and history exactly', () => {
  const queue = buildRecoveryQueue({ departed: departedFixture(), equipment: equipmentFixture(), recoveries: [], today: TODAY });
  const summary = buildRecoverySummary(queue, [
    { customerId: 'c1', serial: 'ONU-001', deviceType: 'onu', status: 'collected', collectedDate: '2026-01-18', collector: 'Saad' },
  ]);
  assert.equal(summary.queued, 4);
  assert.equal(summary.pending, 4);
  assert.equal(summary.notReturned, 0);
  assert.equal(summary.collected, 1);
  assert.equal(summary.total, 1);
  assert.match(recoverySummaryText(summary), /4 devices still to recover/);
  assert.match(recoverySummaryText({ queued: 0, pending: 0, notReturned: 0, collected: 1, total: 1 }), /every recorded device is collected/);
});

test('non-mutation and no ledger field fence', () => {
  const input = { departed: departedFixture(), equipment: equipmentFixture(), recoveries: [], today: TODAY };
  const snapshot = JSON.stringify(input);
  buildRecoveryQueue(input);
  assert.equal(JSON.stringify(input), snapshot);
  const record = normalizeRecovery({ customerId: 'c1', serial: 'ONU-001', deviceType: 'onu', status: 'pending' });
  const forbidden = ['bill', 'payment', 'charge', 'package', 'ticket', 'amount', 'price', 'stock'];
  for (const key of Object.keys(record)) {
    assert.ok(!forbidden.includes(key), `forbidden field ${key} on a recovery record`);
  }
});

test('HTML escaping, CSV quoting, and filename', () => {
  const queue = buildRecoveryQueue({
    departed: [{ customerId: 'c1', customerName: '<Ayesha & Co>', mohalla: 'Bani', dateEnded: '2026-01-01' }],
    equipment: [{ customerId: 'c1', serial: 'ONU-001', deviceType: 'onu' }],
    recoveries: [],
    today: TODAY,
  });
  assert.ok(!recoveryHtml(queue).includes('<Ayesha'));
  assert.ok(recoveryHtml(queue).includes('&lt;Ayesha &amp; Co&gt;'));
  const csv = recoveryCsv([{ ...queue[0], reason: 'Said "no, thanks", left' }]);
  assert.ok(csv.includes('"Said ""no, thanks"", left"'));
  assert.equal(recoveryFilename(), 'equipment-recovery-queue.csv');
});
