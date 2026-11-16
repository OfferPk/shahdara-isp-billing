// Sharafat 74 — Collection-promise text prints raw "Rs 1000".
//
// The module used to interpolate raw numbers ("Rs 10000", ungrouped,
// wrong prefix) in its text, HTML and CSV surfaces. Amounts now print
// through the shared formatPKR formatter from core.js ("PKR 10,000").
// Tests on synthetic data only: the established generic placeholders
// (Ahmed/Bilal/Saad) — no real customer names, no phone numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  collectionPromiseStatus,
  collectionPromiseSummaryText,
  collectionPromiseText,
  collectionPromiseHtml,
  collectionPromiseCsv,
} from '../collection-promise.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'collection-promise.js'), 'utf8');

const big = { id: 'CP-21', customer: 'Ahmed', amountPromised: 10000, promisedDate: '2026-11-06', paidDate: '2026-11-06', amountPaid: 10000, collector: 'Saad' };
const short = { id: 'CP-10', customer: 'Ahmed', amountPromised: 3000, promisedDate: '2026-11-03', paidDate: '2026-11-03', amountPaid: 100, collector: 'Saad' };
const onePaisa = { id: 'CP-22', customer: 'Ahmed', amountPromised: 3000, promisedDate: '2026-11-03', paidDate: '2026-11-03', amountPaid: 2999.99, collector: 'Saad' };
const overpaid = { id: 'CP-15', customer: 'Bilal', amountPromised: 3000, promisedDate: '2026-11-03', paidDate: '2026-11-03', amountPaid: 3500, collector: 'Saad' };
const amountUnknown = { id: 'CP-14', customer: 'Bilal', amountPromised: 3000, promisedDate: '2026-11-03', paidDate: '2026-11-03', collector: 'Saad' };
const unpaid = { id: 'CP-16', customer: 'Bilal', amountPromised: 3000, promisedDate: '2026-11-03', collector: 'Saad' };
const zeroPaid = { id: 'CP-23', customer: 'Bilal', amountPromised: 3000, promisedDate: '2026-11-03', paidDate: '2026-11-03', amountPaid: 0, collector: 'Saad' };
const almostFull = { id: 'CP-24', customer: 'Ahmed', amountPromised: 3000, promisedDate: '2026-11-03', paidDate: '2026-11-03', amountPaid: 2999.995, collector: 'Saad' };

test('text: a promised 10000 reads "PKR 10,000"', () => {
  assert.match(collectionPromiseText(big, '2026-11-07'), /PKR 10,000 promised by 2026-11-06/);
  assert.doesNotMatch(collectionPromiseText(big, '2026-11-07'), /Rs 10000/);
});

test('text: a paid 10000 reads "(PKR 10,000)"', () => {
  assert.match(collectionPromiseText(big, '2026-11-07'), /\(PKR 10,000\)/);
});

test('text: the shortfall formats all three figures', () => {
  assert.match(
    collectionPromiseText(short, '2026-11-05'),
    /\(paid PKR 100 of PKR 3,000 \(short by PKR 2,900\)\)/,
  );
});

test('text: a 1-paisa shortfall reads "PKR 0.01", never a float tail', () => {
  // Sharafat 74 R4: 3000 - 2999.99 is 0.010000000000218279 in floating
  // point and used to print verbatim; formatPKR rounds the DISPLAY
  // to "PKR 0.01". The status comparison stays unrounded (see below).
  assert.match(collectionPromiseText(onePaisa, '2026-11-05'), /short by PKR 0\.01/);
  assert.doesNotMatch(collectionPromiseText(onePaisa, '2026-11-05'), /0\.010000000000218279/);
});

test('text: an overpaid amount reads "PKR 3,500"', () => {
  assert.match(collectionPromiseText(overpaid, '2026-11-05'), /\(PKR 3,500\)/);
});

test('text: a null amount still reads "amount not recorded", never "Not set"', () => {
  // Sharafat 74 D4: null means "no amount recorded", not "not set" —
  // formatPKR(null) is 'Not set' and must never reach this branch.
  const text = collectionPromiseText(amountUnknown, '2026-11-05');
  assert.match(text, /amount not recorded/);
  assert.doesNotMatch(text, /Not set/);
  assert.doesNotMatch(text, /PKR 0/);
});

test('text: no raw "Rs <number>" appears in any text output', () => {
  for (const record of [big, short, onePaisa, overpaid, amountUnknown, unpaid, zeroPaid]) {
    assert.doesNotMatch(collectionPromiseText(record, '2026-11-07'), /Rs \d/);
  }
});

test('text: a legacy zero paid amount reads "PKR 0"', () => {
  // Sharafat 74 R6: zero is a real amount (legacy, via cleanPaidAmount),
  // null is the missing one — formatPKR(0) is 'PKR 0', not 'Not set'.
  assert.match(collectionPromiseText(zeroPaid, '2026-11-05'), /paid PKR 0 of PKR 3,000 \(short by PKR 3,000\)/);
});

test('html: the same figures as the text twin', () => {
  const html = collectionPromiseHtml(short, '2026-11-05');
  assert.match(html, /promised PKR 3,000 by/);
  assert.match(html, /\(paid PKR 100 of PKR 3,000 \(short by PKR 2,900\)\)/);
  assert.match(collectionPromiseHtml(big, '2026-11-07'), /promised PKR 10,000 by/);
  assert.match(collectionPromiseHtml(big, '2026-11-07'), /\(PKR 10,000\)/);
  assert.match(collectionPromiseHtml(onePaisa, '2026-11-05'), /short by PKR 0\.01/);
});

test('html: a null amount still reads "amount not recorded"', () => {
  const html = collectionPromiseHtml(amountUnknown, '2026-11-05');
  assert.match(html, /amount not recorded/);
  assert.doesNotMatch(html, /Not set/);
});

test('html: escaping still holds', () => {
  const html = collectionPromiseHtml({ ...big, customer: '<b>Ahmed</b>' }, '2026-11-07');
  assert.match(html, /&lt;b&gt;Ahmed&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>Ahmed<\/b>/);
});

test('html: no raw "Rs <number>" appears in any html output', () => {
  for (const record of [big, short, onePaisa, overpaid, amountUnknown, unpaid, zeroPaid]) {
    assert.doesNotMatch(collectionPromiseHtml(record, '2026-11-07'), /Rs \d/);
  }
});

test('csv: the amount columns read "PKR 10,000" and "PKR 100" as single cells', () => {
  const csv = collectionPromiseCsv([big, short], '2026-11-07');
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,customer,amount_promised,promised_date,paid_date,amount_paid,collector,status');
  assert.match(lines[1], /CP-10,Ahmed,"PKR 3,000",2026-11-03,2026-11-03,PKR 100,Saad,partial/);
  assert.match(lines[2], /CP-21,Ahmed,"PKR 10,000",2026-11-06,2026-11-06,"PKR 10,000",Saad,paid/);
  // csvCell quotes only on a comma (or quote/newline), so "PKR 3,000"
  // and "PKR 10,000" are quoted cells while "PKR 100" is bare. The
  // naive split counts one extra part per comma'd figure (lines[1]
  // has one, lines[2] has two) on top of the 8 fields.
  assert.equal(lines[1].split(',').length, 9);
  assert.equal(lines[2].split(',').length, 10);
});

test('csv: a null amount_paid stays empty, and the status column stays raw', () => {
  const csv = collectionPromiseCsv([amountUnknown], '2026-11-07');
  const lines = csv.split('\n');
  assert.match(lines[1], /CP-14,Bilal,"PKR 3,000",2026-11-03,2026-11-03,,Saad,partial/);
  assert.doesNotMatch(lines[1], /Not set/);
});

test('guards: formatPKR is imported from core.js, never owner-khata.js', () => {
  // Sharafat 74 R2: owner-khata.js exports a DIFFERENT formatPKR
  // ("Rs. " prefix, rounds to whole rupees, null -> 'Rs. 0') — an
  // import from there would silently lose paisa.
  assert.ok(moduleSrc.includes("from './core.js'"));
  assert.doesNotMatch(moduleSrc, /from '\.\/owner-khata\.js'/);
});

test('guards: the purity fence still holds — no storage, clock, or network', () => {
  assert.doesNotMatch(moduleSrc, /localStorage|fetch\(|Date\.now|new Date\(/);
});

test('guards: display rounding never rounds the status', () => {
  // Sharafat 74 R5: 2999.995 displays as "PKR 3,000.00" (rounded for
  // display only) while the status stays partial — the comparison is
  // a direct Number comparison, never the formatted string.
  assert.equal(collectionPromiseStatus(almostFull, '2026-11-05'), 'partial');
  assert.match(collectionPromiseText(almostFull, '2026-11-05'), /PKR 3,000\.00/);
  assert.equal(collectionPromiseStatus(onePaisa, '2026-11-05'), 'partial');
  assert.equal(collectionPromiseStatus(overpaid, '2026-11-05'), 'paid');
});

test('guards: summary and counts text is unchanged by the formatting', () => {
  assert.equal(
    collectionPromiseSummaryText([short, big, unpaid], '2026-11-07'),
    '3 collection promise(s): 1 kept, 0 kept late, 1 partial, 1 unkept, 0 still open.',
  );
});
