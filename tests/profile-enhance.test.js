import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  addPayment,
  createInitialState,
  saveBillMonth,
  summarizeCustomerTenure,
  updateCustomerProfile
} from '../core.js';
import { buildCustomerPaymentBehavior } from '../owner-insights.js';

const today = new Date('2026-10-28T12:00:00+05:00');
const customerId = 'seed-001';
const makeState = () => createInitialState(['Ali']);

function historyState() {
  let state = makeState();
  const bill = (month, amount = 1000) =>
    saveBillMonth(state, customerId, { month, dueAmount: String(amount), status: 'pending' }, today);
  const payment = (month, date, amount) =>
    addPayment(state, customerId, month, { date, amount: String(amount), method: 'Cash' }, today);
  state = bill('2026-06'); state = payment('2026-06', '2026-06-08', 1000);
  state = bill('2026-07'); state = payment('2026-07', '2026-07-05', 1000);
  state = bill('2026-08'); state = payment('2026-08', '2026-08-06', 200);
  state = bill('2026-09'); state = payment('2026-09', '2026-09-10', 1000);
  state = bill('2026-10'); state = payment('2026-10', '2026-10-06', 250);
  return state;
}

test('editing the connection date fixes Time with ISP: not-recorded becomes a computed tenure', () => {
  const before = makeState();
  assert.equal(summarizeCustomerTenure(before.customers[0], today).status, 'not-recorded');
  assert.equal(summarizeCustomerTenure(before.customers[0], today).serviceMonths, null);

  const after = updateCustomerProfile(before, customerId, { connectionDate: '2026-06-01' });
  const tenure = summarizeCustomerTenure(after.customers[0], today);
  assert.equal(tenure.status, 'current');
  assert.equal(tenure.serviceMonths, 5);
  assert.equal(tenure.connectionDate, '2026-06-01');
});

test('editing package + monthly selling amount updates the stored fields the stats read', () => {
  const state = updateCustomerProfile(makeState(), customerId, {
    packageSpeed: '3Mbps / 100GB',
    monthlySellingAmount: '1000'
  });
  const customer = state.customers[0];
  assert.equal(customer.packageSpeed, '3Mbps / 100GB');
  assert.equal(customer.monthlySellingAmount, 1000);
});

test('editing one field preserves unshown customer fields (merge, never replace)', () => {
  let state = updateCustomerProfile(makeState(), customerId, {
    cnic: '12345-1234567-1',
    notes: 'keep me'
  });
  state = updateCustomerProfile(state, customerId, { connectionDate: '2026-06-01' });
  assert.equal(state.customers[0].cnic, '12345-1234567-1');
  assert.equal(state.customers[0].notes, 'keep me');
  assert.equal(state.customers[0].connectionDate, '2026-06-01');
});

test('stats stay computed: bogus stored stat fields never leak into payment behavior', () => {
  const state = historyState();
  const before = buildCustomerPaymentBehavior(state, customerId, today);
  assert.equal(before.totalPaymentAmount, 3450);
  assert.equal(before.totalPayments, 5);

  // An operator must never be able to hand-write a stat: even if junk fields
  // somehow land on the record, the builders recompute from bills/receipts.
  state.customers[0].totalReceived = 999999;
  state.customers[0].averageMonthlyPayment = 1;
  state.customers[0].totalOutstanding = 0;
  const after = buildCustomerPaymentBehavior(state, customerId, today);
  assert.equal(after.totalPaymentAmount, 3450);
  assert.equal(after.totalPayments, 5);
  assert.equal(after.averageMonthlyPayment, 690);
});

test('dark mode: the stats section container and receipt rows use dark tokens, never light backgrounds', () => {
  const css = readFileSync(new URL('../dark-contrast.css', import.meta.url), 'utf8');
  const sectionRule = /\[data-theme="dark"\] \.customer-receipt-summary \{[^}]*\}/.exec(css);
  assert.ok(sectionRule, 'dark override for .customer-receipt-summary exists');
  assert.match(sectionRule[0], /var\(--dk-surface\)/);
  assert.match(sectionRule[0], /background-image: none/);
  assert.doesNotMatch(sectionRule[0], /#fff|#f2faf6/);
  const rowRule = /\[data-theme="dark"\] \.receipt-month-row \{[^}]*\}/.exec(css);
  assert.ok(rowRule, 'dark override for .receipt-month-row exists');
  assert.match(rowRule[0], /var\(--dk-surface-2\)/);
  assert.doesNotMatch(rowRule[0], /#fff|rgba\(255,255,255/);
});

test('stats section header carries an Edit customer action wired to the existing edit flow', () => {
  const appJs = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(appJs, /profile-summary-heading/);
  assert.match(appJs, /data-edit-customer/);
  assert.match(appJs, /querySelector\('\[data-edit-customer\]'\)/);
  assert.match(appJs, /editCustomerProfile\(id\)/);
  // No stored stat-override field is introduced by the stats markup.
  assert.doesNotMatch(appJs, /statOverride|storedTotalReceived/);
});
