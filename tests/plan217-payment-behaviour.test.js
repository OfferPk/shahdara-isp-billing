import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BEHAVIOUR_MIN_BILLS_TO_JUDGE,
  validBehaviourDate,
  normalizeBehaviourBill,
  normalizeBehaviourBillList,
  findBehaviourBill,
  recordBehaviourBill,
  removeBehaviourBill,
  behaviourBillsSorted,
  behaviourBillsForCustomer,
  behaviourBandLabel,
  behaviourSummaryForCustomer,
  behaviourSummaries,
  behaviourSummaryText,
  behaviourSummaryHtml,
  behaviourAllHtml,
  behaviourCsv,
  behaviourFilename,
} from '../payment-behaviour.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'payment-behaviour.js'), 'utf8');

const early = { id: 'PB-1', customer: 'Ahmed', dueDate: '2026-11-05', paidDate: '2026-11-03' };
const onTime = { id: 'PB-2', customer: 'Ahmed', dueDate: '2026-10-05', paidDate: '2026-10-05' };
const late = { id: 'PB-3', customer: 'Ahmed', dueDate: '2026-09-05', paidDate: '2026-09-09' };
const unpaid = { id: 'PB-4', customer: 'Ahmed', dueDate: '2026-08-05' };
const bilalLate = { id: 'PB-5', customer: 'Bilal', dueDate: '2026-11-05', paidDate: '2026-11-08' };

test('half-formed behaviour notes are refused', () => {
  assert.equal(normalizeBehaviourBill({ id: 'PB-9', dueDate: '2026-11-05', paidDate: '2026-11-04' }), null);
  assert.equal(normalizeBehaviourBill({ id: 'PB-9', customer: 'Ahmed', paidDate: '2026-11-04' }), null);
  assert.equal(normalizeBehaviourBill({ id: '', customer: 'Ahmed', dueDate: '2026-11-05' }), null);
  assert.equal(normalizeBehaviourBill({ id: 'PB-9', customer: 'Ahmed', dueDate: '2026-11-05', paidDate: '2026-11-32' }), null);
  assert.equal(normalizeBehaviourBill(null), null);
});

test('strict dates are enforced, including February', () => {
  assert.equal(validBehaviourDate('2026-02-29'), false);
  assert.equal(validBehaviourDate('2024-02-29'), true);
  assert.equal(validBehaviourDate('2026-13-01'), false);
  assert.equal(validBehaviourDate('2026-11-05'), true);
  assert.equal(validBehaviourDate('05-11-2026'), false);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { id: 'PB-9', customer: 'Ahmed', dueDate: '2026-11-05', paidDate: '2026-11-04', penalty: 500, score: 9 };
  const clean = normalizeBehaviourBill(raw);
  assert.deepEqual(clean, { id: 'PB-9', customer: 'Ahmed', dueDate: '2026-11-05', paidDate: '2026-11-04' });
  assert.equal('penalty' in raw, true);
  const list = [early];
  recordBehaviourBill(list, onTime);
  assert.equal(list.length, 1);
});

test('duplicate ids are never rewritten', () => {
  const list = recordBehaviourBill([early], { ...early, paidDate: '2026-11-01' });
  assert.equal(list.length, 1);
  assert.equal(list[0].paidDate, '2026-11-03');
});

test('find, remove, sort and customer filter work', () => {
  assert.equal(findBehaviourBill([early, onTime], 'PB-2').dueDate, '2026-10-05');
  assert.equal(findBehaviourBill([early], 'PB-9'), null);
  assert.equal(removeBehaviourBill([early, onTime], 'PB-1').length, 1);
  const sorted = behaviourBillsSorted([bilalLate, early, onTime]);
  assert.deepEqual(sorted.map((bill) => bill.id), ['PB-2', 'PB-1', 'PB-5']);
  assert.deepEqual(behaviourBillsForCustomer([early, bilalLate], 'ahm').map((bill) => bill.id), ['PB-1']);
  assert.deepEqual(behaviourBillsForCustomer([early], ''), []);
});

test('early, on time, late and unpaid are classified by string comparison', () => {
  const summary = behaviourSummaryForCustomer([early, onTime, late, unpaid], 'Ahmed');
  assert.equal(summary.paidEarly, 1);
  assert.equal(summary.paidOnTime, 1);
  assert.equal(summary.paidLate, 1);
  assert.equal(summary.unpaid, 1);
  assert.equal(summary.paidCount, 3);
});

test('summary counts sum exactly to the bills counted', () => {
  const fixture = [early, onTime, late, unpaid, bilalLate];
  for (const customer of ['Ahmed', 'Bilal']) {
    const summary = behaviourSummaryForCustomer(fixture, customer);
    assert.equal(
      summary.paidEarly + summary.paidOnTime + summary.paidLate + summary.unpaid,
      summary.billsCounted,
    );
  }
  const ahmed = behaviourSummaryForCustomer(fixture, 'Ahmed');
  assert.equal(ahmed.billsCounted, 4);
});

test('too few bills says so plainly, never a band', () => {
  assert.equal(BEHAVIOUR_MIN_BILLS_TO_JUDGE, 3);
  const summary = behaviourSummaryForCustomer([early, onTime], 'Ahmed');
  assert.equal(summary.band, 'too-few');
  assert.equal(behaviourBandLabel(summary.band), 'Too few bills to judge');
  assert.match(behaviourSummaryText(summary), /Too few bills to judge/);
});

test('no payments recorded yet says so plainly', () => {
  const bills = [
    { id: 'PB-11', customer: 'Bilal', dueDate: '2026-11-05' },
    { id: 'PB-12', customer: 'Bilal', dueDate: '2026-10-05' },
    { id: 'PB-13', customer: 'Bilal', dueDate: '2026-09-05' },
  ];
  const summary = behaviourSummaryForCustomer(bills, 'Bilal');
  assert.equal(summary.band, 'no-payments');
  assert.equal(summary.unpaid, 3);
  assert.match(behaviourSummaryText(summary), /No payments recorded yet/);
});

test('majority paid band decides the pattern', () => {
  const mostlyEarly = [
    { id: 'PB-21', customer: 'Ahmed', dueDate: '2026-11-05', paidDate: '2026-11-02' },
    { id: 'PB-22', customer: 'Ahmed', dueDate: '2026-10-05', paidDate: '2026-10-03' },
    { id: 'PB-23', customer: 'Ahmed', dueDate: '2026-09-05', paidDate: '2026-09-09' },
  ];
  assert.equal(behaviourSummaryForCustomer(mostlyEarly, 'Ahmed').band, 'usually-early');
  const mostlyLate = [
    { id: 'PB-31', customer: 'Bilal', dueDate: '2026-11-05', paidDate: '2026-11-08' },
    { id: 'PB-32', customer: 'Bilal', dueDate: '2026-10-05', paidDate: '2026-10-09' },
    { id: 'PB-33', customer: 'Bilal', dueDate: '2026-09-05', paidDate: '2026-09-05' },
  ];
  assert.equal(behaviourSummaryForCustomer(mostlyLate, 'Bilal').band, 'usually-late');
});

test('no majority means a mixed pattern, not a guessed band', () => {
  const summary = behaviourSummaryForCustomer([early, onTime, late], 'Ahmed');
  assert.equal(summary.band, 'mixed');
  assert.equal(behaviourBandLabel('mixed'), 'Mixed pattern');
});

test('summaries group customers case-insensitively', () => {
  const summaries = behaviourSummaries([early, { ...onTime, customer: 'ahmed' }, bilalLate]);
  assert.equal(summaries.length, 2);
  assert.equal(summaries[0].customer, 'Ahmed');
  assert.equal(summaries[0].billsCounted, 2);
});

test('summary text states counts and band in plain words', () => {
  const summary = behaviourSummaryForCustomer([early, onTime, late, unpaid], 'Ahmed');
  assert.equal(
    behaviourSummaryText(summary),
    'Ahmed: 4 bills counted — 1 early, 1 on time, 1 late, 1 unpaid. Mixed pattern.',
  );
});

test('html escapes customer names', () => {
  const summary = behaviourSummaryForCustomer(
    [{ id: 'PB-41', customer: '<b>Ahmed</b>', dueDate: '2026-11-05', paidDate: '2026-11-04' }],
    '<b>Ahmed</b>',
  );
  assert.doesNotMatch(behaviourSummaryHtml(summary), /<b>Ahmed<\/b>/);
  assert.match(behaviourSummaryHtml(summary), /&lt;b&gt;Ahmed&lt;\/b&gt;/);
});

test('all-html table lists every summary with its counts', () => {
  const html = behaviourAllHtml(behaviourSummaries([early, onTime, late, unpaid, bilalLate]));
  assert.match(html, /<th>Bills counted<\/th>/);
  assert.match(html, /Ahmed/);
  assert.match(html, /Bilal/);
  assert.equal(behaviourAllHtml([]), '<p>No payment behaviour summaries yet.</p>');
});

test('csv and filename cover every summary', () => {
  const csv = behaviourCsv(behaviourSummaries([early, onTime, late, unpaid]));
  assert.match(csv, /^Customer,Bills counted,Early,On time,Late,Unpaid,Pattern\n/);
  assert.match(csv, /Ahmed,4,1,1,1,1,Mixed pattern/);
  assert.equal(behaviourFilename(), 'payment-behaviour.csv');
});

test('module is pure: no clock, storage, or network use', () => {
  assert.doesNotMatch(moduleSrc, /new Date|Date\.now|localStorage|fetch\(/);
  assert.doesNotMatch(moduleSrc, /export function \w*(score|penalty|fine)\w*/i);
});

test('panel element ids are present in index.html', () => {
  for (const id of ['pbSummary', 'pbExportBtn', 'pbCustomer', 'pbDueDate', 'pbPaidDate', 'pbSaveBtn', 'pbRemoveId', 'pbRemoveBtn', 'pbCustomerFilter', 'pbBody']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing ${id}`);
  }
});

test('app.js wires the behaviour panel', () => {
  assert.ok(appJs.includes("from './payment-behaviour.js'"));
  assert.ok(appJs.includes('renderPaymentBehaviour()'));
  assert.ok(appJs.includes('shahdara_payment_behaviour_bills_v1'));
});

test('deployment guard: no standalone OLT word added to app.js', () => {
  assert.doesNotMatch(appJs, /\bOLT\b/);
});
