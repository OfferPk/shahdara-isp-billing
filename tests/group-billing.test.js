// SISP-35: Multi-Connection Family / Landlord Group Billing & Combined Receipt.
// Pure-function tests on synthetic data only. Pins the spec criterion:
// linking 3 connections (2,000 + 3,000 + 1,500 = 6,500) and clicking
// "Collect Group Full" marks all 3 paid and generates a combined
// Rs. 6,500 receipt — verified through the REAL core allocation engine
// (saveBillMonth + addPayment + calculatePaymentAllocations) and the REAL
// quick-collection executor. Also pins: zero-due members contribute zero
// and never break the total; archived members are skipped and excluded
// from the total; all-or-nothing on a member failure; groups are links,
// never merges; backup safe-merge round-trip.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addPayment, saveBillMonth, calculatePaymentAllocations,
  createInitialState, createJsonBackup, previewJsonBackupMerge
} from '../core.js';
import { executeQuickCollection } from '../nav-quick-collect.js';
import {
  GROUP_BILLING_KEY,
  addBillingGroup,
  billingGroupsSummary,
  buildGroupDue,
  buildGroupReceipt,
  collectGroupFull,
  deleteBillingGroup,
  formatGroupPKR,
  groupMembers,
  loadBillingGroups,
  memberDueCents,
  nextGroupId,
  sanitizeBillingGroups,
  saveBillingGroups,
  updateBillingGroup
} from '../group-billing.js';

const now = new Date();
const month = new Date(now.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 7); // PKT — the app derives the billing month in Asia/Karachi; plain toISOString() (UTC) is a month behind between 00:00–05:00 PKT on the 1st
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

function pinnedGroup() {
  return addBillingGroup([], { groupTitle: 'Khan Family', memberIds: ['a', 'b', 'c'] })[0];
}

test('PINNED: 3 connections 2,000 + 3,000 + 1,500 = 6,500 group total', () => {
  const s = pinnedState();
  const due = buildGroupDue(pinnedGroup(), s.customers, month, calculatePaymentAllocations(s));
  assert.equal(due.totalCents, 650000);
  assert.equal(due.payableCount, 3);
  assert.deepEqual(due.members.map((m) => m.dueCents), [200000, 300000, 150000]);
});

test('PINNED: Collect Group Full marks all 3 paid and makes a combined Rs. 6,500 receipt', () => {
  const s = pinnedState();
  const group = pinnedGroup();
  const result = collectGroupFull(s, group, {
    date: today, method: 'Cash', month,
    allocations: calculatePaymentAllocations(s),
    execute: executeQuickCollection
  });
  assert.equal(result.collected, true);
  assert.equal(result.paidCount, 3);
  assert.equal(result.totalCents, 650000);
  assert.deepEqual(result.outcomes.map((o) => o.outcome), ['paid', 'paid', 'paid']);
  // Every member's own current-month bill is now settled (real engine).
  const after = calculatePaymentAllocations(result.nextState);
  for (const id of ['a', 'b', 'c']) {
    assert.equal(after.forMonth(id, month).balanceDueCents, 0, `${id} must be paid`);
  }
  const receipt = buildGroupReceipt({ ...result, date: today, method: 'Cash' });
  assert.match(receipt.text, /Rs\. 6,500/);
  assert.match(receipt.text, /TOTAL: Rs\. 6,500/);
  for (const name of ['Customer 1', 'Customer 2', 'Customer 3']) {
    assert.ok(receipt.text.includes(name), `receipt must list ${name}`);
  }
  assert.match(receipt.text, /Customer 1.*Rs\. 2,000/);
  assert.match(receipt.text, /Customer 2.*Rs\. 3,000/);
  assert.match(receipt.text, /Customer 3.*Rs\. 1,500/);
  assert.match(receipt.whatsappText, /مشترکہ رسید/);
  assert.match(receipt.whatsappText, /Rs\. 6,500/);
});

test('zero-due member contributes zero and never breaks the total', () => {
  let s = pinnedState();
  s = addPayment(s, 'c', month, { date: today, amount: 1500, method: 'Cash' }); // c settled
  const group = addBillingGroup([], { groupTitle: 'Mixed', memberIds: ['a', 'b', 'c'] })[0];
  const due = buildGroupDue(group, s.customers, month, calculatePaymentAllocations(s));
  assert.equal(due.totalCents, 500000);
  assert.deepEqual(due.members.map((m) => m.status), ['due', 'due', 'paid']);
  const result = collectGroupFull(s, group, {
    date: today, method: 'Cash', month,
    allocations: calculatePaymentAllocations(s),
    execute: executeQuickCollection
  });
  assert.equal(result.totalCents, 500000);
  assert.equal(result.paidCount, 2);
  assert.equal(result.outcomes.find((o) => o.customerId === 'c').outcome, 'skipped-paid');
});

test('no-bill member is skipped with Rs. 0; archived member is skipped and excluded from the total', () => {
  let s = pinnedState();
  s.customers.push(customer('d', 4)); // no bill for the month
  // Archived AFTER a bill was generated (saveBillMonth refuses archived
  // customers, so the bill is attached directly — the real-world shape).
  s.customers.push(customer('e', 5, {
    archived: true,
    bills: [{ month, dueAmount: 9000, status: 'pending', payments: [] }]
  }));
  const group = addBillingGroup([], { groupTitle: 'Edge', memberIds: ['a', 'd', 'e'] })[0];
  const due = buildGroupDue(group, s.customers, month, calculatePaymentAllocations(s));
  assert.equal(due.totalCents, 200000, 'archived 9,000 must not enter the total');
  assert.deepEqual(due.members.map((m) => m.status), ['due', 'no-bill', 'archived']);
  const result = collectGroupFull(s, group, {
    date: today, method: 'Cash', month,
    allocations: calculatePaymentAllocations(s),
    execute: executeQuickCollection
  });
  assert.equal(result.totalCents, 200000);
  assert.equal(result.outcomes.find((o) => o.customerId === 'd').outcome, 'skipped-no-bill');
  assert.equal(result.outcomes.find((o) => o.customerId === 'e').outcome, 'skipped-archived');
});

test('all-or-nothing: a member failure names the member and saves nothing', () => {
  const s = pinnedState();
  const group = pinnedGroup();
  const failingExecute = (st, fields) => {
    if (fields.customerId === 'b') throw new Error('payment rejected');
    return { nextState: addPayment(st, fields.customerId, fields.month, { date: fields.date, amount: fields.amount, method: fields.method }) };
  };
  assert.throws(
    () => collectGroupFull(s, group, { date: today, method: 'Cash', month, execute: failingExecute }),
    /Customer 2: payment rejected — nothing was saved\./
  );
  // Original state untouched: member a has no new payment.
  const aBill = s.customers.find((c) => c.id === 'a').bills.find((b) => b.month === month);
  assert.equal((aBill.payments ?? []).length, 0);
});

test('groups are links, never merges: members keep their own records', () => {
  const s = pinnedState();
  const group = pinnedGroup();
  const result = collectGroupFull(s, group, {
    date: today, method: 'Cash', month,
    allocations: calculatePaymentAllocations(s),
    execute: executeQuickCollection
  });
  assert.deepEqual(Object.keys(group).sort(), ['billingGroupId', 'createdAt', 'groupTitle', 'memberIds']);
  for (const id of ['a', 'b', 'c']) {
    const before = s.customers.find((c) => c.id === id);
    const after = result.nextState.customers.find((c) => c.id === id);
    assert.equal(after.name, before.name);
    assert.equal(after.customerNumber, before.customerNumber);
    assert.equal(after.bills.length, before.bills.length, 'no bills merged or invented');
  }
});

test('sanitize: malformed rows dropped, member ids deduped, missing ids filled', () => {
  const clean = sanitizeBillingGroups([
    null,
    { groupTitle: '  ', memberIds: ['a'] },
    { groupTitle: 'Good', memberIds: [] },
    { groupTitle: '  Family  ', memberIds: ['a', 'a', ' ', 'b'], billingGroupId: 'GRP-105', createdAt: '2026-10-28' },
    { groupTitle: 'NoId', memberIds: ['c'] }
  ]);
  assert.equal(clean.length, 2);
  assert.deepEqual(clean[0].memberIds, ['a', 'b']);
  assert.equal(clean[0].billingGroupId, 'GRP-105');
  assert.equal(clean[0].groupTitle, 'Family');
  assert.match(clean[1].billingGroupId, /^GRP-\d+$/);
  assert.equal(nextGroupId(clean), 'GRP-106');
});

test('add/update/delete validation', () => {
  assert.throws(() => addBillingGroup([], { groupTitle: ' ', memberIds: ['a'] }), /title is required/);
  assert.throws(() => addBillingGroup([], { groupTitle: 'X', memberIds: [] }), /at least one connection/);
  assert.throws(() => addBillingGroup([], { groupTitle: 'X', memberIds: [' ', ''] }), /at least one connection/);
  const groups = addBillingGroup([], { groupTitle: 'Old', memberIds: ['a'] });
  assert.throws(() => updateBillingGroup(groups, 'GRP-999', { groupTitle: 'New', memberIds: ['a'] }), /not found/);
  const updated = updateBillingGroup(groups, groups[0].billingGroupId, { groupTitle: 'New', memberIds: ['a', 'b'] });
  assert.equal(updated[0].groupTitle, 'New');
  assert.deepEqual(updated[0].memberIds, ['a', 'b']);
  assert.equal(deleteBillingGroup(updated, groups[0].billingGroupId).length, 0);
});

test('groupMembers follows group order and skips unknown ids', () => {
  const customers = [customer('b', 2), customer('a', 1)];
  const group = { billingGroupId: 'GRP-101', groupTitle: 'T', memberIds: ['a', 'missing', 'b'] };
  assert.deepEqual(groupMembers(group, customers).map((c) => c.id), ['a', 'b']);
});

test('memberDueCents falls back to the bill record without allocations', () => {
  const c = customer('x', 9);
  c.bills = [{ month, dueAmount: 1000, payments: [{ amount: 400 }] }];
  assert.deepEqual(memberDueCents(c, month, undefined), { dueCents: 60000, status: 'due' });
  assert.deepEqual(memberDueCents(customer('y', 10), month, undefined), { dueCents: 0, status: 'no-bill' });
});

test('dashboard summary counts groups and collectible totals', () => {
  const s = pinnedState();
  const groups = [
    addBillingGroup([], { groupTitle: 'G1', memberIds: ['a', 'b'] })[0],
    addBillingGroup([], { groupTitle: 'G2', memberIds: ['c'] })[0]
  ];
  const summary = billingGroupsSummary(groups, s.customers, month, calculatePaymentAllocations(s));
  assert.equal(summary.groupCount, 2);
  assert.equal(summary.groupsWithDue, 2);
  assert.equal(summary.totalDueCents, 650000);
});

test('storage round-trip uses the group key and sanitizes on load', () => {
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v)
  };
  assert.deepEqual(loadBillingGroups(storage), []);
  const groups = addBillingGroup([], { groupTitle: 'Store', memberIds: ['a', 'b'] });
  assert.equal(saveBillingGroups(groups, storage), true);
  assert.equal(store.get(GROUP_BILLING_KEY).includes('Store'), true);
  assert.equal(loadBillingGroups(storage).length, 1);
  store.set(GROUP_BILLING_KEY, 'not json{');
  assert.deepEqual(loadBillingGroups(storage), []);
});

test('backup: adopt when this device has none; conflict when both differ', () => {
  const groups = addBillingGroup([], { groupTitle: 'Backup Family', memberIds: ['a', 'b'] });
  const backupText = createJsonBackup(createInitialState(), new Date('2026-10-31T12:00:00+05:00'), { billingGroups: groups });
  assert.ok(backupText.includes('Backup Family'), 'backup must carry the group link');
  const preview = previewJsonBackupMerge(createInitialState(), backupText);
  assert.equal(preview.billingGroups.length, 1);
  assert.equal(preview.billingGroups[0].groupTitle, 'Backup Family');
  const other = addBillingGroup([], { groupTitle: 'Different', memberIds: ['a'] });
  const clash = previewJsonBackupMerge(createInitialState(), backupText, { currentBillingGroups: other, currentBillingGroupsStored: true });
  assert.equal(clash.billingGroups, null);
  assert.ok(clash.conflicts.some((c) => c.field === 'Billing group records differ from this device'));
  const identical = previewJsonBackupMerge(createInitialState(), backupText, { currentBillingGroups: groups, currentBillingGroupsStored: true });
  assert.equal(identical.billingGroups, null);
  assert.equal(identical.conflicts.length, 0);
});

test('formatGroupPKR groups thousands and shows paise only when needed', () => {
  assert.equal(formatGroupPKR(650000), 'Rs. 6,500');
  assert.equal(formatGroupPKR(0), 'Rs. 0');
  assert.equal(formatGroupPKR(150050), 'Rs. 1,500.50');
});
