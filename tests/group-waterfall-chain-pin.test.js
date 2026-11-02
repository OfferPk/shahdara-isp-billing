// M18: Group Billing Waterfall Pin (test-only).
// SISP-88's waterfall and SISP-35's full collection are pinned per
// payment in group-partial-waterfall.test.js / group-billing.test.js.
// This pin composes what those suites never chained: (1) a partial
// SMALLER than the first member's own due (member 1 itself ends
// 'partial', everyone behind untouched), (2) a SECOND combined payment
// on the resulting state clearing the group — cumulative allocations
// across both payments equal the original group total to the cent, no
// member over-allocated at the payment-record level, the group waada
// targets emptying exactly when the combined position clears, and
// (3) member-edge handling in one group: a FREE member (the monthly
// cycle never bills a free connection — core.js — so in the group it
// is 'no-bill', consumes no cash and receives no allocation) and an
// archived member (still listed in the group, due flagged 'archived',
// but never entering the group total, the group still-due, or any
// cash in either the partial or the full path).
// Pure-function tests on synthetic data only, through the REAL core
// allocation engine and the REAL quick-collection executor.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  saveBillMonth, calculatePaymentAllocations, generateMonthlyBillsThroughCurrentMonth
} from '../core.js';
import { executeQuickCollection } from '../nav-quick-collect.js';
import {
  addBillingGroup,
  buildGroupDue,
  buildGroupReceipt,
  collectGroupFull,
  collectGroupPartial,
  groupMembers,
  groupWaadaTargets
} from '../group-billing.js';

const now = new Date();
const month = new Date(now.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 7); // PKT — same derivation as group-partial-waterfall.test.js
const today = new Date(now.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 10); // PKT

const customer = (id, n, extra = {}) => ({
  id, customerNumber: n, name: `Customer ${n}`, phone: `0300000000${n}`,
  area: 'Shahdara', archived: false, bills: [], ...extra
});

// Distinct dues so the waterfall order is observable: 2,500 + 1,800 + 3,200 = 7,500.
function chainState() {
  let s = { customers: [customer('a', 1), customer('b', 2), customer('c', 3)] };
  s = saveBillMonth(s, 'a', { month, dueAmount: 2500, status: 'pending' });
  s = saveBillMonth(s, 'b', { month, dueAmount: 1800, status: 'pending' });
  s = saveBillMonth(s, 'c', { month, dueAmount: 3200, status: 'pending' });
  return s;
}

function chainGroup() {
  return addBillingGroup([], { groupTitle: 'Chain Family', memberIds: ['a', 'b', 'c'] })[0];
}

function collectPartial(s, group, amountReceived) {
  return collectGroupPartial(s, group, {
    amountReceived, date: today, method: 'Cash', month,
    allocations: calculatePaymentAllocations(s),
    execute: executeQuickCollection
  });
}

function memberBill(state, id) {
  return state.customers.find((c) => c.id === id).bills.find((b) => b.month === month);
}

test('M18 PIN: a partial smaller than the first member due part-pays member 1 only', () => {
  const s = chainState();
  const group = chainGroup();
  const before = buildGroupDue(group, s.customers, month, calculatePaymentAllocations(s));
  assert.equal(before.totalCents, 750000);
  assert.equal(before.payableCount, 3);

  const result = collectPartial(s, group, 1000); // 1,000 < member 1's 2,500 due
  assert.equal(result.collected, true);
  assert.deepEqual(result.outcomes.map((o) => o.outcome), ['partial', 'unpaid', 'unpaid']);
  assert.deepEqual(result.outcomes.map((o) => o.amountCents), [100000, 0, 0]);
  assert.deepEqual(result.outcomes.map((o) => o.remainingCents), [150000, 180000, 320000]);
  assert.equal(result.totalCents, 100000);
  assert.equal(result.receivedCents, 100000);
  assert.equal(result.unallocatedCents, 0);
  assert.equal(result.remainingCents, 650000);
  assert.equal(result.paidCount, 0);
  assert.equal(result.partialCount, 1);
  // Real engine: member 1 reduced by exactly the cash, members 2 & 3 untouched.
  const after = calculatePaymentAllocations(result.nextState);
  assert.equal(after.forMonth('a', month).balanceDueCents, 150000);
  assert.equal(after.forMonth('b', month).balanceDueCents, 180000);
  assert.equal(after.forMonth('c', month).balanceDueCents, 320000);
  assert.equal((memberBill(result.nextState, 'b').payments ?? []).length, 0);
  assert.equal((memberBill(result.nextState, 'c').payments ?? []).length, 0);
  // Combined receipt: detailed lines, cash received, still due.
  const receipt = buildGroupReceipt({ ...result, date: today, method: 'Cash' });
  assert.match(receipt.text, /Customer 1.*paid Rs\. 1,000 · remaining Rs\. 1,500/);
  assert.match(receipt.text, /Customer 2.*paid Rs\. 0 · remaining Rs\. 1,800/);
  assert.match(receipt.text, /Customer 3.*paid Rs\. 0 · remaining Rs\. 3,200/);
  assert.match(receipt.text, /TOTAL: Rs\. 1,000/);
  assert.match(receipt.text, /Cash received: Rs\. 1,000/);
  assert.match(receipt.text, /Still due: Rs\. 6,500/);
  // The waada chip reflects the combined position: all three still owe, in order.
  assert.deepEqual(groupWaadaTargets(result.outcomes), [
    { customerId: 'a', customerNumber: 1, name: 'Customer 1', remainingCents: 150000 },
    { customerId: 'b', customerNumber: 2, name: 'Customer 2', remainingCents: 180000 },
    { customerId: 'c', customerNumber: 3, name: 'Customer 3', remainingCents: 320000 }
  ]);
  // The combined group position after the partial is exactly the still-due.
  const midway = buildGroupDue(group, result.nextState.customers, month, calculatePaymentAllocations(result.nextState));
  assert.equal(midway.totalCents, 650000);
  assert.equal(midway.payableCount, 3);
});

test('M18 PIN: a second combined payment clears the group — cumulative equals the group total', () => {
  const s = chainState();
  const group = chainGroup();
  const originalTotal = buildGroupDue(group, s.customers, month, calculatePaymentAllocations(s)).totalCents;

  const first = collectPartial(s, group, 1000);
  const second = collectPartial(first.nextState, group, 6500);
  assert.deepEqual(second.outcomes.map((o) => o.outcome), ['paid', 'paid', 'paid']);
  assert.deepEqual(second.outcomes.map((o) => o.amountCents), [150000, 180000, 320000]);
  assert.deepEqual(second.outcomes.map((o) => o.remainingCents), [0, 0, 0]);
  assert.equal(second.totalCents, 650000);
  assert.equal(second.unallocatedCents, 0);
  assert.equal(second.remainingCents, 0);
  assert.equal(second.paidCount, 3);
  // No over-allocation across the chain: the two payments together are
  // exactly the original group total, to the cent.
  assert.equal(first.totalCents + second.totalCents, originalTotal);
  assert.equal(originalTotal, 750000);
  // Payment-record level: each member's recorded payments sum to
  // exactly their own due — never a rupee more.
  const paidAmounts = (id) => (memberBill(second.nextState, id).payments ?? []).map((p) => p.amount);
  assert.deepEqual(paidAmounts('a'), [1000, 1500]);
  assert.deepEqual(paidAmounts('b'), [1800]);
  assert.deepEqual(paidAmounts('c'), [3200]);
  // Combined position fully clear: engine, group due, waada targets.
  const after = calculatePaymentAllocations(second.nextState);
  for (const id of ['a', 'b', 'c']) assert.equal(after.forMonth(id, month).balanceDueCents, 0);
  const cleared = buildGroupDue(group, second.nextState.customers, month, after);
  assert.equal(cleared.totalCents, 0);
  assert.equal(cleared.payableCount, 0);
  assert.deepEqual(cleared.members.map((m) => m.status), ['paid', 'paid', 'paid']);
  assert.deepEqual(groupWaadaTargets(second.outcomes), []);
  // A fully clearing collection returns to the plain SISP-35 receipt format.
  const receipt = buildGroupReceipt({ ...second, date: today, method: 'Cash' });
  assert.match(receipt.text, /Customer 1.*Rs\. 1,500/);
  assert.match(receipt.text, /Customer 2.*Rs\. 1,800/);
  assert.match(receipt.text, /Customer 3.*Rs\. 3,200/);
  assert.match(receipt.text, /TOTAL: Rs\. 6,500/);
  assert.doesNotMatch(receipt.text, /Still due/);
});

// Edge fixture: FREE member, archived member (Rs. 9,000 bill), two live
// members owing 2,000 + 1,200. Stored order puts the edge members first
// so any cash leaking to them would be visible immediately.
function edgeState() {
  let s = { customers: [
    customer('fr', 21, { isFreeConnection: true }),
    customer('ar', 22, { archived: true, bills: [{ month, dueAmount: 9000, status: 'pending', payments: [] }] }),
    customer('x', 23),
    customer('y', 24)
  ] };
  s = saveBillMonth(s, 'x', { month, dueAmount: 2000, status: 'pending' });
  s = saveBillMonth(s, 'y', { month, dueAmount: 1200, status: 'pending' });
  return s;
}

function edgeGroup() {
  return addBillingGroup([], { groupTitle: 'Edge Family', memberIds: ['fr', 'ar', 'x', 'y'] })[0];
}

test('M18 PIN: the monthly cycle never bills a FREE connection (the group no-bill source)', () => {
  const schedule = [{ effectiveMonth: month, amount: 3000 }];
  const state = { customers: [
    customer('n1', 11, { monthlyPriceSchedule: schedule }),
    customer('f1', 12, { monthlyPriceSchedule: schedule, isFreeConnection: true })
  ] };
  const generated = generateMonthlyBillsThroughCurrentMonth(state, new Date());
  const normal = generated.customers.find((c) => c.id === 'n1');
  const free = generated.customers.find((c) => c.id === 'f1');
  assert.deepEqual(normal.bills.map((b) => [b.month, b.dueAmount]), [[month, 3000]]);
  assert.deepEqual(free.bills, [], 'a free connection gets no bill — no fee, no pending amount, ever');
});

test('M18 PIN: a FREE group member is never billed, never allocated, and consumes no cash', () => {
  const s = edgeState();
  const group = edgeGroup();
  const due = buildGroupDue(group, s.customers, month, calculatePaymentAllocations(s));
  const freeEntry = due.members.find((m) => m.customerId === 'fr');
  assert.equal(freeEntry.status, 'no-bill');
  assert.equal(freeEntry.dueCents, 0);

  const result = collectPartial(s, group, 2500);
  const freeOutcome = result.outcomes.find((o) => o.customerId === 'fr');
  assert.equal(freeOutcome.outcome, 'skipped-no-bill');
  assert.equal(freeOutcome.amountCents, 0);
  assert.equal(freeOutcome.remainingCents, 0);
  // The FREE member's record is byte-identical after the collection:
  // still no bill, still no payment.
  const freeAfter = result.nextState.customers.find((c) => c.id === 'fr');
  assert.deepEqual(freeAfter.bills, []);
  assert.equal(freeAfter.isFreeConnection, true);
  // None of the cash was absorbed by the FREE member: the full 2,500
  // landed on the live members (2,000 + 500), pinned in the edge test below.
  assert.equal(result.totalCents, 250000);
});

test('M18 PIN: an archived member stays listed but never enters totals, still-due, or cash', () => {
  const s = edgeState();
  const group = edgeGroup();
  // Occupancy: archiving does not drop the member from the group.
  assert.deepEqual(groupMembers(group, s.customers).map((c) => c.id), ['fr', 'ar', 'x', 'y']);
  const due = buildGroupDue(group, s.customers, month, calculatePaymentAllocations(s));
  const archivedEntry = due.members.find((m) => m.customerId === 'ar');
  assert.equal(archivedEntry.status, 'archived');
  assert.equal(archivedEntry.dueCents, 900000, 'the archived due is listed, flagged');
  assert.equal(due.totalCents, 320000, 'but never enters the group total (2,000 + 1,200 only)');
  assert.equal(due.payableCount, 2);

  const result = collectPartial(s, group, 2500);
  assert.deepEqual(result.outcomes.map((o) => o.outcome),
    ['skipped-no-bill', 'skipped-archived', 'paid', 'partial']);
  assert.deepEqual(result.outcomes.map((o) => o.amountCents), [0, 0, 200000, 50000]);
  const archivedOutcome = result.outcomes.find((o) => o.customerId === 'ar');
  assert.equal(archivedOutcome.remainingCents, 900000, 'its own outcome still reports its due');
  assert.equal(result.remainingCents, 70000,
    'yet the group still-due counts only the live member remainder — the archived 9,000 never enters it');
  assert.equal(result.unallocatedCents, 0);
  // The archived member's bill is untouched by the collection.
  const archivedAfter = result.nextState.customers.find((c) => c.id === 'ar');
  assert.deepEqual(archivedAfter.bills[0].payments, []);
  assert.deepEqual(group.memberIds, ['fr', 'ar', 'x', 'y'], 'group membership record unchanged');
  // Combined receipt: archived shown as skipped, still-due is the live Rs. 700 only.
  const receipt = buildGroupReceipt({ ...result, date: today, method: 'Cash' });
  assert.match(receipt.text, /Customer 21.*Rs\. 0 — no bill/);
  assert.match(receipt.text, /Customer 22.*Rs\. 0 — archived, skipped/);
  assert.match(receipt.text, /Customer 23.*paid Rs\. 2,000 · remaining Rs\. 0/);
  assert.match(receipt.text, /Customer 24.*paid Rs\. 500 · remaining Rs\. 700/);
  assert.match(receipt.text, /TOTAL: Rs\. 2,500/);
  assert.match(receipt.text, /Still due: Rs\. 700/);

  // The FULL path behaves identically: both edge members skipped, only
  // the live members collected, archived bill still untouched.
  const full = collectGroupFull(s, group, {
    date: today, method: 'Cash', month,
    allocations: calculatePaymentAllocations(s),
    execute: executeQuickCollection
  });
  assert.deepEqual(full.outcomes.map((o) => o.outcome),
    ['skipped-no-bill', 'skipped-archived', 'paid', 'paid']);
  assert.equal(full.totalCents, 320000);
  assert.equal(full.paidCount, 2);
  const archivedAfterFull = full.nextState.customers.find((c) => c.id === 'ar');
  assert.deepEqual(archivedAfterFull.bills[0].payments, []);
});
