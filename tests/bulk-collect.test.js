import test from 'node:test';
import assert from 'node:assert/strict';
import { addPayment, saveBillMonth, calculatePaymentAllocations } from '../core.js';
import {
  createBatch, findDuplicate, addEntry, removeEntry, undoLast, canUndo, batchTotals,
  pendingForBatch, isAllCollected, entryDefaults, commitBatch, searchCustomersForBatch
} from '../bulk-collect.js';
import { getPendingCollectionCustomers, renderQuickCollectPickerHtml, executeQuickCollection, countCustomersWithoutFee } from '../nav-quick-collect.js';
import { customersWithoutFee, assignPackage, generateBillsNow } from '../collect-setup.js';

const now = new Date();
const month = now.toISOString().slice(0, 7);
const today = new Date(now.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 10); // PKT
const customer = (id, n, extra = {}) => ({ id, customerNumber: n, name: `Customer ${n}`, phone: `0300000000${n}`, area: n % 2 ? 'Jia Musa' : 'Begum Kot', archived: false, bills: [], ...extra });

function makeState() {
  let s = { customers: [customer('a', 1), customer('b', 2), customer('c', 3), customer('d', 4)] };
  s = saveBillMonth(s, 'a', { month, dueAmount: 2000, status: 'pending' });
  s = saveBillMonth(s, 'b', { month, dueAmount: 1500, status: 'pending' });
  s = saveBillMonth(s, 'c', { month, dueAmount: 1000, status: 'pending' });
  s = addPayment(s, 'c', month, { date: '2026-10-01', amount: 1000, method: 'Cash' }); // fully paid
  s = saveBillMonth(s, 'd', { month, dueAmount: 3000, status: 'pending' });
  s = addPayment(s, 'd', month, { date: '2026-10-02', amount: 1200, method: 'Cash' }); // partial
  return s;
}
const fieldsFor = (s, b, id, extra = {}) => ({ ...entryDefaults(s, b, id), method: 'Cash', note: '', ...extra });

test('pending list excludes fully paid customers and keeps partial ones with the remaining amount', () => {
  const s = makeState();
  const rows = getPendingCollectionCustomers(s, '', 'all-dues');
  assert.deepEqual(rows.map(r => r.id).sort(), ['a', 'b', 'd']);
  assert.equal(rows.find(r => r.id === 'd').totalDues, 1800);
  assert.ok(getPendingCollectionCustomers(s, '', 'all').some(r => r.id === 'c'), '"All" still shows paid customers');
});

test('paying a customer in full removes them from the Quick Collect pending list', () => {
  const s = makeState();
  const { nextState } = executeQuickCollection(s, { customerId: 'b', month, amount: 1500, date: today, method: 'Cash' });
  assert.ok(!getPendingCollectionCustomers(nextState, '', 'all-dues').some(r => r.id === 'b'));
  const partial = executeQuickCollection(s, { customerId: 'b', month, amount: 500, date: today, method: 'Cash' }).nextState;
  assert.equal(getPendingCollectionCustomers(partial, '', 'all-dues').find(r => r.id === 'b').totalDues, 1000);
});

test('picker: "Sab ka bill wusool ho gaya" when all bills are paid; setup state when nobody has a fee (#248)', () => {
  // No package / fee: explain and offer setup instead of a broken list.
  let s = { customers: [customer('x', 9), customer('y', 10, { archived: true })] };
  let view = renderQuickCollectPickerHtml(s, '', 'all-dues');
  assert.equal(view.allCollected, true);
  assert.equal(view.needsSetup, true);
  assert.equal(view.withoutFee, 1, 'archived customers are not counted');
  assert.match(view.html, /No pending dues/);
  assert.match(view.html, /data-qc-setup-packages/);
  assert.match(view.html, /data-qc-generate-bills/);
  assert.match(view.html, /data-qc-show-all/);
  assert.equal(isAllCollected(s), true);
  assert.match(renderQuickCollectPickerHtml(s, '', 'all').html, /qc-customer-card/, '"All" still lists customers');
  assert.match(renderQuickCollectPickerHtml(s, 'zzz', 'all-dues').html, /No matching accounts/, 'search keeps the no-match message');
  // Everyone has a fee and paid: the all-collected state.
  s = saveBillMonth({ customers: [customer('x', 9, { monthlySellingAmount: 1000 })] }, 'x', { month, dueAmount: 1000, status: 'pending' });
  s = addPayment(s, 'x', month, { date: '2026-10-01', amount: 1000, method: 'Cash' });
  view = renderQuickCollectPickerHtml(s, '', 'all-dues');
  assert.equal(view.allCollected, true);
  assert.equal(view.needsSetup, false);
  assert.match(view.html, /Sab ka bill wusool ho gaya/);
  assert.match(view.html, /data-qc-show-all/);
  s = makeState();
  view = renderQuickCollectPickerHtml(s, '', 'all-dues');
  assert.equal(view.allCollected, false);
  assert.equal(view.customers.length, 3);
});

test('setup: assignPackage sets the fee via the profile logic and generates this month\'s bill (#248)', () => {
  const s = { customers: [customer('p', 1), customer('q', 2), customer('r', 3)] };
  assert.equal(customersWithoutFee(s).length, 3);
  assert.equal(countCustomersWithoutFee(s), 3);
  const { nextState, updated, generated } = assignPackage(s, ['p', 'q', 'p'], { packageId: '5mbps-150gb' });
  assert.equal(updated, 2);
  assert.equal(generated, 2);
  const p = nextState.customers.find(c => c.id === 'p');
  assert.equal(p.monthlySellingAmount, 1500);
  assert.equal(p.packageSpeed, '5Mbps / 150GB');
  assert.equal(p.packageHistory.length, 1);
  assert.equal(p.bills.find(b => b.month === month).dueAmount, 1500);
  assert.deepEqual(getPendingCollectionCustomers(nextState, '', 'all-dues').map(c => c.id).sort(), ['p', 'q']);
  assert.deepEqual(customersWithoutFee(nextState).map(c => c.id), ['r']);
  // Custom fee.
  const custom = assignPackage(nextState, ['r'], { fee: 1234 });
  assert.equal(custom.nextState.customers.find(c => c.id === 'r').monthlySellingAmount, 1234);
  assert.throws(() => assignPackage(s, ['p'], { fee: 0 }), /greater than zero/);
  assert.throws(() => assignPackage(s, [], { fee: 100 }), /Select at least one/);
  assert.throws(() => assignPackage(s, ['p'], { packageId: 'nope' }), /available packages/);
  assert.equal(s.customers[0].bills.length, 0, 'input untouched');
});

test('setup: generateBillsNow is a no-op without fees', () => {
  const s = { customers: [customer('p', 1)] };
  const r = generateBillsNow(s);
  assert.equal(r.generated, 0);
  assert.equal(r.nextState, s);
});

test('#248 scenario: fee for 3 customers, 1 paid in full -> exactly 2 pending', () => {
  let s = { customers: [customer('a', 1), customer('b', 2), customer('c', 3), customer('d', 4)] };
  s = assignPackage(s, ['a', 'b', 'c'], { packageId: '3mbps-100gb' }).nextState;
  s = executeQuickCollection(s, { customerId: 'b', month, amount: 1000, date: today, method: 'Cash' }).nextState;
  assert.deepEqual(getPendingCollectionCustomers(s, '', 'all-dues').map(c => c.id).sort(), ['a', 'c']);
});

test('createBatch defaults to today and totals start at zero', () => {
  const b = createBatch();
  assert.match(b.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(batchTotals(b), { count: 0, total: 0, byMethod: {} });
  assert.equal(createBatch('2026-10-01').date, '2026-10-01');
});

test('entryDefaults prefills the pending amount and the earliest unpaid month', () => {
  const s = makeState();
  const d = entryDefaults(s, createBatch(today), 'd');
  assert.equal(d.amount, 1800);
  assert.equal(d.month, month);
  assert.equal(d.name, 'Customer 4');
});

test('duplicate in the same batch is blocked unless explicitly confirmed', () => {
  const s = makeState();
  let b = createBatch(today);
  b = addEntry(b, s, fieldsFor(s, b, 'a')).batch;
  const again = addEntry(b, s, fieldsFor(s, b, 'a', { amount: 500 }));
  assert.equal(again.added, null);
  assert.equal(again.duplicate.kind, 'batch');
  assert.equal(again.duplicate.entry.amount, 2000);
  assert.equal(again.batch.entries.length, 1, 'blocked duplicate is not added');
  const confirmed = addEntry(b, s, fieldsFor(s, b, 'a', { amount: 500 }), { allowDuplicate: true });
  assert.equal(confirmed.batch.entries.length, 2);
  assert.equal(confirmed.added.confirmedDuplicate, true);
});

test('duplicate check also catches a payment already recorded for the customer on the batch date', () => {
  let s = makeState();
  s = addPayment(s, 'a', month, { date: today, amount: 300, method: 'Cash' });
  const b = createBatch(today);
  const dup = findDuplicate(b, s, 'a');
  assert.equal(dup.kind, 'recorded');
  assert.equal(dup.payment.amount, 300);
  assert.equal(addEntry(b, s, fieldsFor(s, b, 'a')).added, null);
  assert.equal(findDuplicate(createBatch('2026-10-03'), s, 'a'), null, 'another date is not a duplicate');
  assert.equal(findDuplicate(b, s, 'b'), null);
});

test('duplicate popup is reachable before an amount is typed', () => {
  const s = makeState();
  let b = createBatch(today);
  b = addEntry(b, s, fieldsFor(s, b, 'a')).batch;
  const res = addEntry(b, s, { customerId: 'a', amount: '' });
  assert.equal(res.duplicate.kind, 'batch');
});

test('added customers disappear from the pending picker; a search still shows them flagged', () => {
  const s = makeState();
  let b = createBatch(today);
  b = addEntry(b, s, fieldsFor(s, b, 'a')).batch;
  assert.deepEqual(pendingForBatch(s, b).map(r => r.id).sort(), ['b', 'd']);
  const searched = pendingForBatch(s, b, 'Customer 1');
  assert.equal(searched[0].id, 'a');
  assert.equal(searched[0].inBatch, true);
  assert.deepEqual(pendingForBatch(s, b, 'Begum Kot').map(r => r.id).sort(), ['b', 'd'], 'search by area');
  assert.deepEqual(pendingForBatch(s, b, '03000000002').map(r => r.id), ['b'], 'search by mobile');
  assert.ok(!pendingForBatch(s, b).some(r => r.id === 'c'), 'fully paid never listed');
});

test('remove and undo, running totals by method', () => {
  const s = makeState();
  let b = createBatch(today);
  b = addEntry(b, s, fieldsFor(s, b, 'a')).batch;
  b = addEntry(b, s, fieldsFor(s, b, 'b', { amount: 1000.5, method: 'JazzCash' })).batch;
  b = addEntry(b, s, fieldsFor(s, b, 'd', { amount: 0.1 })).batch;
  assert.deepEqual(batchTotals(b), { count: 3, total: 3000.6, byMethod: { Cash: 2000.1, JazzCash: 1000.5 } });
  const removedId = b.entries[1].id;
  b = removeEntry(b, removedId);
  assert.deepEqual(b.entries.map(e => e.customerId), ['a', 'd']);
  assert.equal(batchTotals(b).total, 2000.1);
  assert.ok(pendingForBatch(s, b).some(r => r.id === 'b'), 'removed customer is back in the picker');
  b = undoLast(b);
  assert.deepEqual(b.entries.map(e => e.customerId), ['a', 'b', 'd'], 'undo restores at the same position');
  b = undoLast(b); // undo the add of d
  assert.deepEqual(b.entries.map(e => e.customerId), ['a', 'b']);
  b = undoLast(b); b = undoLast(b);
  assert.equal(b.entries.length, 0);
  assert.equal(canUndo(b), false);
  assert.equal(undoLast(b), b);
  assert.equal(removeEntry(b, 'missing'), b);
});

test('addEntry validates amount and method', () => {
  const s = makeState();
  const b = createBatch(today);
  assert.throws(() => addEntry(b, s, fieldsFor(s, b, 'a', { amount: 0 })), /greater than zero/);
  assert.throws(() => addEntry(b, s, fieldsFor(s, b, 'a', { method: 'Bitcoin' })), /valid payment method/);
  assert.throws(() => addEntry(b, s, { amount: 10 }), /Choose a customer/);
});

test('commitBatch records every entry through the existing payment logic', () => {
  const s = makeState();
  let b = createBatch(today);
  b = addEntry(b, s, fieldsFor(s, b, 'a')).batch;
  b = addEntry(b, s, fieldsFor(s, b, 'd', { amount: 800, method: 'Easypaisa', note: 'Saad · Jia Musa' })).batch;
  const calls = [];
  const spy = (st, f) => { calls.push(f); return executeQuickCollection(st, f); };
  const { nextState, receipts } = commitBatch(s, b, spy);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map(c => [c.customerId, c.date, c.method, c.paidBy]), [['a', today, 'Cash', ''], ['d', today, 'Easypaisa', 'Saad · Jia Musa']]);
  assert.equal(receipts.length, 2);
  const pending = getPendingCollectionCustomers(nextState, '', 'all-dues');
  assert.ok(!pending.some(r => r.id === 'a'), 'paid in full leaves the list');
  assert.equal(pending.find(r => r.id === 'd').totalDues, 1000, 'partial stays with remainder');
  const a = nextState.customers.find(c => c.id === 'a');
  assert.equal(calculatePaymentAllocations(nextState).forMonth('a', month).balanceDueCents, 0);
  assert.equal(a.bills.find(x => x.month === month).payments[0].date, today);
  assert.equal(s.customers.find(c => c.id === 'a').bills[0].payments.length, 0, 'input state untouched');
});

test('commitBatch is all-or-nothing and refuses an empty batch', () => {
  const s = makeState();
  let b = createBatch(today);
  assert.throws(() => commitBatch(s, b), /at least one payment/);
  b = addEntry(b, s, fieldsFor(s, b, 'a')).batch;
  b = addEntry(b, s, fieldsFor(s, b, 'b')).batch;
  let n = 0;
  const failing = (st, f) => { if (++n === 2) throw new Error('boom'); return executeQuickCollection(st, f); };
  assert.throws(() => commitBatch(s, b, failing), /Customer 2: boom — nothing was saved/);
});

// ---- Bulk Collect v2: search always finds customers (#249 follow-up) ----
function demoNoFees() {
  // Mirrors the demo seed: names in caps, no package, no bills.
  const names = ['NAZEER', 'AWAIS', 'TEHMENA', 'NAZIA BIBI', 'SAFEER'];
  return { customers: names.map((name, i) => customer(`seed-${i + 1}`, i + 1, { name, phone: `0321555000${i + 1}`, area: i === 3 ? 'Jia Musa' : 'Begum Kot' })) };
}

test('search nazeer finds NAZEER when no fees set', () => {
  const s = demoNoFees();
  const b = createBatch();
  const { rows, mode } = searchCustomersForBatch(s, b, 'nazeer');
  assert.equal(mode, 'search');
  assert.deepEqual(rows.map(r => r.name), ['NAZEER']);
  assert.equal(rows[0].status, 'no-bill');
  assert.equal(rows[0].totalDues, 0);
  // and the pending-only picker (the v1 bug) really had nothing
  assert.equal(pendingForBatch(s, b, 'nazeer').length, 0);
});

test('search is case-insensitive, partial, and matches mobile, area and customer #', () => {
  const s = demoNoFees();
  const b = createBatch();
  const names = q => searchCustomersForBatch(s, b, q).rows.map(r => r.name);
  assert.deepEqual(names('NaZ').sort(), ['NAZEER', 'NAZIA BIBI']);
  assert.deepEqual(names('azee'), ['NAZEER']);
  assert.deepEqual(names('03215550002'), ['AWAIS']);
  assert.deepEqual(names('5550005'), ['SAFEER']);
  assert.deepEqual(names('jia musa'), ['NAZIA BIBI']);
  assert.deepEqual(names('#3'), ['TEHMENA']);
  assert.deepEqual(names('zzz-none'), []);
});

test('pending customers sort first with their due; paid and no-bill customers still appear when searched', () => {
  let s = makeState();
  s = { customers: [...s.customers, customer('e', 5, { name: 'Customer 5 nobill' })] };
  const b = createBatch();
  const { rows } = searchCustomersForBatch(s, b, 'customer');
  assert.deepEqual(rows.map(r => r.id), ['a', 'd', 'b', 'c', 'e'], 'dues desc first, then the rest by number');
  assert.deepEqual(rows.map(r => r.status), ['due', 'due', 'due', 'paid', 'no-bill']);
  assert.equal(rows.find(r => r.id === 'd').totalDues, 1800);
});

test('empty search shows the pending list, or every customer when nobody is pending — never empty', () => {
  const pending = searchCustomersForBatch(makeState(), createBatch(), '');
  assert.equal(pending.mode, 'pending');
  assert.deepEqual(pending.rows.map(r => r.id), ['a', 'd', 'b']);
  const none = searchCustomersForBatch(demoNoFees(), createBatch(), '');
  assert.equal(none.mode, 'all');
  assert.equal(none.rows.length, 5);
});

test('added customers leave the default list but stay findable, flagged and sorted last', () => {
  const s = demoNoFees();
  let b = createBatch();
  b = addEntry(b, s, fieldsFor(s, b, 'seed-1', { amount: 500 })).batch;
  assert.ok(!searchCustomersForBatch(s, b, '').rows.some(r => r.id === 'seed-1'));
  const naz = searchCustomersForBatch(s, b, 'naz').rows;
  assert.deepEqual(naz.map(r => [r.name, r.inBatch]), [['NAZIA BIBI', false], ['NAZEER', true]]);
  // adding NAZEER again still triggers the "Already added" duplicate check
  const again = addEntry(b, s, fieldsFor(s, b, 'seed-1', { amount: 100 }));
  assert.equal(again.added, null);
  assert.ok(again.duplicate);
  assert.equal(again.batch.entries.length, 1);
});

test('a customer with no bill can be paid with a manually entered amount', () => {
  const s = demoNoFees();
  let b = createBatch();
  assert.equal(entryDefaults(s, b, 'seed-1').amount, 0, 'nothing to prefill');
  assert.throws(() => addEntry(b, s, fieldsFor(s, b, 'seed-1')), /greater than zero/, 'no due: amount must be typed');
  const add = addEntry(b, s, fieldsFor(s, b, 'seed-1', { amount: 750 }));
  assert.ok(add.added);
  const res = commitBatch(s, add.batch);
  const nazeer = res.nextState.customers.find(c => c.id === 'seed-1');
  const paid = nazeer.bills.flatMap(bill => bill.payments ?? []).reduce((t, p) => t + Number(p.amount), 0);
  assert.equal(paid, 750);
});
