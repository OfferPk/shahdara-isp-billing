/**
 * plan80-warranty-returns.test.js — Plan 80: equipment warranty
 * and supplier return (RMA) log.
 * Pins:
 * - every return carries exactly one serial, one supplier, one
 *   reference field, and one status; half-formed records are
 *   refused outright, never stored half-formed;
 * - the awaiting list shows exactly the units still with the
 *   supplier on the same fixture, oldest first;
 * - recording a replacement links the new serial without
 *   deleting the faulty unit's history;
 * - a rejection needs its reason, a replacement needs its
 *   serial, and terminal records never move again except by
 *   reopen;
 * - log actions never change any bill, payment, or customer
 *   record, so the module holds no bill, payment, purchase, or
 *   stock field;
 * - impossible dates (2026-02-30) are never stored as a date.
 * Synthetic data only; no bill, payment, stock, or customer
 * record is ever changed by this plan.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RMA_STATUSES,
  RMA_STATUS_LABELS,
  RMA_DEVICE_TYPES,
  validRmaDate,
  normalizeRma,
  normalizeRmaList,
  findRma,
  upsertRma,
  removeRma,
  advanceRmaToAwaiting,
  markRmaReplaced,
  markRmaRepaired,
  markRmaRejected,
  reopenRma,
  rmasFiltered,
  awaitingRmas,
  buildRmaSummary,
  rmaSummaryText,
  rmaHtml,
  rmaCsv,
  rmaFilename,
} from '../warranty-returns.js';

const base = {
  id: 'RMA-001',
  serial: 'ONU-111',
  deviceType: 'onu',
  supplier: 'Supplier A',
  faultNote: 'No power',
  rmaReference: 'RMA-9001',
  dateSent: '2026-01-05',
  status: 'sent',
};

test('strict dates: impossible dates are refused, valid dates kept', () => {
  assert.equal(validRmaDate('2026-02-30'), null);
  assert.equal(validRmaDate('2026-01-05'), '2026-01-05');
  assert.equal(validRmaDate('not a date'), null);
  assert.equal(normalizeRma({ ...base, dateSent: '2026-02-30' }), null);
  assert.equal(normalizeRma({ ...base, dateSent: '' }).dateSent, null);
});

test('status and device catalogues are fixed', () => {
  assert.deepEqual(RMA_STATUSES, ['sent', 'awaiting', 'replaced', 'repaired', 'rejected']);
  assert.deepEqual(RMA_DEVICE_TYPES, ['onu', 'router', 'other']);
  assert.equal(RMA_STATUS_LABELS.replaced, 'Replaced');
});

test('half-formed records are refused outright', () => {
  assert.equal(normalizeRma({ ...base, id: '' }), null);
  assert.equal(normalizeRma({ ...base, serial: '' }), null);
  assert.equal(normalizeRma({ ...base, supplier: '' }), null);
  assert.equal(normalizeRma({ ...base, deviceType: 'splitter' }), null);
  assert.equal(normalizeRma({ ...base, status: 'lost' }), null);
  assert.equal(normalizeRma(null), null);
  assert.equal(normalizeRmaList([base, { ...base, id: '' }]).length, 1);
});

test('reference is kept where given and null otherwise, never guessed', () => {
  assert.equal(normalizeRma(base).rmaReference, 'RMA-9001');
  assert.equal(normalizeRma({ ...base, rmaReference: '' }).rmaReference, null);
  assert.equal(normalizeRma({ ...base, rmaReference: undefined }).rmaReference, null);
});

test('rejected needs a reason, replaced needs a replacement serial', () => {
  const list = [base];
  assert.equal(markRmaRejected(list, 'RMA-001', '')[0].status, 'sent');
  assert.equal(markRmaRejected(list, 'RMA-001', 'Out of warranty')[0].status, 'rejected');
  assert.equal(markRmaRejected(list, 'RMA-001', 'Out of warranty')[0].rejectionReason, 'Out of warranty');
  assert.equal(markRmaReplaced(list, 'RMA-001', '')[0].status, 'sent');
  const replaced = markRmaReplaced(list, 'RMA-001', 'ONU-222', 'CONN-9', '2026-02-01');
  assert.equal(replaced[0].status, 'replaced');
  assert.equal(replaced[0].replacementSerial, 'ONU-222');
  assert.equal(replaced[0].connectionId, 'CONN-9');
  assert.equal(replaced[0].dateReturned, '2026-02-01');
});

test('recording a replacement keeps the faulty unit history intact', () => {
  const replaced = markRmaReplaced([base], 'RMA-001', 'ONU-222');
  assert.equal(replaced[0].serial, 'ONU-111');
  assert.equal(replaced[0].faultNote, 'No power');
  assert.equal(replaced[0].supplier, 'Supplier A');
  assert.equal(replaced[0].rmaReference, 'RMA-9001');
  assert.equal(replaced[0].dateSent, '2026-01-05');
});

test('status moves only from awaiting states; terminal records stay put', () => {
  const list = [base];
  assert.equal(advanceRmaToAwaiting(list, 'RMA-001')[0].status, 'awaiting');
  assert.equal(advanceRmaToAwaiting(list, 'RMA-001')[0].status, 'awaiting');
  const repaired = markRmaRepaired(list, 'RMA-001', '2026-01-20');
  assert.equal(repaired[0].status, 'repaired');
  assert.deepEqual(markRmaRejected(repaired, 'RMA-001', 'Too late'), repaired);
  assert.deepEqual(advanceRmaToAwaiting(repaired, 'RMA-001'), repaired);
  assert.equal(markRmaRepaired(list, 'RMA-001', '2026-02-30')[0].status, 'sent');
});

test('reopen returns a terminal record to awaiting and clears outcome fields', () => {
  const replaced = markRmaReplaced([base], 'RMA-001', 'ONU-222', 'CONN-9', '2026-02-01');
  const reopened = reopenRma(replaced, 'RMA-001');
  assert.equal(reopened[0].status, 'awaiting');
  assert.equal(reopened[0].replacementSerial, null);
  assert.equal(reopened[0].dateReturned, null);
  assert.equal(reopened[0].serial, 'ONU-111');
  assert.equal(reopenRma([base], 'RMA-001')[0].status, 'sent');
});

test('awaiting list shows exactly the units still with the supplier, oldest first', () => {
  const list = [
    { ...base, id: 'RMA-003', dateSent: '2026-01-10', status: 'awaiting' },
    { ...base, id: 'RMA-001', dateSent: '2026-01-05', status: 'sent' },
    { ...base, id: 'RMA-002', dateSent: '2026-01-02', status: 'replaced', replacementSerial: 'ONU-999' },
    { ...base, id: 'RMA-004', dateSent: '', status: 'sent' },
    { ...base, id: 'RMA-005', dateSent: '2026-01-01', status: 'repaired' },
  ];
  const awaiting = awaitingRmas(list, '2026-01-20');
  assert.deepEqual(awaiting.map((row) => row.id), ['RMA-001', 'RMA-003', 'RMA-004']);
  assert.equal(awaiting[0].daysAway, 15);
  assert.equal(awaiting[1].daysAway, 10);
  assert.equal(awaiting[2].daysAway, null);
});

test('upsert, find, remove, and non-mutation', () => {
  const list = [base];
  const updated = upsertRma(list, { ...base, faultNote: 'Intermittent' });
  assert.equal(updated.length, 1);
  assert.equal(updated[0].faultNote, 'Intermittent');
  assert.equal(list[0].faultNote, 'No power');
  assert.equal(findRma(updated, 'RMA-001').serial, 'ONU-111');
  assert.equal(findRma(updated, 'RMA-404'), null);
  assert.deepEqual(removeRma(updated, 'RMA-001'), []);
  assert.equal(upsertRma(list, { ...base, id: '' }).length, 1);
});

test('filters by status, supplier, and device', () => {
  const list = [
    base,
    { ...base, id: 'RMA-002', supplier: 'Supplier B', deviceType: 'router', status: 'awaiting' },
    { ...base, id: 'RMA-003', status: 'rejected', rejectionReason: 'No fault found' },
  ];
  assert.equal(rmasFiltered(list, { status: 'awaiting' }).length, 1);
  assert.equal(rmasFiltered(list, { supplier: 'supplier b' }).length, 1);
  assert.equal(rmasFiltered(list, { deviceType: 'router' }).length, 1);
  assert.equal(rmasFiltered(list, {}).length, 3);
});

test('summary counts by status and awaiting total', () => {
  const list = [
    base,
    { ...base, id: 'RMA-002', status: 'awaiting' },
    { ...base, id: 'RMA-003', status: 'replaced', replacementSerial: 'ONU-999' },
  ];
  const summary = buildRmaSummary(list);
  assert.equal(summary.total, 3);
  assert.equal(summary.awaiting, 2);
  assert.equal(summary.byStatus.sent, 1);
  assert.equal(summary.byStatus.replaced, 1);
  assert.match(rmaSummaryText(summary), /3 warranty returns/);
  assert.equal(rmaSummaryText(buildRmaSummary([])), 'No warranty returns recorded yet.');
});

test('no bill, payment, purchase, or stock field on a normalized record', () => {
  const keys = Object.keys(normalizeRma(base));
  for (const banned of ['bill', 'payment', 'purchase', 'stock', 'customer', 'amount', 'price', 'cost']) {
    assert.ok(!keys.some((key) => key.toLowerCase().includes(banned)), `banned field present: ${banned}`);
  }
});

test('HTML escaping, CSV quoting, and filename', () => {
  const entry = { ...base, faultNote: 'Bad "unit", <test>' };
  const html = rmaHtml([entry]);
  assert.ok(!html.includes('<test>'));
  assert.ok(html.includes('&quot;unit&quot;'));
  const csv = rmaCsv([entry]);
  assert.ok(csv.startsWith('id,serial,device,supplier,reference,date_sent,status,'));
  assert.ok(csv.includes('"Bad ""unit"", <test>"'));
  assert.equal(rmaFilename(), 'warranty-returns.csv');
  // More Tab Operational Registries polish (§2 dedup): the summary
  // line is now the single empty state, so the body renders nothing
  // at 0 instead of repeating the same sentence a second time.
  assert.equal(rmaHtml([]), '');
});
