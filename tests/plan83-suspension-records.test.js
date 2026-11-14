/**
 * plan83-suspension-records.test.js — Plan 83: non-payment
 * suspension record and reconnection checklist.
 * Pins:
 * - each suspension carries exactly one customer, suspension
 *   date, reason (non-payment), and the arrears figure at
 *   suspension; half-formed records are refused outright,
 *   never stored half-formed;
 * - the checklist cannot be marked complete while an unchecked
 *   item remains, and reconnecting needs a complete checklist
 *   plus a real reconnection date on or after the suspension
 *   date; closing keeps the full history;
 * - recording or closing a suspension never changes any past
 *   bill or payment, so the module holds no bill or payment
 *   field, and the SISP suspension-shield fields, the customer
 *   service status, and Plan U are neither read nor written;
 * - impossible dates (2026-02-30) are never stored as a date.
 * Synthetic data only; no bill, payment, or customer record is
 * ever changed by this plan.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SUSPENSION_REASONS,
  SUSPENSION_REASON_LABELS,
  SUSPENSION_STATUSES,
  SUSPENSION_STATUS_LABELS,
  CHECKLIST_ITEMS,
  CHECKLIST_ITEM_LABELS,
  validSuspensionDate,
  suspensionMohallaKey,
  normalizeSuspension,
  normalizeSuspensionList,
  findSuspension,
  upsertSuspension,
  removeSuspension,
  setChecklistItem,
  completeChecklist,
  reconnectSuspension,
  reopenSuspension,
  daysSuspended,
  suspensionsFiltered,
  openSuspensions,
  buildSuspensionSummary,
  suspensionSummaryText,
  suspensionHtml,
  suspensionCsv,
  suspensionFilename,
} from '../suspension-records.js';

const base = {
  id: 'SUS-001',
  customerId: 'C-1',
  customerName: 'Test Customer',
  suspensionDate: '2026-01-10',
  reason: 'non_payment',
  arrearsAmount: 2500,
  status: 'open',
  mohalla: 'Bani',
};

test('strict dates: impossible dates are refused, real dates kept', () => {
  assert.equal(validSuspensionDate('2026-02-30'), null);
  assert.equal(validSuspensionDate('2026-01-10'), '2026-01-10');
  assert.equal(normalizeSuspension({ ...base, suspensionDate: '2026-02-30' }), null);
});

test('catalogues: one reason, two statuses, three checklist items', () => {
  assert.deepEqual(SUSPENSION_REASONS, ['non_payment']);
  assert.equal(SUSPENSION_REASON_LABELS.non_payment, 'Non-payment');
  assert.deepEqual(SUSPENSION_STATUSES, ['open', 'closed']);
  assert.equal(SUSPENSION_STATUS_LABELS.open, 'Open');
  assert.equal(SUSPENSION_STATUS_LABELS.closed, 'Closed');
  assert.deepEqual(CHECKLIST_ITEMS, ['arrears_settled', 'fee_recorded', 'connection_checked']);
  assert.equal(CHECKLIST_ITEM_LABELS.arrears_settled, 'Arrears settled');
});

test('half-formed records are refused outright', () => {
  assert.equal(normalizeSuspension({ ...base, id: '' }), null);
  assert.equal(normalizeSuspension({ ...base, customerId: '' }), null);
  assert.equal(normalizeSuspension({ ...base, reason: 'other' }), null);
  assert.equal(normalizeSuspension({ ...base, status: 'paused' }), null);
  assert.equal(normalizeSuspension({ ...base, arrearsAmount: '' }), null);
  assert.equal(normalizeSuspension({ ...base, arrearsAmount: -5 }), null);
  assert.equal(normalizeSuspension({ ...base, arrearsAmount: 'not a number' }), null);
  assert.equal(normalizeSuspension(null), null);
});

test('rupees convert once, cents used as-is on re-read', () => {
  const entry = normalizeSuspension(base);
  assert.equal(entry.arrearsCents, 250000);
  const reread = normalizeSuspension(entry);
  assert.equal(reread.arrearsCents, 250000);
  assert.equal(normalizeSuspension({ ...base, arrearsCents: 33333 }).arrearsCents, 33333);
});

test('mohalla canonical keys follow Plan T, unassigned never dropped', () => {
  assert.equal(suspensionMohallaKey('Mohalla Bani'), 'BANII');
  assert.equal(suspensionMohallaKey('bani'), 'BANII');
  assert.equal(suspensionMohallaKey(''), null);
  const list = normalizeSuspensionList([
    { ...base, id: 'S-1', mohalla: 'Bani' },
    { ...base, id: 'S-2', mohalla: '' },
  ]);
  assert.equal(suspensionsFiltered(list, { mohalla: '__unassigned__' }).length, 1);
  // More Tab Operational Registries polish (§1): the filter
  // placeholder invites the word "Unassigned", so the folded word
  // matches the same no-mohalla rows as the literal sentinel.
  assert.equal(suspensionsFiltered(list, { mohalla: 'Unassigned' }).length, 1);
  assert.equal(suspensionsFiltered(list, { mohalla: 'unassigned' }).length, 1);
  assert.equal(suspensionsFiltered(list, { mohalla: 'banii' }).length, 1);
});

test('upsert, find, remove, and non-mutation', () => {
  const before = [base];
  const upserted = upsertSuspension(before, { ...base, id: 'SUS-002' });
  assert.equal(upserted.length, 2);
  assert.equal(before.length, 1);
  assert.equal(findSuspension(upserted, 'SUS-002').customerId, 'C-1');
  assert.equal(findSuspension(upserted, 'missing'), null);
  assert.equal(removeSuspension(upserted, 'SUS-001').length, 1);
  assert.equal(upsertSuspension(before, { ...base, suspensionDate: '2026-02-30' }).length, 1);
});

test('checklist cannot complete while an item is unchecked', () => {
  const ticked = setChecklistItem([base], 'SUS-001', 'arrears_settled', true);
  assert.equal(ticked[0].checklist.arrears_settled, true);
  assert.equal(ticked[0].checklistComplete, false);
  const refused = completeChecklist(ticked, 'SUS-001');
  assert.equal(refused[0].checklistComplete, false);
  const allTicked = ['arrears_settled', 'fee_recorded', 'connection_checked']
    .reduce((list, item) => setChecklistItem(list, 'SUS-001', item, true), [base]);
  const completed = completeChecklist(allTicked, 'SUS-001');
  assert.equal(completed[0].checklistComplete, true);
  // Ticking again clears the complete flag: a changed checklist
  // is never silently left complete.
  const unticked = setChecklistItem(completed, 'SUS-001', 'fee_recorded', false);
  assert.equal(unticked[0].checklistComplete, false);
  // Unknown items and closed records do not move.
  assert.equal(setChecklistItem([base], 'SUS-001', 'nope', true)[0].checklist.arrears_settled, false);
});

test('reconnecting needs a complete checklist and a real date, and keeps history', () => {
  const allTicked = ['arrears_settled', 'fee_recorded', 'connection_checked']
    .reduce((list, item) => setChecklistItem(list, 'SUS-001', item, true), [base]);
  const completed = completeChecklist(allTicked, 'SUS-001');
  // Incomplete checklist never closes.
  assert.equal(reconnectSuspension(allTicked, 'SUS-001', '2026-02-01')[0].status, 'open');
  // Bad or early dates never close.
  assert.equal(reconnectSuspension(completed, 'SUS-001', '2026-02-30')[0].status, 'open');
  assert.equal(reconnectSuspension(completed, 'SUS-001', '2026-01-01')[0].status, 'open');
  const closed = reconnectSuspension(completed, 'SUS-001', '2026-02-01');
  assert.equal(closed[0].status, 'closed');
  assert.equal(closed[0].reconnectionDate, '2026-02-01');
  assert.equal(closed[0].arrearsCents, 250000);
  assert.equal(closed[0].checklistComplete, true);
  // A closed record cannot close again, but can reopen, clearing
  // the reconnection trail while keeping the record itself.
  assert.equal(reconnectSuspension(closed, 'SUS-001', '2026-03-01')[0].reconnectionDate, '2026-02-01');
  const reopened = reopenSuspension(closed, 'SUS-001');
  assert.equal(reopened[0].status, 'open');
  assert.equal(reopened[0].reconnectionDate, '');
  assert.equal(reopened[0].checklistComplete, false);
  assert.equal(reopened[0].arrearsCents, 250000);
});

test('closed records stored directly need a complete checklist and a valid date', () => {
  const closed = {
    ...base,
    status: 'closed',
    reconnectionDate: '2026-02-01',
    checklist: { arrears_settled: true, fee_recorded: true, connection_checked: true },
    checklistComplete: true,
  };
  assert.equal(normalizeSuspension(closed).status, 'closed');
  assert.equal(normalizeSuspension({ ...closed, checklistComplete: false }), null);
  assert.equal(normalizeSuspension({ ...closed, reconnectionDate: '2026-01-01' }), null);
});

test('days suspended counts to reconnection or to today, never negative', () => {
  assert.equal(daysSuspended(base, '2026-01-20'), 10);
  const closed = normalizeSuspension({
    ...base,
    status: 'closed',
    reconnectionDate: '2026-01-15',
    checklist: { arrears_settled: true, fee_recorded: true, connection_checked: true },
    checklistComplete: true,
  });
  assert.equal(daysSuspended(closed, '2026-12-31'), 5);
  assert.equal(daysSuspended(base, '2026-01-01'), null);
  assert.equal(daysSuspended(base, 'not a date'), null);
});

test('open list and filters: oldest first, status and reason narrow it', () => {
  const list = normalizeSuspensionList([
    { ...base, id: 'S-2', suspensionDate: '2026-01-12' },
    { ...base, id: 'S-1', suspensionDate: '2026-01-10' },
    {
      ...base, id: 'S-3', suspensionDate: '2026-01-11', status: 'closed',
      reconnectionDate: '2026-01-20',
      checklist: { arrears_settled: true, fee_recorded: true, connection_checked: true },
      checklistComplete: true,
    },
  ]);
  assert.deepEqual(openSuspensions(list).map((row) => row.id), ['S-1', 'S-2']);
  assert.equal(suspensionsFiltered(list, { status: 'closed' }).length, 1);
  assert.equal(suspensionsFiltered(list, { reason: 'non_payment' }).length, 3);
  assert.equal(suspensionsFiltered(list, { reason: 'other' }).length, 0);
});

test('summary totals arrears exactly in integer cents', () => {
  const list = normalizeSuspensionList([
    { ...base, id: 'S-1', arrearsAmount: 1000 },
    { ...base, id: 'S-2', arrearsAmount: 500.50 },
  ]);
  const summary = buildSuspensionSummary(list);
  assert.equal(summary.total, 2);
  assert.equal(summary.open, 2);
  assert.equal(summary.arrearsTotalCents, 150050);
  assert.equal(summary.openArrearsTotalCents, 150050);
  assert.match(suspensionSummaryText(summary), /2 suspensions recorded/);
});

test('no bill or payment field: the record moves no money itself', () => {
  const entry = normalizeSuspension(base);
  const keys = Object.keys(entry);
  for (const forbidden of ['billId', 'billAmount', 'paymentId', 'paymentAmount', 'chargeCents', 'feeCents']) {
    assert.ok(!keys.includes(forbidden), `forbidden field ${forbidden} present`);
  }
  // The fee reference is only an id into the existing path,
  // never a money figure on this record.
  const withRef = normalizeSuspension({ ...base, feeReference: 'RCPT-9' });
  assert.equal(withRef.feeReference, 'RCPT-9');
  assert.equal(withRef.arrearsCents, 250000);
});

test('fence: SISP shield, service status, and Plan U fields are untouched', () => {
  const source = readFileSync(new URL('../suspension-records.js', import.meta.url), 'utf8');
  for (const field of ['doNotSuspendUntil', 'doNotSuspendReason', 'serviceStatus', 'pauseStartDate', 'pauseSkippedMonths']) {
    assert.ok(!source.includes(field), `module must not touch ${field}`);
  }
});

test('HTML escapes, CSV quotes, and filename', () => {
  const row = { ...base, customerName: 'A <b>& "C"' };
  const html = suspensionHtml([row]);
  assert.ok(!html.includes('<b>'));
  assert.ok(html.includes('&lt;b&gt;'));
  assert.ok(suspensionCsv([row]).includes('"A <b>& ""C"""'));
  assert.equal(suspensionFilename(), 'suspension-records.csv');
  assert.match(suspensionHtml([]), /No suspensions recorded/);
});
