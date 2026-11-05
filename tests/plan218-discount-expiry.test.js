import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validDiscountExpiryDate,
  normalizeDiscountExpiry,
  normalizeDiscountExpiryList,
  findDiscountExpiry,
  recordDiscountExpiry,
  removeDiscountExpiry,
  discountExpiriesSorted,
  discountExpiriesWithinWindow,
  discountExpiriesForAffected,
  discountExpiryText,
  discountExpiryHtml,
  discountExpiryAllHtml,
  discountExpiryCsv,
  discountExpiryFilename,
} from '../discount-expiry.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'discount-expiry.js'), 'utf8');

const early = { id: 'DE-1', discountRef: 'PROMO-EID', expiryDate: '2026-11-20', affected: 'Ahmed', lastDiscountedBill: 'Oct 2026 bill', noticeDraft: 'Your discount ends 20 Nov.' };
const mid = { id: 'DE-2', discountRef: 'PROMO-WINTER', expiryDate: '2026-12-01', affected: 'Mohalla Bani', lastDiscountedBill: 'Nov 2026 bill', noticeDraft: '' };
const late = { id: 'DE-3', discountRef: 'PROMO-EID', expiryDate: '2027-01-05', affected: 'Bilal', lastDiscountedBill: 'Dec 2026 bill', noticeDraft: 'Last discounted bill was December.' };

test('half-formed expiry notes are refused', () => {
  assert.equal(normalizeDiscountExpiry({ id: 'DE-9', expiryDate: '2026-11-20', affected: 'Ahmed', lastDiscountedBill: 'Oct 2026 bill' }), null);
  assert.equal(normalizeDiscountExpiry({ id: 'DE-9', discountRef: 'PROMO', affected: 'Ahmed', lastDiscountedBill: 'Oct 2026 bill' }), null);
  assert.equal(normalizeDiscountExpiry({ id: '', discountRef: 'PROMO', expiryDate: '2026-11-20', affected: 'Ahmed', lastDiscountedBill: 'Oct 2026 bill' }), null);
  assert.equal(normalizeDiscountExpiry({ id: 'DE-9', discountRef: 'PROMO', expiryDate: '2026-11-20', lastDiscountedBill: 'Oct 2026 bill' }), null);
  assert.equal(normalizeDiscountExpiry({ id: 'DE-9', discountRef: 'PROMO', expiryDate: '2026-11-20', affected: 'Ahmed' }), null);
  assert.equal(normalizeDiscountExpiry(null), null);
});

test('strict dates are enforced, including February', () => {
  assert.equal(validDiscountExpiryDate('2026-02-29'), false);
  assert.equal(validDiscountExpiryDate('2024-02-29'), true);
  assert.equal(validDiscountExpiryDate('2026-13-01'), false);
  assert.equal(validDiscountExpiryDate('2026-02-30'), false);
  assert.equal(validDiscountExpiryDate('2026-11-20'), true);
});

test('unknown fields are dropped on normalisation', () => {
  const clean = normalizeDiscountExpiry({ ...early, billAmount: 500, offerEnded: true });
  assert.deepEqual(clean, { ...early });
});

test('duplicate ids are never rewritten', () => {
  const list = recordDiscountExpiry([early], { ...early, expiryDate: '2027-06-01' });
  assert.deepEqual(list, [early]);
});

test('no edit path exists and inputs are never mutated', () => {
  assert.equal(moduleSrc.includes('editDiscountExpiry'), false);
  const frozen = Object.freeze({ ...early });
  const list = recordDiscountExpiry([], frozen);
  assert.deepEqual(list, [early]);
  assert.equal(frozen.expiryDate, '2026-11-20');
});

test('expiry list is ordered by date, then discount, then id', () => {
  assert.deepEqual(discountExpiriesSorted([late, early, mid]).map((note) => note.id), ['DE-1', 'DE-2', 'DE-3']);
  const sameDay = { id: 'DE-0', discountRef: 'PROMO-AAA', expiryDate: '2026-11-20', affected: 'Zaid', lastDiscountedBill: 'Oct 2026 bill', noticeDraft: '' };
  assert.deepEqual(discountExpiriesSorted([early, sameDay]).map((note) => note.id), ['DE-0', 'DE-1']);
});

test('window filter is inclusive at both ends', () => {
  const shown = discountExpiriesWithinWindow([late, early, mid], '2026-11-20', '2026-12-01');
  assert.deepEqual(shown.map((note) => note.id), ['DE-1', 'DE-2']);
});

test('a bad window shows nothing, never a guessed list', () => {
  assert.deepEqual(discountExpiriesWithinWindow([early], '2026-12-01', '2026-11-20'), []);
  assert.deepEqual(discountExpiriesWithinWindow([early], 'not-a-date', '2026-12-01'), []);
  assert.deepEqual(discountExpiriesWithinWindow([early], '2026-11-01', ''), []);
});

test('notes filter by affected customer or mohalla, case-insensitively', () => {
  assert.deepEqual(discountExpiriesForAffected([late, early, mid], 'bani').map((note) => note.id), ['DE-2']);
  assert.deepEqual(discountExpiriesForAffected([late, early, mid], 'AHMED').map((note) => note.id), ['DE-1']);
  assert.deepEqual(discountExpiriesForAffected([early], ''), []);
});

test('find and remove work by id', () => {
  assert.deepEqual(findDiscountExpiry([early, mid], 'DE-2'), mid);
  assert.equal(findDiscountExpiry([early], 'DE-9'), null);
  assert.deepEqual(removeDiscountExpiry([early, mid], 'DE-1'), [mid]);
  assert.deepEqual(removeDiscountExpiry([early], 'DE-9'), [early]);
});

test('note text names the discount and its last discounted bill', () => {
  const text = discountExpiryText(early);
  assert.ok(text.includes('PROMO-EID'));
  assert.ok(text.includes('2026-11-20'));
  assert.ok(text.includes('Oct 2026 bill'));
  assert.ok(text.includes('Your discount ends 20 Nov.'));
  assert.equal(discountExpiryText(null), 'No discount expiry note.');
  assert.ok(discountExpiryText(mid).includes('No notice draft yet.'));
});

test('HTML escapes markup in every field', () => {
  const nasty = { ...early, discountRef: '<b>PROMO</b>', affected: 'A & B' };
  const html = discountExpiryHtml(nasty);
  assert.equal(html.includes('<b>'), false);
  assert.ok(html.includes('&lt;b&gt;PROMO&lt;/b&gt;'));
  assert.ok(html.includes('A &amp; B'));
  assert.equal(discountExpiryHtml(null), '<p>No discount expiry note.</p>');
  assert.ok(discountExpiryAllHtml([]).includes('No discount expiry notes yet.'));
  const table = discountExpiryAllHtml([mid, early]);
  assert.ok(table.indexOf('PROMO-EID') < table.indexOf('PROMO-WINTER'));
});

test('CSV export quotes commas and names the file', () => {
  const csv = discountExpiryCsv([{ ...early, affected: 'Ahmed, Mohalla Bani' }]);
  assert.ok(csv.startsWith('Discount,Expiry date,Affected,Last discounted bill,Notice draft'));
  assert.ok(csv.includes('"Ahmed, Mohalla Bani"'));
  assert.equal(discountExpiryFilename(), 'discount-expiry.csv');
});

test('list normalisation drops half-formed notes and later duplicates', () => {
  const list = normalizeDiscountExpiryList([early, { id: 'DE-9' }, early, mid]);
  assert.deepEqual(list.map((note) => note.id), ['DE-1', 'DE-2']);
  assert.deepEqual(normalizeDiscountExpiryList('not-a-list'), []);
});

test('module stays pure: no Date, storage, or network use', () => {
  assert.equal(/\bnew Date\b/.test(moduleSrc), false);
  assert.equal(moduleSrc.includes('localStorage'), false);
  assert.equal(moduleSrc.includes('fetch('), false);
  assert.equal(moduleSrc.includes('promo-offers'), false);
});

test('panel element ids are present in index.html', () => {
  for (const id of ['deDiscountRef', 'deExpiryDate', 'deAffected', 'deLastBill', 'deNoticeDraft', 'deSaveBtn', 'deRemoveId', 'deRemoveBtn', 'deWindowFrom', 'deWindowTo', 'deBody', 'deSummary', 'deExportBtn']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing ${id}`);
  }
});

test('app.js wires the discount expiry panel', () => {
  assert.ok(appJs.includes("from './discount-expiry.js'"));
  assert.ok(appJs.includes('renderDiscountExpiries()'));
  assert.ok(appJs.includes('shahdara_discount_expiry_v1'));
});

test('deployment guard: no standalone OLT word in app.js', () => {
  assert.equal(/\bOLT\b/.test(appJs), false);
});

test('module never changes a bill, payment, or offer by itself', () => {
  assert.equal(moduleSrc.includes('promo-offers'), false);
  assert.equal(/billAmount|paymentId|offerEnded/.test(moduleSrc), false);
});
