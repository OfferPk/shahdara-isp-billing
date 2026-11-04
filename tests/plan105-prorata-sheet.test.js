import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  validProrataMonth,
  validProrataDate,
  daysInMonthFor,
  prorataPriceCents,
  prorataAmountCents,
  deriveDaysCharged,
  normalizeProrataSheet,
  normalizeProrataSheetList,
  upsertProrataSheet,
  lockProrataSheet,
  removeProrataSheet,
  findProrataSheet,
  prorataSheetsForCustomer,
  prorataSheetCheck,
  prorataSheetSummaryText,
  prorataSheetArithmeticText,
  prorataSheetHtml,
  prorataSheetCsv,
  prorataSheetFilename,
} from '../prorata-sheet.js';

const here = dirname(fileURLToPath(import.meta.url));

const sheet = (overrides = {}) => ({
  id: 'PS-1',
  customerId: 'C-76',
  customerName: 'Orient school',
  eventType: 'join',
  eventDate: '2026-11-10',
  billMonth: '2026-11',
  monthlyPriceCents: 200000,
  ...overrides,
});

test('validProrataMonth accepts YYYY-MM only', () => {
  assert.equal(validProrataMonth('2026-11'), true);
  assert.equal(validProrataMonth('2026-13'), false);
  assert.equal(validProrataMonth('2026-1'), false);
  assert.equal(validProrataMonth('Nov 2026'), false);
});

test('validProrataDate rejects impossible dates', () => {
  assert.equal(validProrataDate('2026-11-10'), true);
  assert.equal(validProrataDate('2026-02-30'), false);
  assert.equal(validProrataDate('2024-02-29'), true);
  assert.equal(validProrataDate('2026-02-29'), false);
  assert.equal(validProrataDate('2026-11-31'), false);
});

test('daysInMonthFor covers February leap years and all twelve months', () => {
  assert.equal(daysInMonthFor(2024, 2), 29);
  assert.equal(daysInMonthFor(2026, 2), 28);
  assert.equal(daysInMonthFor(1900, 2), 28);
  assert.equal(daysInMonthFor(2000, 2), 29);
  assert.equal(daysInMonthFor(2026, 12), 31);
  assert.equal(daysInMonthFor(2026, 4), 30);
  assert.equal(daysInMonthFor(2026, 13), null);
});

test('prorataPriceCents keeps cents and rupees paths separate', () => {
  assert.equal(prorataPriceCents({ monthlyPriceCents: 200000 }), 200000);
  assert.equal(prorataPriceCents({ monthlyPrice: 2000 }), 200000);
  assert.equal(prorataPriceCents({ monthlyPrice: 1999.99 }), 199999);
  assert.equal(prorataPriceCents({ monthlyPrice: 0 }), null);
  assert.equal(prorataPriceCents({ monthlyPrice: -5 }), null);
  assert.equal(prorataPriceCents({}), null);
});

test('prorataAmountCents rounds to the nearest cent', () => {
  assert.equal(prorataAmountCents(200000, 21, 30), 140000);
  assert.equal(prorataAmountCents(100000, 10, 30), 33333);
  assert.equal(prorataAmountCents(100000, 0, 30), null);
  assert.equal(prorataAmountCents(100000, 31, 30), null);
  assert.equal(prorataAmountCents(0, 5, 30), null);
});

test('deriveDaysCharged covers join, leave, and package change', () => {
  assert.equal(deriveDaysCharged('join', '2026-11-10', '2026-11'), 21);
  assert.equal(deriveDaysCharged('join', '2026-11-01', '2026-11'), 30);
  assert.equal(deriveDaysCharged('leave', '2026-11-10', '2026-11'), 10);
  assert.equal(deriveDaysCharged('package-change', '2026-11-10', '2026-11'), 21);
  assert.equal(deriveDaysCharged('join', '2026-12-10', '2026-11'), null);
  assert.equal(deriveDaysCharged('other', '2026-11-10', '2026-11'), null);
});

test('normalizeProrataSheet computes days and amount from inputs', () => {
  const out = normalizeProrataSheet(sheet());
  assert.equal(out.daysInMonth, 30);
  assert.equal(out.daysCharged, 21);
  assert.equal(out.amountCents, 140000);
  assert.equal(out.locked, false);
  assert.equal(out.billId, '');
});

test('normalizeProrataSheet refuses half-formed sheets', () => {
  assert.equal(normalizeProrataSheet(sheet({ id: '' })), null);
  assert.equal(normalizeProrataSheet(sheet({ customerId: '  ' })), null);
  assert.equal(normalizeProrataSheet(sheet({ eventType: 'renew' })), null);
  assert.equal(normalizeProrataSheet(sheet({ eventDate: '2026-02-30' })), null);
  assert.equal(normalizeProrataSheet(sheet({ billMonth: '2026-11', eventDate: '2026-12-10' })), null);
  assert.equal(normalizeProrataSheet(sheet({ monthlyPriceCents: 0 })), null);
  assert.equal(normalizeProrataSheet(sheet({ daysCharged: 31 })), null);
  assert.equal(normalizeProrataSheet(sheet({ daysCharged: 0 })), null);
});

test('normalizeProrataSheet drops unknown fields and keeps a stored amount', () => {
  const out = normalizeProrataSheet(sheet({ billTotal: 999, paymentId: 'PAY-1', amountCents: 123456 }));
  assert.equal(out.billTotal, undefined);
  assert.equal(out.paymentId, undefined);
  assert.equal(out.amountCents, 123456);
  assert.equal(prorataSheetCheck(out).matches, false);
});

test('upsert replaces an unlocked sheet and half-formed upsert leaves the list unchanged', () => {
  const first = upsertProrataSheet([], sheet());
  assert.equal(first.length, 1);
  const replaced = upsertProrataSheet(first, sheet({ note: 'changed' }));
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].note, 'changed');
  assert.equal(upsertProrataSheet(first, sheet({ eventDate: '2026-02-30' })), null);
  assert.deepEqual(first, upsertProrataSheet(first, sheet({ eventDate: 'bad' })) ?? first);
});

test('lock freezes a sheet: no edit, no re-lock, no removal', () => {
  const list = upsertProrataSheet([], sheet());
  const locked = lockProrataSheet(list, 'PS-1', 'BILL-2026-11');
  assert.equal(locked[0].locked, true);
  assert.equal(locked[0].billId, 'BILL-2026-11');
  assert.equal(upsertProrataSheet(locked, sheet({ note: 'edit after lock' })), null);
  assert.equal(lockProrataSheet(locked, 'PS-1', 'BILL-2'), null);
  assert.equal(removeProrataSheet(locked, 'PS-1'), null);
  assert.equal(lockProrataSheet(list, 'PS-1', ''), null);
  assert.equal(lockProrataSheet(list, 'PS-9', 'BILL-1'), null);
});

test('remove frees an unlocked sheet and find/sort work', () => {
  const list = upsertProrataSheet(upsertProrataSheet([], sheet()), sheet({ id: 'PS-2', eventDate: '2026-10-05', billMonth: '2026-10' }));
  assert.equal(removeProrataSheet(list, 'PS-1').length, 1);
  assert.equal(findProrataSheet(list, 'PS-2').billMonth, '2026-10');
  assert.equal(findProrataSheet(list, 'PS-9'), null);
  const sorted = prorataSheetsForCustomer(list, 'C-76');
  assert.equal(sorted[0].id, 'PS-2');
  assert.equal(sorted[1].id, 'PS-1');
  assert.deepEqual(prorataSheetsForCustomer(list, 'C-99'), []);
});

test('sheet check, arithmetic text, and summary', () => {
  const out = normalizeProrataSheet(sheet());
  assert.deepEqual(prorataSheetCheck(out), { expectedCents: 140000, matches: true });
  assert.equal(prorataSheetArithmeticText(out), 'Rs. 2000.00 ÷ 30 days = Rs. 66.67 per day × 21 days = Rs. 1400.00');
  assert.equal(prorataSheetSummaryText([out]), '1 pro-rata sheet · 0 locked · total Rs. 1400.00.');
  const locked = lockProrataSheet([out], 'PS-1', 'BILL-1');
  assert.match(prorataSheetSummaryText(locked), /1 locked/);
});

test('sheet HTML escapes, shows the arithmetic, and flags a mismatch', () => {
  const out = normalizeProrataSheet(sheet({ customerName: '<b>& Co' }));
  const html = prorataSheetHtml(out);
  assert.match(html, /&lt;b&gt;&amp; Co/);
  assert.match(html, /66\.67 per day/);
  assert.doesNotMatch(html, /does not match/);
  const bad = normalizeProrataSheet(sheet({ amountCents: 1 }));
  assert.match(prorataSheetHtml(bad), /does not match/);
  const locked = lockProrataSheet([out], 'PS-1', 'BILL-1');
  assert.match(prorataSheetHtml(locked[0]), /locked/);
  assert.match(prorataSheetHtml(locked[0]), /BILL-1/);
});

test('CSV quoting and filename', () => {
  const out = normalizeProrataSheet(sheet({ note: 'say "hi", please' }));
  const csv = prorataSheetCsv([out]);
  assert.match(csv, /^id,customerId,/);
  assert.match(csv, /"say ""hi"", please"/);
  assert.equal(prorataSheetFilename(), 'prorata-sheets.csv');
});

test('list normalisation dedupes by id and drops half-formed rows', () => {
  const list = normalizeProrataSheetList([sheet(), sheet(), sheet({ id: '' })]);
  assert.equal(list.length, 1);
  assert.deepEqual(normalizeProrataSheetList('nope'), []);
});

test('purity fence: no imports, storage, DOM, or other-module identifiers', () => {
  const src = readFileSync(join(here, '..', 'prorata-sheet.js'), 'utf8');
  assert.doesNotMatch(src, /^\s*import\s/m);
  assert.doesNotMatch(src, /\brequire\s*\(/);
  assert.doesNotMatch(src, /localStorage|document\.|window\./);
  assert.doesNotMatch(src, /package-change-preview|repayment-plan|credit-balance|charge-instalment/);
});
