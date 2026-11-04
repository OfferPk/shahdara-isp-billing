import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  validChargeMonth,
  chargeAmountCents,
  normalizeChargeSchedule,
  normalizeChargeScheduleList,
  upsertChargeSchedule,
  markInstalmentPaid,
  scheduleMonths,
  instalmentAmounts,
  scheduleView,
  missedInstalments,
  billLineForSchedule,
  billLinesForMonth,
  chargeScheduleSummaryText,
  chargeScheduleHtml,
  chargeScheduleCsv,
  chargeScheduleFilename,
} from '../charge-instalments.js';

const here = dirname(fileURLToPath(import.meta.url));

const schedule = (overrides = {}) => ({
  id: 'CI-1',
  customerId: 'C-76',
  customerName: 'Orient school',
  label: 'Installation fee',
  amountCents: 100001,
  instalmentCount: 3,
  firstMonth: '2026-11',
  paidInstalments: [],
  ...overrides,
});

test('validChargeMonth accepts YYYY-MM only', () => {
  assert.equal(validChargeMonth('2026-11'), true);
  assert.equal(validChargeMonth('2026-13'), false);
  assert.equal(validChargeMonth('2026-1'), false);
  assert.equal(validChargeMonth('2026-11-04'), false);
  assert.equal(validChargeMonth(''), false);
});

test('chargeAmountCents keeps integer cents and converts rupees once', () => {
  assert.equal(chargeAmountCents({ totalCents: 25000 }), 25000);
  assert.equal(chargeAmountCents({ amountCents: 25000 }), 25000);
  assert.equal(chargeAmountCents({ amount: 250 }), 25000);
  assert.equal(chargeAmountCents({ amount: '250.50' }), 25050);
  assert.equal(chargeAmountCents({ amountCents: 0 }), null);
  assert.equal(chargeAmountCents({ amount: -5 }), null);
  assert.equal(chargeAmountCents({ amount: 'nope' }), null);
  assert.equal(chargeAmountCents(null), null);
});

test('half-formed schedules refused and unknown fields dropped', () => {
  assert.equal(normalizeChargeSchedule(schedule({ id: '' })), null);
  assert.equal(normalizeChargeSchedule(schedule({ customerId: '' })), null);
  assert.equal(normalizeChargeSchedule(schedule({ label: '  ' })), null);
  assert.equal(normalizeChargeSchedule(schedule({ amountCents: 0 })), null);
  assert.equal(normalizeChargeSchedule(schedule({ instalmentCount: 0 })), null);
  assert.equal(normalizeChargeSchedule(schedule({ instalmentCount: 61 })), null);
  assert.equal(normalizeChargeSchedule(schedule({ instalmentCount: 2.5 })), null);
  assert.equal(normalizeChargeSchedule(schedule({ firstMonth: '2026-13' })), null);
  const clean = normalizeChargeSchedule(schedule({ billId: 'B-1', discount: 10 }));
  assert.equal('billId' in clean, false);
  assert.equal('discount' in clean, false);
  assert.equal(clean.totalCents, 100001);
});

test('paid marks beyond the count are dropped', () => {
  const clean = normalizeChargeSchedule(schedule({ paidInstalments: [1, 9, 1, 'x'] }));
  assert.deepEqual(clean.paidInstalments, [1]);
});

test('scheduleMonths covers consecutive months across a year boundary', () => {
  assert.deepEqual(scheduleMonths(schedule({ firstMonth: '2026-12', instalmentCount: 3 })), ['2026-12', '2027-01', '2027-02']);
  assert.deepEqual(scheduleMonths(null), []);
});

test('instalment amounts sum exactly to the total, leftover cents earliest first', () => {
  const amounts = instalmentAmounts(100001, 3);
  assert.deepEqual(amounts, [33334, 33334, 33333]);
  assert.equal(amounts.reduce((sum, item) => sum + item, 0), 100001);
  assert.deepEqual(instalmentAmounts(10000, 4), [2500, 2500, 2500, 2500]);
  assert.deepEqual(instalmentAmounts(100, 3), [34, 33, 33]);
  assert.deepEqual(instalmentAmounts(0, 3), []);
  assert.deepEqual(instalmentAmounts(100, 0), []);
});

test('upsert inserts, and a terms change on an existing id is refused outright', () => {
  const first = upsertChargeSchedule([], schedule());
  assert.equal(first.length, 1);
  assert.equal(upsertChargeSchedule(first, schedule({ amountCents: 99999 })), null);
  assert.equal(upsertChargeSchedule(first, schedule({ instalmentCount: 4 })), null);
  assert.equal(upsertChargeSchedule(first, schedule({ firstMonth: '2026-12' })), null);
  assert.equal(upsertChargeSchedule(first, schedule({ label: 'Other fee' })), null);
  assert.equal(upsertChargeSchedule(first, schedule({ customerId: 'C-77' })), null);
  assert.equal(upsertChargeSchedule(first, schedule({ amountCents: 0 })), null);
  // Paid-mark-only update is allowed: it changes no charge term.
  const marked = upsertChargeSchedule(first, schedule({ paidInstalments: [1] }));
  assert.equal(marked.length, 1);
  assert.deepEqual(marked[0].paidInstalments, [1]);
  assert.equal(marked[0].totalCents, 100001);
  // The refused upserts left the list exactly unchanged.
  assert.equal(first.length, 1);
  assert.deepEqual(first[0].paidInstalments, []);
});

test('markInstalmentPaid moves only forward and never touches terms', () => {
  const marked = markInstalmentPaid(schedule(), 2);
  assert.deepEqual(marked.paidInstalments, [2]);
  assert.equal(marked.totalCents, 100001);
  assert.equal(markInstalmentPaid(schedule(), 0), null);
  assert.equal(markInstalmentPaid(schedule(), 4), null);
  assert.equal(markInstalmentPaid(schedule({ paidInstalments: [2] }), 2), null);
  assert.equal(markInstalmentPaid(null, 1), null);
});

test('scheduleView statuses: paid, due, missed, upcoming, scheduled', () => {
  const view = scheduleView(schedule({ paidInstalments: [1] }), '2026-12');
  assert.deepEqual(view.instalments.map((item) => item.status), ['paid', 'due', 'upcoming']);
  assert.equal(view.paidCents, 33334);
  assert.equal(view.remainingCents, 100001 - 33334);
  assert.equal(view.remainingCount, 2);
  assert.equal(view.missedCount, 0);
  const missed = scheduleView(schedule(), '2027-01');
  assert.deepEqual(missed.instalments.map((item) => item.status), ['missed', 'missed', 'due']);
  assert.equal(missed.missedCents, 33334 + 33334);
  assert.equal(missed.nextDue.month, '2026-11');
  const unscheduled = scheduleView(schedule(), 'not-a-month');
  assert.deepEqual(unscheduled.instalments.map((item) => item.status), ['scheduled', 'scheduled', 'scheduled']);
  assert.equal(scheduleView(null, '2026-12'), null);
});

test('missed instalments stay visible, oldest month first', () => {
  const list = [
    schedule({ id: 'CI-2', firstMonth: '2026-10', instalmentCount: 2, amountCents: 5000 }),
    schedule({ id: 'CI-1', paidInstalments: [1] }),
  ];
  const missed = missedInstalments(list, '2026-12');
  assert.equal(missed.length, 2);
  assert.deepEqual(missed.map((item) => item.month), ['2026-10', '2026-11']);
  assert.equal(missed[0].scheduleId, 'CI-2');
  // A paid instalment never appears as missed, and the current
  // month's instalment is due, not missed.
  assert.equal(missed.some((item) => item.scheduleId === 'CI-1'), false);
});

test('bill line names the instalment and what remains after it', () => {
  const line = billLineForSchedule(schedule(), '2026-12');
  assert.equal(line.index, 2);
  assert.equal(line.ofCount, 3);
  assert.equal(line.amountCents, 33334);
  assert.equal(line.remainingAfter, 1);
  assert.match(line.text, /Instalment 2 of 3/);
  assert.match(line.text, /1 remaining after this/);
  assert.equal(billLineForSchedule(schedule(), '2027-05'), null);
  assert.equal(billLineForSchedule(null, '2026-12'), null);
  const lines = billLinesForMonth([schedule(), schedule({ id: 'CI-2', label: 'Router fee', amountCents: 9000, instalmentCount: 2, firstMonth: '2026-12' })], '2026-12');
  assert.equal(lines.length, 2);
});

test('summary text, HTML escaping, CSV quoting, filename', () => {
  const view = scheduleView(schedule({ label: 'Fee <b>& co', paidInstalments: [1] }), '2026-12');
  assert.match(chargeScheduleSummaryText(view), /1 paid/);
  assert.match(chargeScheduleSummaryText(view), /2 remaining/);
  const html = chargeScheduleHtml(view);
  assert.equal(html.includes('<b>'), false);
  assert.match(html, /Fee &lt;b&gt;&amp; co/);
  const csv = chargeScheduleCsv([schedule({ label: 'Fee, "quoted"' })], '2026-11');
  assert.match(csv, /"Fee, ""quoted"""/);
  assert.equal(chargeScheduleFilename(), 'charge-instalment-schedules.csv');
});

test('views never mutate their inputs', () => {
  const input = schedule({ paidInstalments: [1] });
  const before = JSON.stringify(input);
  scheduleView(input, '2026-12');
  billLineForSchedule(input, '2026-12');
  missedInstalments([input], '2026-12');
  assert.equal(JSON.stringify(input), before);
});

test('normalising an already-normalised schedule is a no-op', () => {
  const once = normalizeChargeSchedule(schedule());
  const twice = normalizeChargeSchedule(once);
  assert.deepEqual(twice, once);
  assert.deepEqual(scheduleMonths(once), ['2026-11', '2026-12', '2027-01']);
});

test('normalise list dedupes by id, first wins', () => {
  const list = normalizeChargeScheduleList([schedule(), schedule({ amountCents: 5000 }), schedule({ id: '' })]);
  assert.equal(list.length, 1);
  assert.equal(list[0].totalCents, 100001);
});

test('purity fence: no imports, no storage, no other schedule module', () => {
  const source = readFileSync(join(here, '..', 'charge-instalments.js'), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('repayment-plan'), false);
  assert.equal(source.includes('repaymentPlan'), false);
});

test('wiring: module import, store, render call, and panel section all exist', () => {
  const app = readFileSync(join(here, '..', 'app.js'), 'utf8');
  const html = readFileSync(join(here, '..', 'index.html'), 'utf8');
  assert.match(app, /from '\.\/charge-instalments\.js'/);
  assert.match(app, /shahdara_charge_instalments_v1/);
  assert.match(app, /renderChargeInstalments\(\)/);
  assert.match(html, /id="chargeInstalmentBody"/);
  assert.match(html, /id="chargeInstalmentSaveBtn"/);
  assert.match(html, /id="chargeInstalmentMarkPaidBtn"/);
  assert.match(html, /id="chargeInstalmentExportBtn"/);
});
