/**
 * plan61-dispute-cases.test.js — Plan 61: billing dispute case log.
 * Pins:
 * - every case carries exactly one bill, one disputed amount, one
 *   reason, and one status; half-formed records are refused, never
 *   stored half-formed;
 * - a case cannot be marked resolved without a recorded outcome —
 *   both on upsert and on the status move;
 * - resolved is terminal; illegal status moves leave the list
 *   unchanged;
 * - the open-case list holds open, investigating, and escalated
 *   cases only, and is filterable by status, reason, and mohalla
 *   (Plan T canonical aliases, plus the unassigned filter);
 * - creating or closing a case never carries a bill total, payment
 *   row, or Waada field, and inputs are never mutated;
 * - impossible dates (2026-02-30) are refused; amounts sum in
 *   integer cents.
 * Synthetic data only; no ledger figure is ever changed by this plan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DISPUTE_REASONS,
  DISPUTE_STATUSES,
  validDisputeDate,
  disputeMohallaKey,
  normalizeDisputeCase,
  normalizeDisputeCaseList,
  upsertDisputeCase,
  removeDisputeCase,
  findDisputeCase,
  setDisputeStatus,
  openDisputeCases,
  buildDisputeSummary,
  disputeSummaryText,
  disputeHtml,
  disputeCsv,
  disputeFilename,
} from '../dispute-cases.js';

function baseCase(overrides = {}) {
  return {
    id: 'd1',
    customerId: 'c1',
    customerName: 'Ayesha',
    billId: 'b-2026-10-c1',
    billMonth: '2026-10',
    disputedAmount: 500,
    reason: 'wrong_amount',
    status: 'open',
    evidenceNote: 'Receipt TID 12345',
    dateOpened: '2026-10-12',
    mohalla: 'Bani',
    ...overrides,
  };
}

test('date validation', () => {
  assert.equal(validDisputeDate('2026-02-30'), null);
  assert.equal(validDisputeDate('2024-02-29'), '2024-02-29');
  assert.equal(validDisputeDate('2026-10-12T09:00:00'), '2026-10-12');
  assert.equal(validDisputeDate('not a date'), null);
  assert.equal(validDisputeDate(''), null);
});

test('mohalla canonical keys mirror the Plan T aliases', () => {
  assert.equal(disputeMohallaKey('Mohalla Bani'), 'BANII');
  assert.equal(disputeMohallaKey('bani'), 'BANII');
  assert.equal(disputeMohallaKey('Kishti'), 'KISHTII');
  assert.equal(disputeMohallaKey('chamyaa'), 'CHAMYAAA');
  assert.equal(disputeMohallaKey('Gulshan'), 'GULSHAN');
  assert.equal(disputeMohallaKey(''), null);
});

test('half-formed records are refused, never stored half-formed', () => {
  assert.equal(normalizeDisputeCase(baseCase({ id: '' })), null);
  assert.equal(normalizeDisputeCase(baseCase({ customerId: '' })), null);
  assert.equal(normalizeDisputeCase(baseCase({ billId: '' })), null);
  assert.equal(normalizeDisputeCase(baseCase({ disputedAmount: 0 })), null);
  assert.equal(normalizeDisputeCase(baseCase({ disputedAmount: -50 })), null);
  assert.equal(normalizeDisputeCase(baseCase({ disputedAmount: 'lots' })), null);
  assert.equal(normalizeDisputeCase(baseCase({ reason: 'rude_staff' })), null);
  assert.equal(normalizeDisputeCase(baseCase({ status: 'waiting' })), null);
  assert.equal(normalizeDisputeCase(baseCase({ dateOpened: '2026-02-30' })).dateOpened, null);
  const kept = upsertDisputeCase([baseCase()], baseCase({ id: 'd2', disputedAmount: 0 }));
  assert.equal(kept.length, 1);
});

test('a resolved case without an outcome is refused', () => {
  assert.equal(normalizeDisputeCase(baseCase({ status: 'resolved' })), null);
  assert.equal(normalizeDisputeCase(baseCase({ status: 'resolved', outcome: 'Corrected to Rs. 400' })).status, 'resolved');
  const list = [baseCase()];
  const refused = setDisputeStatus(list, 'd1', 'resolved');
  assert.equal(refused[0].status, 'open');
  const allowed = setDisputeStatus(list, 'd1', 'resolved', 'Corrected to Rs. 400');
  assert.equal(allowed[0].status, 'resolved');
  assert.equal(allowed[0].outcome, 'Corrected to Rs. 400');
});

test('upsert replaces, find and remove work, inputs never mutated', () => {
  const original = baseCase();
  const frozen = JSON.parse(JSON.stringify(original));
  const list = upsertDisputeCase([], original);
  assert.equal(list.length, 1);
  const replaced = upsertDisputeCase(list, baseCase({ disputedAmount: 750, status: 'investigating' }));
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].disputedAmount, 750);
  assert.deepEqual(original, frozen);
  assert.equal(findDisputeCase(replaced, 'd1').status, 'investigating');
  assert.equal(findDisputeCase(replaced, 'nope'), null);
  assert.equal(removeDisputeCase(replaced, 'd1').length, 0);
  assert.equal(removeDisputeCase(replaced, '').length, 1);
});

test('status machine: legal moves pass, illegal moves leave the list unchanged', () => {
  const list = [baseCase()];
  assert.equal(setDisputeStatus(list, 'd1', 'investigating')[0].status, 'investigating');
  assert.equal(setDisputeStatus(list, 'd1', 'escalated')[0].status, 'escalated');
  assert.equal(setDisputeStatus(list, 'd1', 'closed')[0].status, 'open');
  assert.equal(setDisputeStatus(list, 'nope', 'investigating')[0].status, 'open');
  const resolved = [baseCase({ status: 'resolved', outcome: 'Done' })];
  assert.equal(setDisputeStatus(resolved, 'd1', 'open')[0].status, 'resolved');
  assert.equal(setDisputeStatus(resolved, 'd1', 'investigating')[0].status, 'resolved');
  const escalated = [baseCase({ status: 'escalated' })];
  assert.equal(setDisputeStatus(escalated, 'd1', 'open')[0].status, 'escalated');
  assert.equal(setDisputeStatus(escalated, 'd1', 'investigating')[0].status, 'investigating');
});

test('open-case list: resolved excluded, ordered oldest first, undated last', () => {
  const list = [
    baseCase({ id: 'd3', dateOpened: '2026-10-20' }),
    baseCase({ id: 'd1', dateOpened: '2026-10-10' }),
    baseCase({ id: 'd2', status: 'resolved', outcome: 'Done', dateOpened: '2026-10-05' }),
    baseCase({ id: 'd4', dateOpened: '' }),
  ];
  const open = openDisputeCases(list);
  assert.deepEqual(open.map((entry) => entry.id), ['d1', 'd3', 'd4']);
});

test('open-case list filters by status, reason, and mohalla', () => {
  const list = [
    baseCase({ id: 'd1', status: 'open', reason: 'wrong_amount', mohalla: 'Bani' }),
    baseCase({ id: 'd2', status: 'investigating', reason: 'double_charge', mohalla: 'Kishti' }),
    baseCase({ id: 'd3', status: 'escalated', reason: 'wrong_amount', mohalla: '' }),
    baseCase({ id: 'd4', status: 'resolved', outcome: 'Done', reason: 'wrong_amount', mohalla: 'Bani' }),
  ];
  assert.deepEqual(openDisputeCases(list, { status: 'investigating' }).map((e) => e.id), ['d2']);
  assert.deepEqual(openDisputeCases(list, { reason: 'wrong_amount' }).map((e) => e.id), ['d1', 'd3']);
  assert.deepEqual(openDisputeCases(list, { mohalla: 'Mohalla Bani' }).map((e) => e.id), ['d1']);
  assert.deepEqual(openDisputeCases(list, { mohalla: 'kishti' }).map((e) => e.id), ['d2']);
  assert.deepEqual(openDisputeCases(list, { mohalla: '__unassigned__' }).map((e) => e.id), ['d3']);
  assert.deepEqual(openDisputeCases(list, { status: 'open', reason: 'wrong_amount', mohalla: 'Bani' }).map((e) => e.id), ['d1']);
});

test('summary counts and disputed total match the fixture exactly', () => {
  const list = [
    baseCase({ id: 'd1', status: 'open', reason: 'wrong_amount', disputedAmount: 500 }),
    baseCase({ id: 'd2', status: 'investigating', reason: 'double_charge', disputedAmount: 333.33 }),
    baseCase({ id: 'd3', status: 'resolved', outcome: 'Done', reason: 'wrong_amount', disputedAmount: 166.67 }),
  ];
  const summary = buildDisputeSummary(list);
  assert.equal(summary.total, 3);
  assert.equal(summary.open, 2);
  assert.equal(summary.resolved, 1);
  assert.equal(summary.byStatus.open, 1);
  assert.equal(summary.byReason.wrong_amount, 2);
  assert.equal(summary.totalDisputed, 1000);
  assert.match(disputeSummaryText(summary), /3 dispute cases: 2 open, 1 resolved/);
  assert.match(disputeSummaryText(summary), /Rs\. 1000/);
});

test('catalogues cover the plan text', () => {
  assert.deepEqual([...DISPUTE_REASONS].sort(), ['double_charge', 'fee_not_agreed', 'other', 'package_change_timing', 'payment_not_credited', 'wrong_amount'].sort());
  assert.deepEqual([...DISPUTE_STATUSES].sort(), ['escalated', 'investigating', 'open', 'resolved'].sort());
});

test('no bill total, payment, or Waada field on a case', () => {
  const entry = normalizeDisputeCase(baseCase());
  for (const field of ['billTotal', 'payment', 'payments', 'waada', 'waadaPromise', 'balance']) {
    assert.equal(field in entry, false);
  }
  assert.equal(entry.disputedAmount, 500);
  assert.equal(entry.disputedAmountCents, 50000);
});

test('HTML escaping, CSV quoting, filename', () => {
  const evil = baseCase({ customerName: '<b>Ayesha</b>', evidenceNote: 'TID "9,999"' });
  const html = disputeHtml([evil]);
  assert.doesNotMatch(html, /<b>Ayesha<\/b>/);
  assert.match(html, /&lt;b&gt;Ayesha&lt;\/b&gt;/);
  const csv = disputeCsv([evil]);
  assert.match(csv, /"TID ""9,999"""/);
  assert.equal(disputeFilename(), 'dispute-cases.csv');
  assert.match(disputeHtml([]), /No dispute cases recorded/);
  assert.deepEqual(normalizeDisputeCaseList(null), []);
});
