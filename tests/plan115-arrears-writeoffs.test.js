import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  validWriteOffDate,
  writeOffAmountCents,
  normalizeWriteOff,
  normalizeWriteOffList,
  findWriteOff,
  writeOffsForCustomer,
  writtenOffBillIds,
  isBillWrittenOff,
  writeOffAmountForBill,
  upsertWriteOff,
  reconcileDues,
  liveCollectionList,
  writeOffSummaryText,
  reconcileDuesText,
  writeOffHtml,
  writeOffCsv,
  writeOffFilename,
} from '../arrears-writeoffs.js';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'arrears-writeoffs.js'), 'utf8');
const html = readFileSync(join(here, '..', 'index.html'), 'utf8');

const record = (overrides = {}) => ({
  id: 'WO-1',
  customerId: 'CUST-76',
  customerName: 'Orient school',
  bills: [{ billId: 'BILL-1', amountCents: 150000 }],
  reason: 'Customer left the area, unreachable for six months',
  approver: 'Owner',
  approvalId: 'APPR-1',
  writeOffDate: '2026-10-31',
  ...overrides,
});

const bills = [
  { id: 'BILL-1', customerId: 'CUST-76', amountCents: 150000 },
  { id: 'BILL-2', customerId: 'CUST-76', amountCents: 200000 },
  { id: 'BILL-3', customerId: 'CUST-9', amountCents: 50000 },
];

test('plan115: strict dates', () => {
  assert.equal(validWriteOffDate('2026-10-31'), true);
  assert.equal(validWriteOffDate('2026-02-30'), false);
  assert.equal(validWriteOffDate('2026-13-01'), false);
  assert.equal(validWriteOffDate('31-10-2026'), false);
  assert.equal(normalizeWriteOff(record({ writeOffDate: '2026-02-30' })), null);
});

test('plan115: half-formed write-offs refused, unknown fields dropped', () => {
  assert.equal(normalizeWriteOff(record({ customerId: '' })), null);
  assert.equal(normalizeWriteOff(record({ bills: [] })), null);
  assert.equal(normalizeWriteOff(record({ bills: [{ billId: '', amountCents: 100 }] })), null);
  assert.equal(normalizeWriteOff(record({ bills: [{ billId: 'BILL-1', amountCents: 0 }] })), null);
  assert.equal(normalizeWriteOff(record({ bills: [{ billId: 'BILL-1' }, { billId: 'BILL-1', amountCents: 100 }] })), null);
  assert.equal(normalizeWriteOff(record({ reason: '' })), null);
  assert.equal(normalizeWriteOff(record({ approver: '' })), null);
  assert.equal(normalizeWriteOff(record({ approvalId: '' })), null);
  const kept = normalizeWriteOff(record({ paymentId: 'PAY-9', secretNote: 'drop me' }));
  assert.notEqual(kept, null);
  assert.equal('paymentId' in kept, false);
  assert.equal('secretNote' in kept, false);
});

test('plan115: rupees convert once, cents pass through as-is', () => {
  assert.equal(writeOffAmountCents({ amount: 1500 }, 'amountCents', 'amount'), 150000);
  assert.equal(writeOffAmountCents({ amountCents: 150000 }, 'amountCents', 'amount'), 150000);
  assert.equal(writeOffAmountCents({ amount: '1500.50' }, 'amountCents', 'amount'), 150050);
  assert.equal(writeOffAmountCents({}, 'amountCents', 'amount'), null);
  const viaRupees = normalizeWriteOff(record({ bills: [{ billId: 'BILL-1', amount: 1500 }] }));
  assert.equal(viaRupees.amountCents, 150000);
  // Re-reading a stored record never inflates: cents stay cents.
  assert.equal(normalizeWriteOff(viaRupees).amountCents, 150000);
});

test('plan115: duplicate id never rewritten', () => {
  const first = upsertWriteOff([], record());
  assert.equal(first.length, 1);
  assert.deepEqual(upsertWriteOff(first, record()), first);
  const changed = upsertWriteOff(first, record({ reason: 'A different reason' }));
  assert.deepEqual(changed, first);
  assert.equal(changed[0].reason, 'Customer left the area, unreachable for six months');
});

test('plan115: one bill written off once', () => {
  const first = upsertWriteOff([], record());
  const second = upsertWriteOff(first, record({ id: 'WO-2', bills: [{ billId: 'BILL-1', amountCents: 5000 }] }));
  assert.deepEqual(second, first);
  const other = upsertWriteOff(first, record({ id: 'WO-2', bills: [{ billId: 'BILL-2', amountCents: 5000 }] }));
  assert.equal(other.length, 2);
});

test('plan115: find, customer filter, and written-off helpers', () => {
  const list = upsertWriteOff([], record());
  assert.equal(findWriteOff(list, 'WO-1').id, 'WO-1');
  assert.equal(findWriteOff(list, 'WO-9'), null);
  assert.equal(writeOffsForCustomer(list, 'CUST-76').length, 1);
  assert.equal(writeOffsForCustomer(list, 'CUST-9').length, 0);
  assert.deepEqual(writtenOffBillIds(list), ['BILL-1']);
  assert.equal(isBillWrittenOff(list, 'BILL-1'), true);
  assert.equal(isBillWrittenOff(list, 'BILL-2'), false);
  assert.equal(writeOffAmountForBill(list, 'BILL-1'), 150000);
  assert.equal(writeOffAmountForBill(list, 'BILL-2'), 0);
  assert.deepEqual(normalizeWriteOffList(null), []);
});

test('plan115: reconcile proves live plus written-off equals the bills total', () => {
  const full = upsertWriteOff([], record());
  const reconciled = reconcileDues(bills, full);
  assert.equal(reconciled.totalCents, 400000);
  assert.equal(reconciled.writtenOffCents, 150000);
  assert.equal(reconciled.liveCents, 250000);
  assert.equal(reconciled.reconciles, true);
  // Same fixture without write-offs: live equals the whole total.
  const plain = reconcileDues(bills, []);
  assert.equal(plain.liveCents, 400000);
  assert.equal(plain.writtenOffCents, 0);
  assert.equal(plain.reconciles, true);
  // A partly written-off bill keeps only its live remainder.
  const partial = upsertWriteOff([], record({ bills: [{ billId: 'BILL-2', amountCents: 50000 }] }));
  const part = reconcileDues(bills, partial);
  assert.equal(part.liveCents, 350000);
  assert.equal(part.perBill.find((b) => b.billId === 'BILL-2').liveCents, 150000);
});

test('plan115: unmatched and excess are reported, never silently corrected', () => {
  const ghost = upsertWriteOff([], record({ bills: [{ billId: 'BILL-9', amountCents: 10000 }] }));
  const unmatched = reconcileDues(bills, ghost);
  assert.equal(unmatched.unmatchedCents, 10000);
  assert.equal(unmatched.reconciles, false);
  assert.equal(unmatched.liveCents, 400000);
  const over = upsertWriteOff([], record({ bills: [{ billId: 'BILL-3', amountCents: 99999 }] }));
  const excess = reconcileDues(bills, over);
  assert.equal(excess.excessCents, 49999);
  assert.equal(excess.writtenOffCents, 50000);
  assert.equal(excess.liveCents, 350000);
  assert.equal(excess.reconciles, false);
});

test('plan115: collection list excludes fully written-off bills', () => {
  const full = upsertWriteOff([], record());
  const live = liveCollectionList(bills, full);
  assert.deepEqual(live.map((b) => b.billId), ['BILL-2', 'BILL-3']);
  assert.equal(liveCollectionList(bills, []).length, 3);
});

test('plan115: inputs are never mutated', () => {
  const before = record();
  const snapshot = JSON.stringify(before);
  const list = upsertWriteOff([], before);
  assert.equal(JSON.stringify(before), snapshot);
  const billsSnapshot = JSON.stringify(bills);
  reconcileDues(bills, list);
  assert.equal(JSON.stringify(bills), billsSnapshot);
});

test('plan115: summary, reconcile text, HTML escaping, CSV, filename', () => {
  const list = upsertWriteOff([], record());
  assert.match(writeOffSummaryText(list), /1 write-off/);
  assert.match(writeOffSummaryText(list), /Rs\. 1500\.00/);
  assert.equal(writeOffSummaryText([]), 'No arrears written off yet.');
  assert.match(reconcileDuesText(reconcileDues(bills, list)), /Reconciles exactly/);
  assert.match(reconcileDuesText(reconcileDues(bills, [])), /Reconciles exactly/);
  const htmlOut = writeOffHtml(record({ customerName: '<b>Bad</b>', reason: 'a & b' }));
  assert.equal(htmlOut.includes('<b>'), false);
  assert.match(htmlOut, /&lt;b&gt;Bad&lt;\/b&gt;/);
  assert.match(htmlOut, /a &amp; b/);
  const csv = writeOffCsv(list);
  assert.match(csv, /^id,customer,bills written off,total written off \(Rs\),reason,approver,approval id,date/);
  assert.match(csv, /1500\.00/);
  assert.equal(writeOffFilename(), 'arrears-writeoffs.csv');
});

test('plan115: purity fence — no imports, storage, DOM, or Plan 110 module', () => {
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('approval-limits'), false);
  assert.equal(source.includes('approvalLimits'), false);
  assert.match(source, /approvalId/);
});

test('plan115: panel element ids present in index.html', () => {
  for (const id of ['writeOffBody', 'writeOffSummary', 'writeOffCustomer', 'writeOffBills', 'writeOffReason', 'writeOffApprover', 'writeOffApproval', 'writeOffDate', 'writeOffSaveBtn', 'writeOffFilterCustomer', 'writeOffReconcileBtn', 'writeOffReconcileResult', 'writeOffExportBtn']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
