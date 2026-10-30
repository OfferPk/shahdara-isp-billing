// SISP-88: Group Billing Partial Payment Waterfall & Group Waada Chip.
// Pure-function tests on synthetic data only, through the REAL core
// allocation engine (saveBillMonth + calculatePaymentAllocations) and the
// REAL quick-collection executor. Pins the spec criterion: a 3-member
// group owing 2,000 + 3,000 + 1,500 = 6,500, collecting 5,000 partial
// cash in STORED GROUP ORDER marks Members 1 & 2 paid in full, leaves
// Member 3 at 1,500 unpaid, and prints all 3 paid/remaining lines on the
// consolidated receipt. Also pins: the waterfall remainder part-pays the
// next member, archived members consume no cash, cash above the total is
// never executed (reported unallocated), all-or-nothing on failure, the
// Waada targets list, the SISP-3 waada path for a leftover member, and
// SISP-34 void behaving exactly as before (no group side effects).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addPayment, saveBillMonth, calculatePaymentAllocations
} from '../core.js';
import { executeQuickCollection } from '../nav-quick-collect.js';
import { voidPayment } from '../payment-void-audit.js';
import { computeWaadaChipDate, getWaadaTier, setCustomerWaada } from '../waada-queue.js';
import {
  addBillingGroup,
  buildGroupReceipt,
  collectGroupPartial,
  groupWaadaTargets
} from '../group-billing.js';

const now = new Date();
const month = now.toISOString().slice(0, 7);
const today = new Date(now.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 10); // PKT

const customer = (id, n, extra = {}) => ({
  id, customerNumber: n, name: `Customer ${n}`, phone: `0300000000${n}`,
  area: 'Shahdara', archived: false, bills: [], ...extra
});

// The pinned spec fixture: 2,000 + 3,000 + 1,500 = 6,500.
function pinnedState() {
  let s = { customers: [customer('a', 1), customer('b', 2), customer('c', 3)] };
  s = saveBillMonth(s, 'a', { month, dueAmount: 2000, status: 'pending' });
  s = saveBillMonth(s, 'b', { month, dueAmount: 3000, status: 'pending' });
  s = saveBillMonth(s, 'c', { month, dueAmount: 1500, status: 'pending' });
  return s;
}

function pinnedGroup(memberIds = ['a', 'b', 'c']) {
  return addBillingGroup([], { groupTitle: 'Khan Family', memberIds })[0];
}

function collectPartial(s, group, amountReceived) {
  return collectGroupPartial(s, group, {
    amountReceived, date: today, method: 'Cash', month,
    allocations: calculatePaymentAllocations(s),
    execute: executeQuickCollection
  });
}

test('PINNED SISP-88: 5,000 partial on 2,000+3,000+1,500 pays Members 1 & 2, leaves Member 3 at 1,500', () => {
  const s = pinnedState();
  const result = collectPartial(s, pinnedGroup(), 5000);
  assert.equal(result.collected, true);
  assert.equal(result.totalCents, 500000);
  assert.equal(result.receivedCents, 500000);
  assert.equal(result.unallocatedCents, 0);
  assert.equal(result.remainingCents, 150000);
  assert.equal(result.paidCount, 2);
  assert.equal(result.partialCount, 0);
  assert.deepEqual(result.outcomes.map((o) => o.outcome), ['paid', 'paid', 'unpaid']);
  assert.deepEqual(result.outcomes.map((o) => o.amountCents), [200000, 300000, 0]);
  assert.deepEqual(result.outcomes.map((o) => o.remainingCents), [0, 0, 150000]);
  // Real engine: members 1 & 2 settled, member 3 untouched at 1,500.
  const after = calculatePaymentAllocations(result.nextState);
  assert.equal(after.forMonth('a', month).balanceDueCents, 0);
  assert.equal(after.forMonth('b', month).balanceDueCents, 0);
  assert.equal(after.forMonth('c', month).balanceDueCents, 150000);
  // Consolidated receipt prints all 3 lines with exact paid + remaining.
  const receipt = buildGroupReceipt({ ...result, date: today, method: 'Cash' });
  assert.match(receipt.text, /Customer 1.*paid Rs\. 2,000 · remaining Rs\. 0/);
  assert.match(receipt.text, /Customer 2.*paid Rs\. 3,000 · remaining Rs\. 0/);
  assert.match(receipt.text, /Customer 3.*paid Rs\. 0 · remaining Rs\. 1,500/);
  assert.match(receipt.text, /TOTAL: Rs\. 5,000/);
  assert.match(receipt.text, /Cash received: Rs\. 5,000/);
  assert.match(receipt.text, /Still due: Rs\. 1,500/);
  assert.match(receipt.whatsappText, /مشترکہ رسید/);
  assert.match(receipt.whatsappText, /Still due: Rs\. 1,500/);
  // Only Member 3 is offered a Waada chip.
  assert.deepEqual(groupWaadaTargets(result.outcomes).map((m) => m.customerId), ['c']);
  assert.equal(groupWaadaTargets(result.outcomes)[0].remainingCents, 150000);
});

test('waterfall remainder part-pays the next member, later members stay unpaid', () => {
  const s = pinnedState();
  const result = collectPartial(s, pinnedGroup(), 4000);
  assert.deepEqual(result.outcomes.map((o) => o.outcome), ['paid', 'partial', 'unpaid']);
  assert.deepEqual(result.outcomes.map((o) => o.amountCents), [200000, 200000, 0]);
  assert.deepEqual(result.outcomes.map((o) => o.remainingCents), [0, 100000, 150000]);
  assert.equal(result.remainingCents, 250000);
  assert.equal(result.paidCount, 1);
  assert.equal(result.partialCount, 1);
  const after = calculatePaymentAllocations(result.nextState);
  assert.equal(after.forMonth('b', month).balanceDueCents, 100000);
  assert.equal(after.forMonth('c', month).balanceDueCents, 150000);
  // Both the part-paid and the untouched member are Waada targets, in order.
  assert.deepEqual(groupWaadaTargets(result.outcomes).map((m) => m.customerId), ['b', 'c']);
});

test('waterfall order is the group STORED member order, not customer order', () => {
  const s = pinnedState();
  const result = collectPartial(s, pinnedGroup(['c', 'a', 'b']), 1500);
  assert.deepEqual(result.outcomes.map((o) => o.customerId), ['c', 'a', 'b']);
  assert.deepEqual(result.outcomes.map((o) => o.outcome), ['paid', 'unpaid', 'unpaid']);
  const after = calculatePaymentAllocations(result.nextState);
  assert.equal(after.forMonth('c', month).balanceDueCents, 0);
  assert.equal(after.forMonth('a', month).balanceDueCents, 200000);
});

test('cash at or above the group total settles everyone; excess is reported, never executed', () => {
  const s = pinnedState();
  const result = collectPartial(s, pinnedGroup(), 7000);
  assert.deepEqual(result.outcomes.map((o) => o.outcome), ['paid', 'paid', 'paid']);
  assert.equal(result.totalCents, 650000);
  assert.equal(result.unallocatedCents, 50000);
  assert.equal(result.remainingCents, 0);
  const after = calculatePaymentAllocations(result.nextState);
  for (const id of ['a', 'b', 'c']) assert.equal(after.forMonth(id, month).balanceDueCents, 0);
  // A fully covered collection keeps the exact SISP-35 receipt format.
  const receipt = buildGroupReceipt({ ...result, date: today, method: 'Cash' });
  assert.match(receipt.text, /Customer 1.*Rs\. 2,000/);
  assert.doesNotMatch(receipt.text, /Still due/);
  assert.deepEqual(groupWaadaTargets(result.outcomes), []);
});

test('archived and already-paid members consume no waterfall cash', () => {
  let s = pinnedState();
  s = addPayment(s, 'a', month, { date: today, amount: 2000, method: 'Cash' }); // a settled
  s.customers.push(customer('e', 5, {
    archived: true,
    bills: [{ month, dueAmount: 9000, status: 'pending', payments: [] }]
  }));
  const group = addBillingGroup([], { groupTitle: 'Mixed', memberIds: ['e', 'a', 'b', 'c'] })[0];
  const result = collectPartial(s, group, 3000);
  assert.deepEqual(result.outcomes.map((o) => o.outcome), ['skipped-archived', 'skipped-paid', 'paid', 'unpaid']);
  assert.equal(result.totalCents, 300000, 'the 3,000 must land on b, not the archived 9,000');
  const after = calculatePaymentAllocations(result.nextState);
  assert.equal(after.forMonth('b', month).balanceDueCents, 0);
  assert.equal(after.forMonth('c', month).balanceDueCents, 150000);
});

test('invalid amounts throw; a group with no payable dues collects nothing', () => {
  const s = pinnedState();
  const group = pinnedGroup();
  assert.throws(() => collectPartial(s, group, 0), /cash received/);
  assert.throws(() => collectPartial(s, group, -500), /cash received/);
  assert.throws(() => collectPartial(s, group, NaN), /cash received/);
  let settled = pinnedState();
  settled = addPayment(settled, 'a', month, { date: today, amount: 2000, method: 'Cash' });
  settled = addPayment(settled, 'b', month, { date: today, amount: 3000, method: 'Cash' });
  settled = addPayment(settled, 'c', month, { date: today, amount: 1500, method: 'Cash' });
  const result = collectPartial(settled, group, 1000);
  assert.equal(result.collected, false);
  assert.equal(result.totalCents, 0);
  assert.equal(result.unallocatedCents, 100000);
  assert.deepEqual(result.outcomes.map((o) => o.outcome), ['skipped-paid', 'skipped-paid', 'skipped-paid']);
});

test('all-or-nothing: a member failure names the member and saves nothing', () => {
  const s = pinnedState();
  const group = pinnedGroup();
  const failingExecute = (st, fields) => {
    if (fields.customerId === 'b') throw new Error('payment rejected');
    return { nextState: addPayment(st, fields.customerId, fields.month, { date: fields.date, amount: fields.amount, method: fields.method }) };
  };
  assert.throws(
    () => collectGroupPartial(s, group, {
      amountReceived: 5000, date: today, method: 'Cash', month, execute: failingExecute
    }),
    /Customer 2: payment rejected — nothing was saved\./
  );
  const aBill = s.customers.find((c) => c.id === 'a').bills.find((b) => b.month === month);
  assert.equal((aBill.payments ?? []).length, 0);
});

test('waada chip path: a leftover member promise is set via SISP-3 setCustomerWaada', () => {
  const s = pinnedState();
  const result = collectPartial(s, pinnedGroup(), 5000);
  const [target] = groupWaadaTargets(result.outcomes);
  assert.equal(target.customerId, 'c');
  const member = result.nextState.customers.find((c) => c.id === target.customerId);
  const outstanding = (calculatePaymentAllocations(result.nextState).forMonth('c', month).balanceDueCents ?? 0) / 100;
  assert.equal(getWaadaTier(member, outstanding, today), 'active');
  const promised = setCustomerWaada(member, {
    promiseDate: computeWaadaChipDate('plus5', today),
    promiseAmount: outstanding,
    promiseNote: 'Group partial — Khan Family'
  });
  assert.equal(getWaadaTier(promised, outstanding, today), 'promised');
  assert.equal(promised.promiseAmount, 1500);
});

test('SISP-34 void of a waterfall payment behaves as always — no group side effects', () => {
  const s = pinnedState();
  const group = pinnedGroup();
  const result = collectPartial(s, group, 5000);
  // The waterfall payment is an ordinary member payment: no group stamp.
  const aBill = result.nextState.customers.find((c) => c.id === 'a').bills.find((b) => b.month === month);
  assert.equal(aBill.payments.length, 1);
  assert.ok(!Object.keys(aBill.payments[0]).some((k) => /group/i.test(k)), 'payment must carry no group fields');
  const { state: voided } = voidPayment(result.nextState, 'a', month, aBill.payments[0].id, { voidReason: 'Wrong amount entered' });
  const after = calculatePaymentAllocations(voided);
  assert.equal(after.forMonth('a', month).balanceDueCents, 200000, 'void reopens only member a');
  assert.equal(after.forMonth('b', month).balanceDueCents, 0, 'member b stays settled');
  assert.equal(after.forMonth('c', month).balanceDueCents, 150000, 'member c untouched');
  // The group link itself is unchanged by the void.
  assert.deepEqual(group.memberIds, ['a', 'b', 'c']);
});
