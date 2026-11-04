/**
 * plan69-preclose-sweep.test.js — Plan 69: pre-close unreconciled
 * items sweep (read-only).
 * Pins:
 * - the sweep lists exactly the unreconciled items on the same
 *   fixture, grouped by type with counts and amounts in integer
 *   cents;
 * - matched wallet rows, closed claims, recorded handovers, and
 *   id-less rows never enter the sweep;
 * - unusable amounts are counted and named, never zero-filled, and
 *   a group total goes null rather than a partial sum;
 * - a handover day with no amount still counts as an unclosed day;
 * - clearing an item from its own screen removes it from the next
 *   sweep, because the sweep is recomputed fresh every render;
 * - a month marked closed with sweep items still open carries
 *   those items visibly as carried-forward exceptions;
 * - the module holds no bill, payment, suspense, wallet, claim,
 *   handover, or month-close field of its own, and never mutates
 *   its inputs.
 * Synthetic data only; no record is ever changed by this plan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SWEEP_GROUPS,
  validSweepDate,
  validSweepMonth,
  buildPrecloseSweep,
  precloseSweepSummaryText,
  precloseSweepHtml,
  precloseSweepCsv,
  precloseSweepFilename,
} from '../preclose-sweep.js';

function fixture() {
  return {
    month: '2026-11',
    suspenseItems: [
      { id: 'S-1', label: 'Suspense S-1', detail: 'Easypaisa, no name', amount: 500, ageDays: 40, date: '2026-10-01' },
      { id: 'S-2', label: 'Suspense S-2', amount: 333.33, ageDays: 5, date: '2026-11-01' },
    ],
    walletItems: [
      { id: 'W-1', bucket: 'unmatched', label: 'Wallet W-1', detail: 'TID ABC', amount: 1000, date: '2026-11-02' },
      { id: 'W-2', bucket: 'disputed', label: 'Wallet W-2', detail: 'Duplicate TID', amount: 166.67, date: '2026-11-03' },
      { id: 'W-3', bucket: 'matched', label: 'Wallet W-3', amount: 9999, date: '2026-11-03' },
      { bucket: 'unmatched', label: 'No id row', amount: 50 },
    ],
    claims: [
      { id: 'C-1', label: 'Claim C-1', detail: 'Easypaisa TID XYZ', amount: 2000, date: '2026-11-04', closed: false },
      { id: 'C-2', label: 'Claim C-2', amount: 750, date: '2026-11-05', closed: true },
    ],
    handovers: [
      { date: '2026-11-03', label: 'Day 2026-11-03', detail: 'Cash Rs. 4500, no handover', handoverRecorded: false },
      { date: '2026-11-02', label: 'Day 2026-11-02', handoverRecorded: true },
    ],
    monthClose: { month: '2026-11', status: 'open' },
  };
}

test('strict dates and months; an invalid month refuses the sweep', () => {
  assert.equal(validSweepDate('2026-02-30'), null);
  assert.equal(validSweepDate('2026-11-04'), '2026-11-04');
  assert.equal(validSweepMonth('2026-13'), false);
  assert.equal(validSweepMonth('2026-11'), true);
  assert.equal(buildPrecloseSweep({ month: '2026-13' }), null);
  assert.equal(buildPrecloseSweep({ month: '2026-11' }).month, '2026-11');
});

test('sweep groups, counts, and exact cent amounts on one fixture', () => {
  const sweep = buildPrecloseSweep(fixture());
  assert.equal(sweep.totalCount, 6);
  const byId = Object.fromEntries(sweep.groups.map((group) => [group.id, group]));
  assert.equal(byId.suspense.count, 2);
  assert.equal(byId.suspense.amount, 833.33);
  assert.equal(byId.wallet.count, 2);
  assert.equal(byId.wallet.amount, 1166.67);
  assert.equal(byId.claims.count, 1);
  assert.equal(byId.claims.amount, 2000);
  assert.equal(byId.handovers.count, 1);
  assert.equal(byId.handovers.amount, 0);
  assert.equal(sweep.totalAmount, 4000);
});

test('matched wallet rows, closed claims, recorded handovers, and id-less rows never enter', () => {
  const sweep = buildPrecloseSweep(fixture());
  const ids = sweep.items.map((item) => item.id);
  assert.ok(!ids.includes('W-3'));
  assert.ok(!ids.includes('C-2'));
  assert.ok(!ids.includes('2026-11-02'));
  assert.ok(!ids.includes(''));
  assert.equal(sweep.items.length, 6);
});

test('unusable amounts are counted, never zero-filled, and null the group total', () => {
  const sweep = buildPrecloseSweep({
    month: '2026-11',
    suspenseItems: [
      { id: 'S-1', amount: 500, ageDays: 10 },
      { id: 'S-2', amount: 'not a number', ageDays: 3 },
    ],
  });
  const group = sweep.groups.find((entry) => entry.id === 'suspense');
  assert.equal(group.count, 2);
  assert.equal(group.unusableCount, 1);
  assert.equal(group.amount, null);
  assert.equal(sweep.totalAmount, null);
  assert.equal(sweep.unusableCount, 1);
  assert.match(precloseSweepSummaryText(sweep), /unusable amount/);
  const badItem = group.items.find((item) => item.id === 'S-2');
  assert.equal(badItem.amount, null);
  assert.equal(badItem.unusableAmount, true);
});

test('a handover day with no amount still counts as an unclosed day, not an unusable figure', () => {
  const sweep = buildPrecloseSweep({
    month: '2026-11',
    handovers: [{ date: '2026-11-03', label: 'Day 2026-11-03', handoverRecorded: false }],
  });
  const group = sweep.groups.find((entry) => entry.id === 'handovers');
  assert.equal(group.count, 1);
  assert.equal(group.unusableCount, 0);
  assert.equal(sweep.unusableCount, 0);
});

test('a handover day with a stated but unusable amount is flagged, not treated as amount-less', () => {
  const sweep = buildPrecloseSweep({
    month: '2026-11',
    handovers: [{ date: '2026-11-03', label: 'Day 2026-11-03', amount: -5, handoverRecorded: false }],
  });
  const group = sweep.groups.find((entry) => entry.id === 'handovers');
  assert.equal(group.unusableCount, 1);
  assert.equal(group.amount, null);
});

test('clearing an item from its own screen removes it from the next sweep', () => {
  const input = fixture();
  const first = buildPrecloseSweep(input);
  assert.equal(first.totalCount, 6);
  const cleared = {
    ...input,
    suspenseItems: input.suspenseItems.filter((item) => item.id !== 'S-1'),
    claims: [],
  };
  const second = buildPrecloseSweep(cleared);
  assert.equal(second.totalCount, 4);
  assert.ok(!second.items.some((item) => item.id === 'S-1'));
  assert.ok(!second.items.some((item) => item.id === 'C-1'));
});

test('a closed month carries still-open items forward visibly; an open month does not', () => {
  const closedInput = fixture();
  closedInput.monthClose = { month: '2026-11', status: 'closed', closedDate: '2026-11-30', closedBy: 'Owner' };
  const closed = buildPrecloseSweep(closedInput);
  assert.equal(closed.carriedForward.length, 6);
  assert.ok(closed.carriedForward.every((item) => item.carriedFrom === '2026-11'));
  assert.match(precloseSweepSummaryText(closed), /carried forward/);
  assert.match(precloseSweepHtml(closed), /Carried-forward exceptions/);
  const open = buildPrecloseSweep(fixture());
  assert.equal(open.carriedForward.length, 0);
  assert.doesNotMatch(precloseSweepHtml(open), /Carried-forward/);
});

test('a closed month for a different month does not carry anything forward', () => {
  const input = fixture();
  input.monthClose = { month: '2026-10', status: 'closed', closedDate: '2026-10-31', closedBy: 'Owner' };
  assert.equal(buildPrecloseSweep(input).carriedForward.length, 0);
});

test('suspense items sort oldest first, undated last', () => {
  const sweep = buildPrecloseSweep({
    month: '2026-11',
    suspenseItems: [
      { id: 'S-new', amount: 100, ageDays: 2 },
      { id: 'S-old', amount: 100, ageDays: 40 },
      { id: 'S-undated', amount: 100 },
    ],
  });
  const group = sweep.groups.find((entry) => entry.id === 'suspense');
  assert.deepEqual(group.items.map((item) => item.id), ['S-old', 'S-new', 'S-undated']);
});

test('exact cent sums: 333.33 + 166.67 = 500, never float drift', () => {
  const sweep = buildPrecloseSweep({
    month: '2026-11',
    claims: [
      { id: 'C-1', amount: 333.33, closed: false },
      { id: 'C-2', amount: 166.67, closed: false },
    ],
  });
  assert.equal(sweep.groups.find((entry) => entry.id === 'claims').amount, 500);
});

test('empty sweep states cleanly', () => {
  const sweep = buildPrecloseSweep({ month: '2026-11' });
  assert.equal(sweep.totalCount, 0);
  assert.equal(sweep.totalAmount, 0);
  assert.match(precloseSweepSummaryText(sweep), /nothing unreconciled/);
  assert.match(precloseSweepHtml(sweep), /Nothing unreconciled/);
});

test('inputs are never mutated', () => {
  const input = fixture();
  const before = JSON.stringify(input);
  buildPrecloseSweep(input);
  assert.equal(JSON.stringify(input), before);
});

test('the sweep holds no ledger field of its own', () => {
  const sweep = buildPrecloseSweep(fixture());
  const forbidden = ['dueAmount', 'receipt', 'waada', 'payment', 'bill', 'concessionAmount', 'balanceDue', 'suspenseId', 'transactionId', 'handoverRecorded', 'closed'];
  const keys = [...Object.keys(sweep), ...sweep.items.flatMap((item) => Object.keys(item))];
  for (const field of forbidden) assert.ok(!keys.includes(field), `sweep must not hold ${field}`);
});

test('catalogue is fixed at four groups with owning screens', () => {
  assert.equal(SWEEP_GROUPS.length, 4);
  assert.deepEqual(SWEEP_GROUPS.map((group) => group.id), ['suspense', 'wallet', 'claims', 'handovers']);
  assert.ok(SWEEP_GROUPS.every((group) => group.screen));
});

test('HTML escaping, CSV quoting, and filename', () => {
  const sweep = buildPrecloseSweep({
    month: '2026-11',
    suspenseItems: [{ id: 'S-1', label: 'A "quoted" <name>', detail: 'x,y', amount: 100, ageDays: 1 }],
  });
  assert.doesNotMatch(precloseSweepHtml(sweep), /<name>/);
  assert.match(precloseSweepHtml(sweep), /&lt;name&gt;/);
  assert.match(precloseSweepCsv(sweep), /"A ""quoted"" <name>"/);
  assert.equal(precloseSweepFilename('2026-11'), 'preclose-sweep-2026-11.csv');
  assert.equal(precloseSweepFilename('2026-13'), 'preclose-sweep.csv');
});
