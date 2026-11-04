import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  validReconnectionFeeDate,
  normalizeReconnectionFee,
  normalizeReconnectionFeeList,
  upsertReconnectionFee,
  removeReconnectionFee,
  findReconnectionFee,
  feesForSuspension,
  feesForCustomer,
  totalReconnectionFeesCents,
  normalizeReconnectionFeeWaiver,
  addReconnectionFeeWaiver,
  removeReconnectionFeeWaiver,
  waiversForFee,
  reconnectionFeeSummaryText,
  reconnectionFeeHtml,
  reconnectionFeeCsv,
  reconnectionFeeFilename,
} from '../reconnection-fees.js';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'reconnection-fees.js'), 'utf8');

const fee = (overrides = {}) => ({
  id: 'RF-1',
  customerId: 'CUST-76',
  customerName: 'Orient school',
  suspensionId: 'SUSP-1',
  billId: 'BILL-2026-11',
  billLine: 'Reconnection fee',
  feeCents: 50000,
  dateCharged: '2026-11-05',
  reason: '',
  ...overrides,
});

const waiver = (overrides = {}) => ({
  id: 'RFW-1',
  feeId: 'RF-1',
  approvalId: 'APPR-1',
  reason: 'Goodwill after long outage',
  date: '2026-11-06',
  ...overrides,
});

test('strict dates: impossible dates rejected, leap day accepted only in leap years', () => {
  assert.equal(validReconnectionFeeDate('2026-02-30'), false);
  assert.equal(validReconnectionFeeDate('2026-13-01'), false);
  assert.equal(validReconnectionFeeDate('2026-11-05'), true);
  assert.equal(validReconnectionFeeDate('2024-02-29'), true);
  assert.equal(validReconnectionFeeDate('2025-02-29'), false);
  assert.equal(normalizeReconnectionFee(fee({ dateCharged: '2026-02-30' })), null);
  assert.equal(normalizeReconnectionFee(fee({ dateCharged: '' })).dateCharged, '');
});

test('half-formed fee refused: missing id, customer, suspension, bill, or non-positive fee', () => {
  assert.equal(normalizeReconnectionFee(fee({ id: '  ' })), null);
  assert.equal(normalizeReconnectionFee(fee({ customerId: '' })), null);
  assert.equal(normalizeReconnectionFee(fee({ suspensionId: '' })), null);
  assert.equal(normalizeReconnectionFee(fee({ billId: '' })), null);
  assert.equal(normalizeReconnectionFee(fee({ feeCents: 0 })), null);
  assert.equal(normalizeReconnectionFee(fee({ feeCents: -100 })), null);
  assert.equal(normalizeReconnectionFee(null), null);
  assert.equal(normalizeReconnectionFee(fee({ feeCents: undefined, feeAmount: undefined })), null);
});

test('rupees convert to cents exactly once; *Cents used as-is; re-normalising never inflates', () => {
  const fromRupees = normalizeReconnectionFee(fee({ feeCents: undefined, feeAmount: 500 }));
  assert.equal(fromRupees.feeCents, 50000);
  const again = normalizeReconnectionFee(fromRupees);
  assert.equal(again.feeCents, 50000);
  const fromCents = normalizeReconnectionFee(fee({ feeCents: 25000 }));
  assert.equal(fromCents.feeCents, 25000);
  assert.equal(normalizeReconnectionFee(fee({ feeCents: 'abc' })), null);
});

test('unknown fields dropped; list normalisation dedupes by id', () => {
  const clean = normalizeReconnectionFee(fee({ billTotal: 999999, paidAmount: 1 }));
  assert.equal('billTotal' in clean, false);
  assert.equal('paidAmount' in clean, false);
  assert.equal(normalizeReconnectionFeeList([fee(), fee({ feeCents: 60000 })]).length, 1);
  assert.equal(normalizeReconnectionFeeList([fee(), null, fee({ id: 'RF-2' })]).length, 2);
});

test('upsert by id replaces its own row; find, per-suspension and per-customer lists', () => {
  const list = upsertReconnectionFee([], fee());
  const replaced = upsertReconnectionFee(list, fee({ feeCents: 75000 }));
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].feeCents, 75000);
  assert.equal(findReconnectionFee(replaced, 'RF-1').feeCents, 75000);
  assert.equal(findReconnectionFee(replaced, 'nope'), null);
  const two = upsertReconnectionFee(replaced, fee({ id: 'RF-2', suspensionId: 'SUSP-2', customerId: 'CUST-9' }));
  assert.equal(feesForSuspension(two, 'SUSP-1').length, 1);
  assert.equal(feesForCustomer(two, 'CUST-9').length, 1);
  assert.equal(feesForCustomer(two, 'CUST-76').length, 1);
  assert.equal(totalReconnectionFeesCents(two), 75000 + 50000);
});

test('second fee for the same suspension refused without a recorded reason, allowed with one', () => {
  const list = upsertReconnectionFee([], fee());
  const refused = upsertReconnectionFee(list, fee({ id: 'RF-2' }));
  assert.deepEqual(refused, list);
  assert.equal(refused.length, 1);
  const allowed = upsertReconnectionFee(list, fee({ id: 'RF-2', reason: 'Fee charged again after second suspension close' }));
  assert.equal(allowed.length, 2);
  assert.equal(allowed.find((entry) => entry.id === 'RF-2').reason, 'Fee charged again after second suspension close');
  // A first fee carrying a reason of its own is fine: the rule only bites on a second fee.
  const firstWithReason = upsertReconnectionFee([], fee({ reason: 'Standard reconnection charge' }));
  assert.equal(firstWithReason.length, 1);
});

test('remove drops only the named fee', () => {
  const list = upsertReconnectionFee(upsertReconnectionFee([], fee()), fee({ id: 'RF-2', suspensionId: 'SUSP-2', reason: 'x' }));
  assert.equal(removeReconnectionFee(list, 'RF-1').length, 1);
  assert.equal(removeReconnectionFee(list, 'RF-1')[0].id, 'RF-2');
  assert.equal(removeReconnectionFee(list, 'nope').length, 2);
});

test('waiver gates: unknown fee, missing approval, missing reason, bad date, duplicate all refused', () => {
  const fees = upsertReconnectionFee([], fee());
  assert.deepEqual(addReconnectionFeeWaiver(fees, [], waiver({ feeId: 'RF-9' })), []);
  assert.deepEqual(addReconnectionFeeWaiver(fees, [], waiver({ approvalId: '' })), []);
  assert.deepEqual(addReconnectionFeeWaiver(fees, [], waiver({ reason: '  ' })), []);
  assert.deepEqual(addReconnectionFeeWaiver(fees, [], waiver({ date: '2026-02-30' })), []);
  const added = addReconnectionFeeWaiver(fees, [], waiver());
  assert.equal(added.length, 1);
  assert.deepEqual(addReconnectionFeeWaiver(fees, added, waiver({ id: 'RFW-2' })), added);
  assert.equal(waiversForFee(added, 'RF-1').length, 1);
  assert.equal(removeReconnectionFeeWaiver(added, 'RFW-1').length, 0);
  assert.equal(normalizeReconnectionFeeWaiver(waiver({ approvalId: '' })), null);
});

test('non-mutation: upsert, remove, and waiver add leave inputs untouched', () => {
  const list = [fee()];
  const snapshot = JSON.stringify(list);
  upsertReconnectionFee(list, fee({ id: 'RF-2', suspensionId: 'SUSP-2', reason: 'x' }));
  removeReconnectionFee(list, 'RF-1');
  addReconnectionFeeWaiver(list, [], waiver());
  assert.equal(JSON.stringify(list), snapshot);
  const record = fee();
  const before = JSON.stringify(record);
  normalizeReconnectionFee(record);
  assert.equal(JSON.stringify(record), before);
});

test('summary text, HTML escaping, CSV quoting and filename', () => {
  assert.equal(reconnectionFeeSummaryText([], []), 'No reconnection fees recorded yet.');
  const fees = upsertReconnectionFee([], fee());
  assert.match(reconnectionFeeSummaryText(fees, []), /1 reconnection fee · PKR 500 charged · 0 waived/);
  const waived = addReconnectionFeeWaiver(fees, [], waiver());
  assert.match(reconnectionFeeSummaryText(fees, waived), /1 waived \(PKR 500\)/);
  const html = reconnectionFeeHtml(fee({ customerName: '<b>X</b>', billLine: 'Fee & line' }), true);
  assert.equal(html.includes('<b>'), false);
  assert.match(html, /WAIVED/);
  assert.equal(reconnectionFeeHtml(fee({ id: '' })), '');
  const csv = reconnectionFeeCsv([fee({ reason: 'a, "quoted" reason' })], []);
  assert.match(csv, /"a, ""quoted"" reason"/);
  assert.equal(reconnectionFeeFilename(), 'reconnection-fees.csv');
});

test('purity fence: no imports, no storage or DOM, no Plan 83 or Plan 110 module identifiers', () => {
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('suspension-records'), false);
  assert.equal(source.includes('approval-limits'), false);
  assert.equal(source.includes('suspensionRecords'), false);
  assert.equal(source.includes('approvalLimits'), false);
});
