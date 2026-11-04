import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  validBillingRunMonth,
  validBillingRunDate,
  normalizeSkippedBill,
  normalizeBillingRun,
  normalizeBillingRunList,
  addBillingRun,
  annotateBillingRun,
  billingRunGeneratedCount,
  billingRunsForMonth,
  verifyBillingRun,
  billingRunSummaryText,
  billingRunHtml,
  billingRunCsv,
  billingRunFilename,
} from '../billing-run-log.js';

const here = dirname(fileURLToPath(import.meta.url));

const run = (overrides = {}) => ({
  id: 'RUN-2026-11',
  runMonth: '2026-11',
  runDate: '2026-11-01',
  operator: 'Saad',
  generatedBillIds: ['BILL-1', 'BILL-2'],
  skippedBills: [{ billId: 'BILL-9', reason: 'Customer exited' }],
  exceptionReportRef: 'EXC-2026-11',
  ...overrides,
});

test('validBillingRunMonth accepts YYYY-MM only', () => {
  assert.equal(validBillingRunMonth('2026-11'), true);
  assert.equal(validBillingRunMonth('2026-13'), false);
  assert.equal(validBillingRunMonth('2026-1'), false);
  assert.equal(validBillingRunMonth('Nov 2026'), false);
});

test('validBillingRunDate rejects impossible dates', () => {
  assert.equal(validBillingRunDate('2026-11-01'), true);
  assert.equal(validBillingRunDate('2026-02-30'), false);
  assert.equal(validBillingRunDate('2024-02-29'), true);
  assert.equal(validBillingRunDate('2026-02-29'), false);
});

test('normalizeBillingRun refuses half-formed entries and drops unknown fields', () => {
  assert.equal(normalizeBillingRun(run({ id: '' })), null);
  assert.equal(normalizeBillingRun(run({ runMonth: '2026-13' })), null);
  assert.equal(normalizeBillingRun(run({ runDate: '2026-02-30' })), null);
  assert.equal(normalizeBillingRun(run({ operator: '  ' })), null);
  assert.equal(normalizeBillingRun(run({ skippedBills: [{ billId: 'BILL-9' }] })), null);
  const clean = normalizeBillingRun(run({ billTotal: 9999, paymentId: 'PAY-1' }));
  assert.equal(clean.billTotal, undefined);
  assert.equal(clean.paymentId, undefined);
  assert.equal(clean.generatedBillIds.length, 2);
});

test('generated ids dedupe and keep order; comma string splits', () => {
  const clean = normalizeBillingRun(run({ generatedBillIds: 'BILL-2, BILL-1, BILL-2' }));
  assert.deepEqual(clean.generatedBillIds, ['BILL-2', 'BILL-1']);
});

test('addBillingRun appends once and refuses a second entry with the same id', () => {
  const first = addBillingRun([], run());
  assert.equal(first.length, 1);
  assert.equal(addBillingRun(first, run({ operator: 'Someone else', generatedBillIds: ['BILL-99'] })), null);
  const kept = normalizeBillingRunList(first);
  assert.equal(kept[0].operator, 'Saad');
  assert.deepEqual(kept[0].generatedBillIds, ['BILL-1', 'BILL-2']);
  assert.equal(addBillingRun([], run({ operator: '' })), null);
});

test('annotateBillingRun appends only a dated note and touches nothing else', () => {
  const list = addBillingRun([], run());
  const next = annotateBillingRun(list, { runId: 'RUN-2026-11', note: 'BILL-2 was reissued after a price fix.', date: '2026-11-03' });
  assert.equal(next.length, 1);
  assert.deepEqual(next[0].notes, [{ note: 'BILL-2 was reissued after a price fix.', date: '2026-11-03' }]);
  assert.equal(next[0].operator, 'Saad');
  assert.deepEqual(next[0].generatedBillIds, ['BILL-1', 'BILL-2']);
  assert.equal(annotateBillingRun(list, { runId: 'RUN-2026-11', note: '  ', date: '2026-11-03' }), null);
  assert.equal(annotateBillingRun(list, { runId: 'RUN-2026-11', note: 'Note', date: '2026-02-30' }), null);
  assert.equal(annotateBillingRun(list, { runId: 'RUN-UNKNOWN', note: 'Note', date: '2026-11-03' }), null);
  // The original list is untouched by the annotation.
  assert.deepEqual(list[0].notes, []);
});

test('billingRunGeneratedCount and billingRunsForMonth', () => {
  assert.equal(billingRunGeneratedCount(run()), 2);
  assert.equal(billingRunGeneratedCount(run({ generatedBillIds: [] })), 0);
  const list = normalizeBillingRunList([run(), run({ id: 'RUN-2026-10', runMonth: '2026-10' })]);
  assert.equal(billingRunsForMonth(list, '2026-11').length, 1);
  assert.deepEqual(billingRunsForMonth(list, '2026-13'), []);
});

test('verifyBillingRun matches, and reports missing and extra plainly', () => {
  const bills = [
    { id: 'BILL-1', month: '2026-11' },
    { id: 'BILL-2', month: '2026-11' },
    { id: 'BILL-3', month: '2026-10' },
  ];
  const ok = verifyBillingRun(run(), bills);
  assert.equal(ok.matches, true);
  assert.equal(ok.expectedCount, 2);
  assert.equal(ok.generatedCount, 2);
  const short = verifyBillingRun(run({ generatedBillIds: ['BILL-1'] }), bills);
  assert.equal(short.matches, false);
  assert.deepEqual(short.missingBillIds, ['BILL-2']);
  assert.deepEqual(short.extraBillIds, []);
  const extra = verifyBillingRun(run({ generatedBillIds: ['BILL-1', 'BILL-2', 'BILL-77'] }), bills);
  assert.equal(extra.matches, false);
  assert.deepEqual(extra.extraBillIds, ['BILL-77']);
  assert.equal(verifyBillingRun(run({ id: '' }), bills), null);
});

test('skipped bills need a reason and keep customer context', () => {
  assert.equal(normalizeSkippedBill({ billId: 'BILL-9' }), null);
  assert.equal(normalizeSkippedBill({ reason: 'No reason bill' }), null);
  assert.deepEqual(
    normalizeSkippedBill({ billId: 'BILL-9', customerId: 'C-76', customerName: 'Orient school', reason: 'Customer exited', amount: 5 }),
    { billId: 'BILL-9', customerId: 'C-76', customerName: 'Orient school', reason: 'Customer exited' },
  );
});

test('summary, html escaping, and csv quoting', () => {
  const list = normalizeBillingRunList([run(), run({ id: 'RUN-2026-10', runMonth: '2026-10', generatedBillIds: [] })]);
  assert.equal(billingRunSummaryText(list), '2 runs logged · 2 bills generated · 2 skipped');
  const html = billingRunHtml(run({ operator: '<Saad & Co>' }), verifyBillingRun(run(), [{ id: 'BILL-1', month: '2026-11' }, { id: 'BILL-2', month: '2026-11' }]));
  assert.match(html, /&lt;Saad &amp; Co&gt;/);
  assert.match(html, /Count matches/);
  const mismatch = billingRunHtml(run({ generatedBillIds: ['BILL-1'] }), verifyBillingRun(run({ generatedBillIds: ['BILL-1'] }), [{ id: 'BILL-1', month: '2026-11' }, { id: 'BILL-2', month: '2026-11' }]));
  assert.match(mismatch, /does not match/);
  assert.match(mismatch, /missing BILL-2/);
  const csv = billingRunCsv([run({ operator: 'Saad, field' })]);
  assert.match(csv, /"Saad, field"/);
  assert.match(csv, /BILL-9: Customer exited/);
  assert.equal(billingRunFilename(), 'billing-run-log.csv');
});

test('purity fence: no storage, DOM, imports, or bill-writing calls', () => {
  const source = readFileSync(join(here, '..', 'billing-run-log.js'), 'utf8');
  assert.doesNotMatch(source, /localStorage/);
  assert.doesNotMatch(source, /document\./);
  assert.doesNotMatch(source, /^import /m);
  assert.doesNotMatch(source, /generateBill\(|postBill\(|createBill\(|saveBill\(/);
});

test('wiring and panel ids exist in app.js and index.html', () => {
  const app = readFileSync(join(here, '..', 'app.js'), 'utf8');
  const html = readFileSync(join(here, '..', 'index.html'), 'utf8');
  assert.match(app, /billing-run-log\.js\?v=1\.11\.0/);
  assert.match(app, /renderBillingRunLog/);
  for (const id of ['billingRunBody', 'billingRunSummary', 'billingRunMonth', 'billingRunDate', 'billingRunOperator', 'billingRunGenerated', 'billingRunSkipped', 'billingRunExceptionRef', 'billingRunSaveBtn', 'billingRunPick', 'billingRunNote', 'billingRunNoteDate', 'billingRunAnnotateBtn', 'billingRunExportBtn', 'billingRunFillBtn']) {
    assert.ok(html.includes(`id="${id}"`), `index.html missing ${id}`);
  }
});
