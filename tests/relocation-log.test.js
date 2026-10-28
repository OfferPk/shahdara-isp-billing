/**
 * tests/relocation-log.test.js — SISP-28: Customer House Shift /
 * Relocation & Package Change Audit Log.
 *
 * Pure-function coverage: sanitizers, recordCustomerRelocation (zone /
 * address update, current-bill fee, historical-bill preservation),
 * timeline merge, and JSON backup round-trip. Tests use synthetic data
 * only; no real customer, bill, or staff record is touched.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState, addCustomer, saveBillMonth, updateCustomerProfile,
  calculatePaymentAllocations, recordCustomerRelocation,
  createJsonBackup, previewJsonBackupMerge
} from '../core.js';
import {
  sanitizeRelocationLog, buildRelocationTimeline, renderRelocationTimeline
} from '../relocation-log.js';

// PKT 2026-10-28: current month is 2026-10, previous month 2026-09.
const ref = new Date('2026-10-28T12:00:00+05:00');

function setup(withCurrentBill = true) {
  let state = createInitialState([]);
  state = addCustomer(state, 'Test Customer', ref, { zone: 'Shahdara Town', address: 'Old Street 1' });
  const id = state.customers[0].id;
  state = saveBillMonth(state, id, { month: '2026-09', dueAmount: 2000, status: 'pending' }, ref);
  if (withCurrentBill) {
    state = saveBillMonth(state, id, { month: '2026-10', dueAmount: 1500, status: 'pending' }, ref);
  }
  return { state, id };
}

test('PINNED: Shahdara Town -> Barrian with Rs 1000 fee updates zone, preserves history, adds dues, logs entry', () => {
  const { state, id } = setup();
  const before = state.customers[0];
  const historicalBefore = before.bills.find(bill => bill.month === '2026-09');
  const dueBefore = calculatePaymentAllocations(state).forMonth(id, '2026-10').balanceDueCents;
  assert.equal(dueBefore, 150000);

  const after = recordCustomerRelocation(state, id, {
    toAddress: 'New Street 9',
    toZone: 'Barrian',
    extraFiberMeters: 40,
    shiftingFee: 1000,
    addFeeToBill: true,
    shiftedAt: '2026-10-28'
  }, ref);
  const customer = after.customers[0];

  // Active zone/address updated.
  assert.equal(customer.zone, 'Barrian');
  assert.equal(customer.address, 'New Street 9');
  // Mohalla untouched (zone/address only).
  assert.equal(customer.mohalla, before.mohalla);
  // Installed fiber drop length untouched — extra meters are logged only.
  assert.equal(customer.fiberMeters, before.fiberMeters);
  // Historical bill preserved byte-for-byte.
  assert.deepEqual(customer.bills.find(bill => bill.month === '2026-09'), historicalBefore);
  // Pending dues for the current month rise by exactly Rs 1,000.
  const dueAfter = calculatePaymentAllocations(after).forMonth(id, '2026-10').balanceDueCents;
  assert.equal(dueAfter - dueBefore, 100000);
  // The relocation entry is logged.
  assert.equal(customer.relocationLog.length, 1);
  const entry = customer.relocationLog[0];
  assert.equal(entry.id, 'REL-1');
  assert.equal(entry.fromZone, 'Shahdara Town');
  assert.equal(entry.toZone, 'Barrian');
  assert.equal(entry.fromAddress, 'Old Street 1');
  assert.equal(entry.toAddress, 'New Street 9');
  assert.equal(entry.extraFiberMeters, 40);
  assert.equal(entry.shiftingFee, 1000);
  assert.equal(entry.feeAppliedToBill, true);
  assert.equal(entry.feeBillMonth, '2026-10');
  assert.equal(entry.shiftedAt, '2026-10-28');
  // Original state untouched (pure function).
  assert.equal(state.customers[0].zone, 'Shahdara Town');
  assert.deepEqual(state.customers[0].relocationLog, []);
});

test('fee without a current-month bill is logged only and invents no bill', () => {
  const { state, id } = setup(false);
  const after = recordCustomerRelocation(state, id, {
    toAddress: 'New Street 9', toZone: 'Barrian',
    shiftingFee: 500, addFeeToBill: true, shiftedAt: '2026-10-28'
  }, ref);
  const customer = after.customers[0];
  assert.equal(customer.zone, 'Barrian');
  assert.equal(customer.bills.length, 1);
  assert.equal(customer.bills[0].month, '2026-09');
  assert.equal(customer.relocationLog[0].shiftingFee, 500);
  assert.equal(customer.relocationLog[0].feeAppliedToBill, false);
  assert.equal(customer.relocationLog[0].feeBillMonth, null);
});

test('fee without the add-to-bill tick stays off the bill', () => {
  const { state, id } = setup();
  const dueBefore = calculatePaymentAllocations(state).forMonth(id, '2026-10').balanceDueCents;
  const after = recordCustomerRelocation(state, id, {
    toAddress: 'New Street 9', toZone: 'Barrian',
    shiftingFee: 1000, addFeeToBill: false, shiftedAt: '2026-10-28'
  }, ref);
  const customer = after.customers[0];
  assert.equal(calculatePaymentAllocations(after).forMonth(id, '2026-10').balanceDueCents, dueBefore);
  assert.equal(customer.relocationLog[0].feeAppliedToBill, false);
  assert.equal(customer.bills.find(bill => bill.month === '2026-10').shiftingFee, undefined);
});

test('validation: blank new address/zone and negative fiber/fee throw', () => {
  const { state, id } = setup();
  assert.throws(() => recordCustomerRelocation(state, id, { toAddress: '', toZone: 'Barrian' }, ref), /new house address/);
  assert.throws(() => recordCustomerRelocation(state, id, { toAddress: 'X', toZone: '  ' }, ref), /new zone/);
  assert.throws(() => recordCustomerRelocation(state, id, { toAddress: 'X', toZone: 'Barrian', extraFiberMeters: -5 }, ref), /fiber meters/);
  assert.throws(() => recordCustomerRelocation(state, id, { toAddress: 'X', toZone: 'Barrian', shiftingFee: -1 }, ref), /Shifting fee/);
  assert.throws(() => recordCustomerRelocation(state, 'missing-id', { toAddress: 'X', toZone: 'Barrian' }, ref), /not found/);
});

test('second shift in the same month accumulates the fee and sequences ids', () => {
  const { state, id } = setup();
  let after = recordCustomerRelocation(state, id, {
    toAddress: 'Street 2', toZone: 'Barrian', shiftingFee: 1000, addFeeToBill: true, shiftedAt: '2026-10-10'
  }, ref);
  after = recordCustomerRelocation(after, id, {
    toAddress: 'Street 3', toZone: 'Charyaa', shiftingFee: 500, addFeeToBill: true, shiftedAt: '2026-10-28'
  }, ref);
  const customer = after.customers[0];
  assert.equal(customer.zone, 'Charyaa');
  assert.deepEqual(customer.relocationLog.map(entry => entry.id), ['REL-1', 'REL-2']);
  assert.equal(customer.bills.find(bill => bill.month === '2026-10').shiftingFee, 1500);
  assert.equal(calculatePaymentAllocations(after).forMonth(id, '2026-10').balanceDueCents, 300000);
});

test('sanitize drops malformed rows and keeps clean entries in order', () => {
  assert.deepEqual(sanitizeRelocationLog(null), []);
  assert.deepEqual(sanitizeRelocationLog('nope'), []);
  const cleaned = sanitizeRelocationLog([
    null,
    { toAddress: '', toZone: 'Barrian', shiftedAt: '2026-10-28' },
    { id: 'REL-1', fromZone: 'A', toZone: 'Barrian', toAddress: 'X', shiftedAt: '2026-10-28', shiftingFee: 1000, feeAppliedToBill: true, feeBillMonth: '2026-10' },
    { id: 'REL-2', toZone: 'Charyaa', toAddress: 'Y', shiftedAt: 'not-a-date' }
  ]);
  assert.equal(cleaned.length, 1);
  assert.equal(cleaned[0].id, 'REL-1');
});

test('timeline merges shifts and package changes newest-first', () => {
  const { state, id } = setup();
  let after = recordCustomerRelocation(state, id, {
    toAddress: 'Street 2', toZone: 'Barrian', shiftedAt: '2026-10-20'
  }, ref);
  after = updateCustomerProfile(after, id, { packageSpeed: '10 Mbps' }, ref);
  const customer = after.customers[0];
  const rows = buildRelocationTimeline(customer);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].kind, 'package');
  assert.equal(rows[0].date, '2026-10-28');
  assert.equal(rows[1].kind, 'relocation');
  assert.equal(rows[1].date, '2026-10-20');
  assert.match(rows[1].title, /Barrian/);
  const html = renderRelocationTimeline(customer);
  assert.match(html, /Barrian/);
  assert.match(html, /Package:/);
  assert.equal(renderRelocationTimeline({ relocationLog: [], packageHistory: [] }).includes('No house shifts'), true);
});

test('backup round-trip: relocation log survives export + merge without duplication', () => {
  const { state, id } = setup();
  const relocated = recordCustomerRelocation(state, id, {
    toAddress: 'New Street 9', toZone: 'Barrian',
    extraFiberMeters: 40, shiftingFee: 1000, addFeeToBill: true, shiftedAt: '2026-10-28'
  }, ref);
  const backupText = createJsonBackup(relocated, new Date('2026-10-28T12:00:00+05:00'));
  const fresh = createInitialState([]);
  const preview = previewJsonBackupMerge(fresh, backupText);
  const imported = preview.state.customers.find(customer => customer.id === id);
  assert.ok(imported, 'relocated customer must import from the backup');
  assert.equal(imported.relocationLog.length, 1);
  assert.equal(imported.relocationLog[0].toZone, 'Barrian');
  assert.equal(imported.relocationLog[0].shiftingFee, 1000);
  assert.equal(imported.bills.find(bill => bill.month === '2026-10').shiftingFee, 1000);
  // Merging the same backup into the already-relocated state adds nothing twice.
  const remerged = previewJsonBackupMerge(relocated, backupText);
  const again = remerged.state.customers.find(customer => customer.id === id);
  assert.equal(again.relocationLog.length, 1);
});
