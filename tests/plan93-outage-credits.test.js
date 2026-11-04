/**
 * plan93-outage-credits.test.js — Plan 93: outage goodwill credit record.
 * Pins:
 * - each credit record names its outage, threshold, formula, and
 *   affected customers on the same fixture, and the credited amount
 *   matches the stated formula and package price (48h of a 744h
 *   January on Rs. 1500.00 = Rs. 96.77, capped at the monthly price);
 * - a customer outside the affected mohallas never receives a
 *   credit; downtime below the threshold credits nobody, while
 *   exactly at the threshold qualifies;
 * - a maintenance window named without a reason to include it is
 *   refused, and with a reason the reason stays visible;
 * - applying a credit only records a concession reference — the
 *   record never rewrites a past bill, and only the next bill
 *   through the existing concession path carries it;
 * - the module is pure: inputs are never mutated and it names no
 *   store, no bill amount field, and no SISP-30 calculator import.
 * Synthetic data only.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  OUTAGE_CREDIT_STANDARD_MONTH_HOURS,
  canonicalCreditMohalla,
  isValidCreditMonth,
  monthHoursFor,
  creditForPrice,
  outageCreditFormulaText,
  normalizeOutageCredit,
  normalizeOutageCreditList,
  upsertOutageCredit,
  removeOutageCredit,
  findOutageCredit,
  markCreditApplied,
  reopenCredit,
  filterOutageCredits,
  buildOutageCreditSummary,
  outageCreditSummaryText,
  outageCreditHtml,
  outageCreditCsv,
  outageCreditFilename,
} from '../outage-credits.js';

const BASE = {
  id: 'OC-1',
  outageId: 'O22-1',
  outageLabel: 'Main splitter down',
  month: '2026-01',
  downtimeHours: 48,
  thresholdHours: 12,
  affectedMohallas: ['Bani'],
  customers: [
    { customerId: 'C1', customerName: 'Ayesha', mohalla: 'Mohalla Bani', monthlyPriceCents: 150000 },
    { customerId: 'C2', customerName: 'Bilal', mohalla: 'Kishti', monthlyPriceCents: 150000 },
  ],
};

test('canonical mohalla keys mirror the Plan T rule', () => {
  assert.equal(canonicalCreditMohalla('Mohalla Bani').key, 'banii');
  assert.equal(canonicalCreditMohalla('bani').key, 'banii');
  assert.equal(canonicalCreditMohalla('BANI').key, 'banii');
  assert.equal(canonicalCreditMohalla('Mohalla Kishti').key, 'kishtii');
  assert.equal(canonicalCreditMohalla('chamyaa').key, 'chamyaaa');
  assert.equal(canonicalCreditMohalla('  '), null);
  assert.equal(canonicalCreditMohalla(''), null);
  assert.equal(canonicalCreditMohalla(null), null);
});

test('credit months are strict YYYY-MM and month hours follow the calendar', () => {
  assert.equal(isValidCreditMonth('2026-01'), true);
  assert.equal(isValidCreditMonth('2026-13'), false);
  assert.equal(isValidCreditMonth('2026-02-30'), false);
  assert.equal(isValidCreditMonth(''), false);
  assert.equal(monthHoursFor('2026-01'), 744);
  assert.equal(monthHoursFor('2026-02'), 672);
  assert.equal(monthHoursFor(''), OUTAGE_CREDIT_STANDARD_MONTH_HOURS);
  assert.equal(monthHoursFor('not-a-month'), OUTAGE_CREDIT_STANDARD_MONTH_HOURS);
});

test('pro-rata credit matches the stated formula and caps at the monthly price', () => {
  assert.equal(creditForPrice(150000, 48, 744), 9677);
  assert.equal(creditForPrice(150000, 744, 744), 150000);
  assert.equal(creditForPrice(150000, 2000, 744), 150000);
  assert.equal(creditForPrice(150000, 0, 744), null);
  assert.equal(creditForPrice(-5, 48, 744), null);
  assert.equal(creditForPrice(150000, 48, 0), null);
});

test('formula text states the rule in plain words', () => {
  const record = normalizeOutageCredit(BASE);
  assert.match(record.formulaText, /Downtime hours/);
  assert.match(record.formulaText, /744 hours \(2026-01\)/);
  assert.match(record.formulaText, /capped at the monthly price/);
  const noMonth = normalizeOutageCredit({ ...BASE, month: '' });
  assert.match(noMonth.formulaText, /720 hours \(standard month\)/);
});

test('half-formed records are refused outright', () => {
  assert.equal(normalizeOutageCredit({ ...BASE, id: '' }), null);
  assert.equal(normalizeOutageCredit({ ...BASE, outageId: '' }), null);
  assert.equal(normalizeOutageCredit({ ...BASE, affectedMohallas: [] }), null);
  assert.equal(normalizeOutageCredit({ ...BASE, downtimeHours: 0 }), null);
  assert.equal(normalizeOutageCredit({ ...BASE, thresholdHours: -3 }), null);
  assert.equal(normalizeOutageCredit({ ...BASE, downtimeHours: 'soon' }), null);
  assert.equal(normalizeOutageCredit(null), null);
});

test('a maintenance window without a reason to include it is refused', () => {
  assert.equal(normalizeOutageCredit({ ...BASE, maintenanceWindowId: 'MW-1' }), null);
  const withReason = normalizeOutageCredit({
    ...BASE, maintenanceWindowId: 'MW-1', maintenanceIncludeReason: 'Window ran over into an outage',
  });
  assert.equal(withReason.maintenanceWindowId, 'MW-1');
  assert.equal(withReason.maintenanceIncludeReason, 'Window ran over into an outage');
  const noWindow = normalizeOutageCredit({ ...BASE, maintenanceIncludeReason: 'stray reason' });
  assert.equal(noWindow.maintenanceWindowId, null);
  assert.equal(noWindow.maintenanceIncludeReason, null);
});

test('the fixture credits the affected customer and excludes the outsider', () => {
  const record = normalizeOutageCredit(BASE);
  assert.equal(record.qualifies, true);
  assert.equal(record.credits.length, 1);
  assert.equal(record.credits[0].customerId, 'C1');
  assert.equal(record.credits[0].creditCents, 9677);
  assert.equal(record.credits[0].status, 'planned');
  assert.equal(record.credits[0].concessionRef, null);
  assert.equal(record.excluded.length, 1);
  assert.equal(record.excluded[0].customerId, 'C2');
  assert.equal(record.excluded[0].reason, 'outside affected mohallas');
});

test('downtime exactly at the threshold qualifies, below it credits nobody', () => {
  const atThreshold = normalizeOutageCredit({ ...BASE, downtimeHours: 12, thresholdHours: 12 });
  assert.equal(atThreshold.qualifies, true);
  assert.equal(atThreshold.credits.length, 1);
  const below = normalizeOutageCredit({ ...BASE, downtimeHours: 11, thresholdHours: 12 });
  assert.equal(below.qualifies, false);
  assert.equal(below.credits.length, 0);
  assert.equal(below.excluded.some((row) => row.customerId === 'C1'
    && row.reason === 'downtime below qualifying threshold'), true);
});

test('rupees convert once and cents are used as-is on re-read', () => {
  const fromRupees = normalizeOutageCredit({
    ...BASE,
    customers: [{ customerId: 'C1', mohalla: 'Bani', monthlyPrice: 1500 }],
  });
  assert.equal(fromRupees.credits[0].monthlyPriceCents, 150000);
  assert.equal(fromRupees.credits[0].creditCents, 9677);
  const reread = normalizeOutageCredit(fromRupees);
  assert.equal(reread.credits[0].monthlyPriceCents, 150000);
  assert.equal(reread.credits[0].creditCents, 9677);
  const noPrice = normalizeOutageCredit({
    ...BASE,
    customers: [{ customerId: 'C9', mohalla: 'Bani' }],
  });
  assert.equal(noPrice.credits.length, 0);
  assert.equal(noPrice.excluded[0].reason, 'no usable monthly price');
});

test('upsert, find, and remove keep the list normalised and inputs unmutated', () => {
  const frozen = JSON.parse(JSON.stringify(BASE));
  const record = normalizeOutageCredit(frozen);
  assert.deepEqual(frozen, BASE);
  let list = upsertOutageCredit([], record);
  assert.equal(list.length, 1);
  list = upsertOutageCredit(list, { ...BASE, downtimeHours: 24 });
  assert.equal(list.length, 1);
  assert.equal(list[0].downtimeHours, 24);
  assert.equal(list[0].credits[0].creditCents, 4839);
  assert.equal(findOutageCredit(list, 'OC-1').id, 'OC-1');
  assert.equal(findOutageCredit(list, 'nope'), null);
  assert.equal(upsertOutageCredit(list, { ...BASE, id: '' }).length, 1);
  assert.deepEqual(removeOutageCredit(list, 'OC-1'), []);
  assert.equal(normalizeOutageCreditList('nope').length, 0);
});

test('marking applied records only the concession reference; reopen clears it', () => {
  let list = upsertOutageCredit([], normalizeOutageCredit(BASE));
  assert.deepEqual(markCreditApplied(list, 'OC-1', 'C1', '  '), list);
  assert.deepEqual(markCreditApplied(list, 'OC-1', 'C9', 'BILL-1'), list);
  list = markCreditApplied(list, 'OC-1', 'C1', 'BILL-1');
  assert.equal(list[0].credits[0].status, 'applied');
  assert.equal(list[0].credits[0].concessionRef, 'BILL-1');
  const reapplied = markCreditApplied(list, 'OC-1', 'C1', 'BILL-2');
  assert.equal(reapplied[0].credits[0].concessionRef, 'BILL-1');
  list = reopenCredit(list, 'OC-1', 'C1');
  assert.equal(list[0].credits[0].status, 'planned');
  assert.equal(list[0].credits[0].concessionRef, null);
});

test('a stored record re-read keeps its applied rows and references', () => {
  let list = upsertOutageCredit([], normalizeOutageCredit(BASE));
  list = markCreditApplied(list, 'OC-1', 'C1', 'BILL-1');
  const reread = normalizeOutageCreditList(list);
  assert.equal(reread.length, 1);
  assert.equal(reread[0].credits[0].status, 'applied');
  assert.equal(reread[0].credits[0].concessionRef, 'BILL-1');
  assert.equal(reread[0].credits[0].creditCents, 9677);
  assert.equal(outageCreditCsv(reread).includes('BILL-1'), true);
});

test('filters match outage id and mohalla, including aliases', () => {
  const list = upsertOutageCredit([], normalizeOutageCredit(BASE));
  assert.equal(filterOutageCredits(list, { outageId: 'O22-1' }).length, 1);
  assert.equal(filterOutageCredits(list, { outageId: 'O22-9' }).length, 0);
  assert.equal(filterOutageCredits(list, { mohalla: 'Mohalla Bani' }).length, 1);
  assert.equal(filterOutageCredits(list, { mohalla: 'Kishti' }).length, 0);
  assert.equal(filterOutageCredits(list, {}).length, 1);
});

test('summary totals are exact in integer cents', () => {
  const list = upsertOutageCredit([], normalizeOutageCredit(BASE));
  const summary = buildOutageCreditSummary(list);
  assert.equal(summary.records, 1);
  assert.equal(summary.qualifyingRecords, 1);
  assert.equal(summary.creditedCustomers, 1);
  assert.equal(summary.appliedCustomers, 0);
  assert.equal(summary.excludedCustomers, 1);
  assert.equal(summary.totalCreditCents, 9677);
  assert.equal(outageCreditSummaryText(summary), '1 credit record · 1 customer credited · 0 applied · 1 excluded · total Rs. 96.77');
  assert.equal(buildOutageCreditSummary([]).totalCreditCents, 0);
});

test('HTML escapes, CSV quotes, and filenames are safe', () => {
  const evil = normalizeOutageCredit({
    ...BASE,
    outageLabel: '<script>alert("x")</script>',
    customers: [{ customerId: 'C1', customerName: 'A "quoted", name', mohalla: 'Bani', monthlyPriceCents: 150000 }],
  });
  const html = outageCreditHtml([evil]);
  assert.equal(html.includes('<script>'), false);
  assert.match(html, /&lt;script&gt;/);
  const csv = outageCreditCsv([evil]);
  assert.match(csv, /"A ""quoted"", name"/);
  assert.match(csv, /^credit_id,outage_id,month,/);
  assert.equal(outageCreditFilename('2026-01-20'), 'outage-credits-2026-01-20.csv');
  assert.equal(outageCreditFilename('junk'), 'outage-credits-outage-credits.csv');
  assert.equal(outageCreditHtml([]), '<p>No outage credit records yet.</p>');
});

test('purity fence: no store, no bill amount field, no concession calculator import', () => {
  const source = readFileSync(new URL('../outage-credits.js', import.meta.url), 'utf8');
  assert.equal(/^import /m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('dueAmount'), false);
  assert.equal(source.includes('concessionAmount'), false);
  assert.equal(source.includes('concession-helper'), false);
  assert.equal(source.includes('downtime-analytics'), false);
});
