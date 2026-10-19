import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlan, applyCustomerPlan } from '../customer-plan.js';
import { addCustomer } from '../core.js';
import { getPendingCollectionCustomers } from '../nav-quick-collect.js';
import { searchCustomersForBatch, createBatch } from '../bulk-collect.js';

const now = new Date();
const month = new Date(now.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 7);
const today = new Date(now.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 10);
const fresh = () => addCustomer({ version: 1, nextCustomerNumber: 1, customers: [] }, 'Zubair Test', now, { phone: '03001234567' });

test('#289 normalizePlan: package fills the fee, typed fee wins, nothing entered = no plan', () => {
  assert.deepEqual(normalizePlan({ packageId: '5mbps-150gb', fee: '', connectionDate: today }), { packageLabel: '5Mbps / 150GB', fee: 1500, connectionDate: today });
  assert.deepEqual(normalizePlan({ packageId: '5mbps-150gb', fee: '1400', connectionDate: today }), { packageLabel: '5Mbps / 150GB', fee: 1400, connectionDate: today });
  assert.deepEqual(normalizePlan({ fee: '1500', connectionDate: today }), { packageLabel: '', fee: 1500, connectionDate: today });
  assert.equal(normalizePlan({}), null);
  assert.deepEqual(normalizePlan({ connectionDate: today }), { packageLabel: '', fee: null, connectionDate: today });
  assert.throws(() => normalizePlan({ fee: '-5' }), /greater than zero/);
  assert.throws(() => normalizePlan({ packageId: 'nope' }), /available packages/);
});

test('#289 add customer with fee 1500: this month\'s bill is created and they are pending in Quick + Bulk Collect', () => {
  let s = fresh();
  const id = s.customers[0].id;
  assert.equal(getPendingCollectionCustomers(s, '', 'all-dues').length, 0, 'before: not collectable');
  const { nextState, billed } = applyCustomerPlan(s, id, normalizePlan({ packageId: '5mbps-150gb', connectionDate: today }));
  const c = nextState.customers[0];
  assert.equal(c.monthlySellingAmount, 1500);
  assert.equal(c.packageSpeed, '5Mbps / 150GB');
  assert.equal(c.connectionDate, today);
  assert.equal(billed.month, month);
  assert.equal(Number(billed.dueAmount), 1500);
  const pending = getPendingCollectionCustomers(nextState, '', 'all-dues');
  assert.deepEqual(pending.map(r => [r.id, r.totalDues]), [[id, 1500]]);
  const bulk = searchCustomersForBatch(nextState, createBatch(), '');
  assert.equal(bulk.mode, 'pending');
  assert.equal(bulk.rows[0].id, id);
  assert.equal(bulk.rows[0].totalDues, 1500);
  // Package history is kept like the profile Edit form.
  assert.ok((c.packageHistory ?? []).length >= 1);
});

test('#289 name-only add stays billless; connection date alone is saved without a bill', () => {
  const s = fresh();
  const id = s.customers[0].id;
  assert.equal(applyCustomerPlan(s, id, null).nextState, s);
  const { nextState, billed } = applyCustomerPlan(s, id, normalizePlan({ connectionDate: today }));
  assert.equal(billed, null);
  assert.equal(nextState.customers[0].connectionDate, today);
  assert.equal(nextState.customers[0].bills.length, 0);
});
