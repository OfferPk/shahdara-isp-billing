// Sharafat 70 — Waada day chips stop at the 28th: no 29th/30th/31st, no 5th.
//
// dayOfMonthWaadaDate capped every day above 28 at null, so the chip path
// could never promise the 29th, 30th or 31st, and there was no chip for
// the 5th (the bill due date). The cap is lifted to 31 with a clamp to the
// target month's last day when the month is shorter (the acceptance allows
// "the clamped equivalent"), and a 'fifth' chip joins the row. Tests on
// synthetic data only: no real customer names, no phone numbers anywhere
// in this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  dayOfMonthWaadaDate,
  fifthOfMonthWaadaDate,
  tenthOfMonthWaadaDate,
  computeWaadaChipDate
} from '../waada-queue.js';
import { applyFieldModeWaadaChip } from '../field-mode.js';
import { TRANSLATIONS } from '../nav-language.js';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');
const customer = (extra = {}) => ({ id: 'c1', customerNumber: 101, name: 'Synthetic Tester', bills: [], ...extra });

// ------------------------------------------------------------ dayOfMonthWaadaDate: 29-31

test('Sharafat 70: the 29th and 30th are real chip dates in a 30-day month', () => {
  assert.equal(dayOfMonthWaadaDate('2026-11-12', 29), '2026-11-29');
  assert.equal(dayOfMonthWaadaDate('2026-11-12', 30), '2026-11-30');
  // Still ahead this month, so the date lands in the same month.
  assert.equal(dayOfMonthWaadaDate('2026-11-01', 29), '2026-11-29');
});

test('Sharafat 70: the 31st clamps to the month\'s last day when the month is shorter', () => {
  // The acceptance allows "the clamped equivalent": the 31st chip from
  // 2026-11-12 offers 2026-11-30, not 2026-12-31.
  assert.equal(dayOfMonthWaadaDate('2026-11-12', 31), '2026-11-30');
  assert.equal(dayOfMonthWaadaDate('2026-04-10', 31), '2026-04-30');
  assert.equal(dayOfMonthWaadaDate('2026-09-10', 31), '2026-09-30');
  // A 31-day month needs no clamp.
  assert.equal(dayOfMonthWaadaDate('2026-10-05', 31), '2026-10-31');
});

test('Sharafat 70: passed-day rollover still works for 29-31', () => {
  assert.equal(dayOfMonthWaadaDate('2026-03-31', 30), '2026-04-30');
  assert.equal(dayOfMonthWaadaDate('2026-11-30', 29), '2026-12-29');
  assert.equal(dayOfMonthWaadaDate('2026-11-30', 30), '2026-11-30');
});

test('Sharafat 70: the clamp applies after the rollover, into a shorter month', () => {
  // 30th from 2026-01-31: today has passed the 30th, so the target is
  // February — and February has no 30th, so it clamps to 2026-02-28.
  assert.equal(dayOfMonthWaadaDate('2026-01-31', 30), '2026-02-28');
  assert.equal(dayOfMonthWaadaDate('2026-01-31', 29), '2026-02-28');
  // Note on the prep's R12 line ("31st from 2026-01-31 -> 2026-02-28"):
  // under the existing rollover rule (same month when today.day <= day)
  // the 31st from January 31st IS today, so it stays in January — the
  // rollover-into-a-shorter-month case is the 30th above, not the 31st.
  assert.equal(dayOfMonthWaadaDate('2026-01-31', 31), '2026-01-31');
});

test('Sharafat 70: year rollover for 29-31', () => {
  assert.equal(dayOfMonthWaadaDate('2026-12-31', 30), '2027-01-30');
  assert.equal(dayOfMonthWaadaDate('2026-12-20', 31), '2026-12-31');
  assert.equal(dayOfMonthWaadaDate('2026-12-31', 31), '2026-12-31');
});

test('Sharafat 70: February clamps to the 28th in a non-leap year', () => {
  assert.equal(dayOfMonthWaadaDate('2026-02-10', 29), '2026-02-28');
  assert.equal(dayOfMonthWaadaDate('2026-02-10', 30), '2026-02-28');
  assert.equal(dayOfMonthWaadaDate('2026-02-10', 31), '2026-02-28');
  // From 2026-01-30 the 31st has not passed yet, so it stays in January.
  assert.equal(dayOfMonthWaadaDate('2026-01-30', 31), '2026-01-31');
});

test('Sharafat 70: February keeps the 29th in a leap year, clamps 30th/31st to it', () => {
  assert.equal(dayOfMonthWaadaDate('2028-02-10', 29), '2028-02-29');
  assert.equal(dayOfMonthWaadaDate('2028-02-10', 30), '2028-02-29');
  assert.equal(dayOfMonthWaadaDate('2028-02-10', 31), '2028-02-29');
});

test('Sharafat 70: today itself is still allowed for 29-31', () => {
  assert.equal(dayOfMonthWaadaDate('2026-03-31', 31), '2026-03-31');
  assert.equal(dayOfMonthWaadaDate('2026-11-05', 5), '2026-11-05');
  assert.equal(dayOfMonthWaadaDate('2026-11-29', 29), '2026-11-29');
});

test('Sharafat 70: the old guards still hold, and 1-28 behave exactly as before', () => {
  assert.equal(dayOfMonthWaadaDate('2026-11-12', 0), null);
  assert.equal(dayOfMonthWaadaDate('2026-11-12', 32), null);
  assert.equal(dayOfMonthWaadaDate('2026-11-12', Number.NaN), null);
  assert.equal(dayOfMonthWaadaDate('2026-11-12', 'thirty'), null);
  assert.equal(dayOfMonthWaadaDate('not-a-date', 31), null);
  assert.equal(dayOfMonthWaadaDate('2026-11-12', 15), '2026-11-15');
  assert.equal(dayOfMonthWaadaDate('2026-11-12', 28), '2026-11-28');
  assert.equal(dayOfMonthWaadaDate('2026-10-16', 15), '2026-11-15');
  assert.equal(tenthOfMonthWaadaDate('2026-02-28'), '2026-03-10');
});

// ------------------------------------------------------------ the dispatcher

test('Sharafat 70: the 5th chip offers the next due date (acceptance case)', () => {
  // From 2026-11-12 the 5th has passed -> 2026-12-05, exactly the next
  // bill due date (DEFAULT_BILL_DUE_DAY = 5).
  assert.equal(computeWaadaChipDate('fifth', '2026-11-12'), '2026-12-05');
  assert.equal(computeWaadaChipDate('fifth', '2026-11-04'), '2026-11-05');
  assert.equal(computeWaadaChipDate('fifth', '2026-11-05'), '2026-11-05');
  assert.equal(computeWaadaChipDate('fifth', '2026-12-20'), '2027-01-05');
});

test('Sharafat 70: the 29th/30th/31st chips dispatch to the clamped day-of-month rule', () => {
  assert.equal(computeWaadaChipDate('29th', '2026-11-12'), '2026-11-29');
  assert.equal(computeWaadaChipDate('30th', '2026-11-12'), '2026-11-30');
  // Clamp reading, not the roll reading: the 31st chip from 2026-11-12
  // offers 2026-11-30 (see the acceptance's "clamped equivalent").
  assert.equal(computeWaadaChipDate('31st', '2026-11-12'), '2026-11-30');
  assert.equal(computeWaadaChipDate('31st', '2026-02-10'), '2026-02-28');
});

test('Sharafat 70: fifthOfMonthWaadaDate is a thin wrapper beside tenth/fifteenth', () => {
  assert.equal(fifthOfMonthWaadaDate('2026-11-12'), '2026-12-05');
  assert.equal(fifthOfMonthWaadaDate('2026-11-04'), '2026-11-05');
  assert.equal(fifthOfMonthWaadaDate('not-a-date'), null);
});

test('Sharafat 70: unknown chips still return null, existing chips unchanged', () => {
  assert.equal(computeWaadaChipDate('bogus', '2026-11-12'), null);
  assert.equal(computeWaadaChipDate('twentyninth', '2026-11-12'), null);
  assert.equal(computeWaadaChipDate('tenth', '2026-11-12'), '2026-12-10');
  assert.equal(computeWaadaChipDate('plus2', '2026-11-12'), '2026-11-14');
  assert.equal(computeWaadaChipDate('custom', '2026-11-12', '2026-11-29'), '2026-11-29');
});

// ------------------------------------------------------------ markup: all three rows

test('Sharafat 70: the chip dialog row carries the four new chips in order', () => {
  const html = read('index.html');
  const row = html.indexOf('class="waada-chip-row"');
  assert.ok(row > 0, 'dialog chip row must exist');
  for (const chip of ['plus2', 'plus5', 'fifth', 'tenth', '29th', '30th', '31st']) {
    assert.ok(html.includes(`data-waada-chip="${chip}"`), `dialog must carry chip ${chip}`);
  }
  const at = (chip) => html.indexOf(`data-waada-chip="${chip}"`);
  assert.ok(at('plus2') < at('plus5'), '+2 before +5');
  assert.ok(at('plus5') < at('fifth'), '+5 before 5th');
  assert.ok(at('fifth') < at('tenth'), '5th before 10th');
  assert.ok(at('tenth') < at('29th'), '10th before 29th');
  assert.ok(at('29th') < at('30th'), '29th before 30th');
  assert.ok(at('30th') < at('31st'), '30th before 31st');
  assert.ok(html.includes('>5th of Month<'), 'dialog 5th chip reads "5th of Month"');
});

test('Sharafat 70: the profile banner row carries the four new chips in order', () => {
  const app = read('app.js');
  for (const chip of ['plus2', 'plus5', 'fifth', 'tenth', '29th', '30th', '31st']) {
    assert.ok(app.includes(`data-wada-quick-chip="${chip}"`), `banner must carry chip ${chip}`);
  }
  const at = (chip) => app.indexOf(`data-wada-quick-chip="${chip}"`);
  assert.ok(at('plus2') < at('plus5'), '+2 before +5');
  assert.ok(at('plus5') < at('fifth'), '+5 before 5th');
  assert.ok(at('fifth') < at('tenth'), '5th before 10th');
  assert.ok(at('tenth') < at('29th'), '10th before 29th');
  assert.ok(at('29th') < at('30th'), '29th before 30th');
  assert.ok(at('30th') < at('31st'), '30th before 31st');
});

test('Sharafat 70: the field-mode row carries the four new chips in order', () => {
  const src = read('field-mode.js');
  for (const chip of ['plus2', 'plus5', 'fifth', 'tenth', '29th', '30th', '31st']) {
    assert.ok(src.includes(`data-field-waada="${chip}"`), `field mode must carry chip ${chip}`);
  }
  const at = (chip) => src.indexOf(`data-field-waada="${chip}"`);
  assert.ok(at('plus2') < at('plus5'), '+2 before +5');
  assert.ok(at('plus5') < at('fifth'), '+5 before 5th');
  assert.ok(at('fifth') < at('tenth'), '5th before 10th');
  assert.ok(at('tenth') < at('29th'), '10th before 29th');
  assert.ok(at('29th') < at('30th'), '29th before 30th');
  assert.ok(at('30th') < at('31st'), '30th before 31st');
});

test('Sharafat 70: the new 5th-chip label exists in both dictionaries', () => {
  assert.equal(TRANSLATIONS.en.prof_waada_chip_5th, '5th of Month');
  assert.equal(TRANSLATIONS.ur.prof_waada_chip_5th, 'مہینے کی 5 تاریخ');
  assert.match(TRANSLATIONS.ur.prof_waada_chip_5th, /[\u0600-\u06FF]/, 'UR label reads Urdu');
});

// ------------------------------------------------------------ chip-apply end to end

test('Sharafat 70: applying the 5th chip in field mode sets the next due date', () => {
  // Amount-less customer, so the post-69 throw cannot fire (R6).
  const updated = applyFieldModeWaadaChip(customer(), 'fifth', '2026-11-12');
  assert.equal(updated.promiseDate, '2026-12-05');
  assert.equal(updated.promiseAmount, null);
});

test('Sharafat 70: applying the 31st chip in February sets the clamped date', () => {
  const updated = applyFieldModeWaadaChip(customer(), '31st', '2026-02-10');
  assert.equal(updated.promiseDate, '2026-02-28');
  const late = applyFieldModeWaadaChip(customer(), '29th', '2026-11-12');
  assert.equal(late.promiseDate, '2026-11-29');
});

test('Sharafat 70: applying a late-month chip keeps a stored positive amount', () => {
  const stored = customer({ promiseAmount: 3000, promiseDate: '2026-11-01' });
  const updated = applyFieldModeWaadaChip(stored, '30th', '2026-11-12');
  assert.equal(updated.promiseDate, '2026-11-30');
  assert.equal(updated.promiseAmount, 3000);
});
