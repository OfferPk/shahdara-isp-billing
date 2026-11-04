import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  validLateFeeDate,
  normalizeLateFeePolicy,
  normalizeLateFeePolicyList,
  upsertLateFeePolicy,
  removeLateFeePolicy,
  findLateFeePolicy,
  policyForDate,
  lateFeeForBill,
  normalizeLateFeeWaiver,
  addLateFeeWaiver,
  removeLateFeeWaiver,
  waiversForCustomer,
  lateFeePolicySummaryText,
  lateFeePolicyHtml,
  lateFeeResultHtml,
  lateFeePolicyCsv,
  lateFeePolicyFilename,
} from '../late-fee-policy.js';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'late-fee-policy.js'), 'utf8');

const policy = (overrides = {}) => ({
  id: 'POL-1',
  name: 'Standard late fee',
  graceDays: 5,
  feeCents: 10000,
  basis: 'PKR 100 per overdue bill',
  maximumFeeCents: 50000,
  appliesToPackages: [],
  effectiveDate: '2026-01-01',
  ...overrides,
});

const bill = (overrides = {}) => ({
  customerId: 'CUST-76',
  billMonth: '2026-10',
  dueDate: '2026-10-05',
  package: 'Home 20 Mbps',
  ...overrides,
});

test('strict dates: impossible dates rejected, leap day accepted only in leap years', () => {
  assert.equal(validLateFeeDate('2026-02-30'), false);
  assert.equal(validLateFeeDate('2026-13-01'), false);
  assert.equal(validLateFeeDate('2026-10-05'), true);
  assert.equal(validLateFeeDate('2024-02-29'), true);
  assert.equal(validLateFeeDate('2025-02-29'), false);
  assert.equal(validLateFeeDate('2026-10-31'), true);
  assert.equal(validLateFeeDate('2026-08-31'), true);
  assert.equal(validLateFeeDate('2026-11-31'), false);
  assert.equal(normalizeLateFeePolicy(policy({ effectiveDate: '2026-02-30' })), null);
});

test('half-formed policy refused: blank name, blank basis, negative grace, non-positive fee or cap', () => {
  assert.equal(normalizeLateFeePolicy(policy({ name: '  ' })), null);
  assert.equal(normalizeLateFeePolicy(policy({ basis: '' })), null);
  assert.equal(normalizeLateFeePolicy(policy({ graceDays: -1 })), null);
  assert.equal(normalizeLateFeePolicy(policy({ graceDays: 1.5 })), null);
  assert.equal(normalizeLateFeePolicy(policy({ feeCents: 0 })), null);
  assert.equal(normalizeLateFeePolicy(policy({ maximumFeeCents: -5 })), null);
  assert.equal(normalizeLateFeePolicy(policy({ id: '' })), null);
});

test('rupees convert to cents exactly once; basis-only policy has no fixed amount', () => {
  const p = normalizeLateFeePolicy(policy({ feeAmount: 100, feeCents: undefined, maximumFee: 500, maximumFeeCents: undefined }));
  assert.equal(p.feeCents, 10000);
  assert.equal(p.maximumFeeCents, 50000);
  const basisOnly = normalizeLateFeePolicy(policy({ feeCents: null, maximumFeeCents: null }));
  assert.equal(basisOnly.feeCents, null);
  assert.equal(basisOnly.basis, 'PKR 100 per overdue bill');
});

test('unknown fields dropped; package list normalised and deduped', () => {
  const p = normalizeLateFeePolicy(policy({ billTotal: 9999, appliesToPackages: 'Home 20 Mbps, home 20 mbps, Office 50 Mbps' }));
  assert.equal('billTotal' in p, false);
  assert.deepEqual(p.appliesToPackages, ['Home 20 Mbps', 'Office 50 Mbps']);
});

test('upsert replaces same id; half-formed upsert leaves list unchanged; remove/find work', () => {
  const base = [policy()];
  const changed = upsertLateFeePolicy(base, policy({ graceDays: 10 }));
  assert.equal(changed.length, 1);
  assert.equal(changed[0].graceDays, 10);
  assert.deepEqual(upsertLateFeePolicy(base, policy({ name: '' })), base);
  assert.deepEqual(removeLateFeePolicy(base, 'POL-1'), []);
  assert.equal(findLateFeePolicy(base, 'POL-1').name, 'Standard late fee');
  assert.equal(findLateFeePolicy(base, 'NOPE'), null);
});

test('policyForDate picks latest effective on or before the date, never a future policy', () => {
  const list = [policy({ id: 'OLD', effectiveDate: '2025-01-01' }), policy({ id: 'NEW', effectiveDate: '2026-06-01' })];
  assert.equal(policyForDate(list, '2026-10-01').id, 'NEW');
  assert.equal(policyForDate(list, '2026-03-01').id, 'OLD');
  assert.equal(policyForDate(list, '2024-12-31'), null);
});

test('fee applies after grace, capped at maximum; inside grace no fee; not yet due no fee', () => {
  const list = [policy()];
  const applied = lateFeeForBill({ policies: list, bill: bill(), asOfDate: '2026-10-20' });
  assert.equal(applied.applies, true);
  assert.equal(applied.feeCents, 10000);
  assert.equal(applied.policyId, 'POL-1');
  assert.equal(applied.effectiveDate, '2026-01-01');
  assert.match(applied.reason, /Standard late fee/);
  assert.equal(lateFeeForBill({ policies: list, bill: bill(), asOfDate: '2026-10-10' }).applies, false);
  assert.equal(lateFeeForBill({ policies: list, bill: bill(), asOfDate: '2026-10-05' }).applies, false);
  assert.equal(lateFeeForBill({ policies: list, bill: bill(), asOfDate: '2026-10-04' }).applies, false);
  const capped = lateFeeForBill({ policies: [policy({ feeCents: 90000 })], bill: bill(), asOfDate: '2026-10-20' });
  assert.equal(capped.feeCents, 50000);
  const basisOnly = lateFeeForBill({ policies: [policy({ feeCents: null, maximumFeeCents: null })], bill: bill(), asOfDate: '2026-10-20' });
  assert.equal(basisOnly.applies, true);
  assert.equal(basisOnly.feeCents, null);
});

test('exactly at grace boundary no fee, one day past grace fee applies', () => {
  const list = [policy({ graceDays: 5 })];
  assert.equal(lateFeeForBill({ policies: list, bill: bill(), asOfDate: '2026-10-10' }).applies, false);
  assert.equal(lateFeeForBill({ policies: list, bill: bill(), asOfDate: '2026-10-11' }).applies, true);
});

test('no fee before policy effective date, and no fee on a bill due before it', () => {
  const list = [policy({ effectiveDate: '2026-11-01' })];
  const r = lateFeeForBill({ policies: list, bill: bill(), asOfDate: '2026-11-20' });
  assert.equal(r.applies, false);
  assert.match(r.reason, /before the policy effective date/);
  const before = lateFeeForBill({ policies: [policy({ effectiveDate: '2026-10-06' })], bill: bill(), asOfDate: '2026-11-20' });
  assert.equal(before.applies, false);
});

test('no fee during a recorded extension; after it lapses, overdue counts from extended date', () => {
  const list = [policy()];
  const ext = [{ customerId: 'CUST-76', billMonth: '2026-10', extendedDueDate: '2026-10-25' }];
  const inside = lateFeeForBill({ policies: list, bill: bill(), extensions: ext, asOfDate: '2026-10-20' });
  assert.equal(inside.applies, false);
  assert.match(inside.reason, /extension/);
  const onExtended = lateFeeForBill({ policies: list, bill: bill(), extensions: ext, asOfDate: '2026-10-25' });
  assert.equal(onExtended.applies, false);
  // 5 grace days from 2026-10-25: 2026-10-30 inside grace, 2026-10-31 fee.
  assert.equal(lateFeeForBill({ policies: list, bill: bill(), extensions: ext, asOfDate: '2026-10-30' }).applies, false);
  assert.equal(lateFeeForBill({ policies: list, bill: bill(), extensions: ext, asOfDate: '2026-10-31' }).applies, true);
  // An extension for a different bill never pauses this one.
  const other = [{ customerId: 'CUST-76', billMonth: '2026-09', extendedDueDate: '2026-12-31' }];
  assert.equal(lateFeeForBill({ policies: list, bill: bill(), extensions: other, asOfDate: '2026-10-20' }).applies, true);
});

test('package-scoped policy skips other packages; already-paid bill never charged', () => {
  const list = [policy({ appliesToPackages: ['Office 50 Mbps'] })];
  assert.equal(lateFeeForBill({ policies: list, bill: bill(), asOfDate: '2026-10-20' }).applies, false);
  assert.equal(lateFeeForBill({ policies: list, bill: bill({ package: 'Office 50 Mbps' }), asOfDate: '2026-10-20' }).applies, true);
  assert.equal(lateFeeForBill({ policies: [policy()], bill: bill({ paid: true }), asOfDate: '2026-10-20' }).applies, false);
  assert.equal(lateFeeForBill({ policies: [policy()], bill: bill({ dueDate: 'not-a-date' }), asOfDate: '2026-10-20' }).applies, false);
});

test('waiver refused without approval id or reason; duplicate id never overwrites', () => {
  const waiver = { id: 'W-1', billId: 'B-1', customerId: 'CUST-76', approvalId: 'APPR-9', reason: 'Goodwill', date: '2026-10-20', feeCents: 10000 };
  assert.equal(normalizeLateFeeWaiver({ ...waiver, approvalId: '' }), null);
  assert.equal(normalizeLateFeeWaiver({ ...waiver, reason: '' }), null);
  assert.equal(normalizeLateFeeWaiver({ ...waiver, date: '2026-02-30' }), null);
  const base = addLateFeeWaiver([], waiver);
  assert.equal(base.length, 1);
  assert.deepEqual(addLateFeeWaiver(base, { ...waiver, reason: 'Changed' }), base);
  assert.deepEqual(addLateFeeWaiver(base, { ...waiver, id: 'W-2', approvalId: '' }), base);
  assert.equal(waiversForCustomer(base, 'CUST-76').length, 1);
  assert.deepEqual(removeLateFeeWaiver(base, 'W-1'), []);
});

test('fee answer never mutates its inputs', () => {
  const list = [policy()];
  const b = bill();
  const ext = [{ customerId: 'CUST-76', billMonth: '2026-10', extendedDueDate: '2026-10-25' }];
  const snapshot = JSON.stringify({ list, b, ext });
  lateFeeForBill({ policies: list, bill: b, extensions: ext, asOfDate: '2026-10-31' });
  assert.equal(JSON.stringify({ list, b, ext }), snapshot);
});

test('summary, HTML and CSV quote and escape; filename fixed', () => {
  const p = policy({ name: 'Fee "A" <test>', basis: 'PKR 100, per bill' });
  assert.match(lateFeePolicyHtml(p), /Fee &quot;A&quot; &lt;test&gt;/);
  assert.match(lateFeePolicySummaryText([p]), /Fee "A" <test>/);
  const csv = lateFeePolicyCsv([p]);
  assert.match(csv, /"Fee ""A"" <test>"/);
  assert.match(csv, /"PKR 100, per bill"/);
  assert.equal(lateFeePolicyFilename(), 'late-fee-policies.csv');
  const result = lateFeeForBill({ policies: [policy()], bill: bill(), asOfDate: '2026-10-20' });
  assert.match(lateFeeResultHtml(result), /Standard late fee/);
  assert.match(lateFeeResultHtml(result), /effective 2026-01-01/);
});

test('purity fence: module imports nothing and names no Plan 38 or Plan 110 store', () => {
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('shahdara_bill_extensions'), false);
  assert.equal(source.includes('shahdara_approval'), false);
  assert.equal(source.includes('approval-limits'), false);
  assert.equal(source.includes('bill-extension'), false);
});
