// Sharafat 65 — a partial payment counts as a "kept" promise no more.
//
// A 100-of-3000 payment used to read as 'paid' in status, counts and
// summary; a full LATE payment read identically to a full on-time one.
// Now: short → 'partial' (with its shortfall named), full-late →
// 'paidLate' (its own bucket), and a paid date with no recorded amount
// is 'partial' too — never kept without evidence of the amount.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  collectionPromiseStatus,
  collectionPromiseCountsForCustomer,
  collectionPromiseText,
  collectionPromiseSummaryText,
  collectionPromiseHtml,
  collectionPromiseCsv,
  recordCollectionPromisePayment,
} from '../collection-promise.js';

const short = { id: 'CP-10', customer: 'Ahmed', amountPromised: 3000, promisedDate: '2026-11-03', paidDate: '2026-11-03', amountPaid: 100, collector: 'Saad' };
const fullOnTime = { id: 'CP-11', customer: 'Ahmed', amountPromised: 3000, promisedDate: '2026-11-03', paidDate: '2026-11-03', amountPaid: 3000, collector: 'Saad' };
const fullLate = { id: 'CP-12', customer: 'Ahmed', amountPromised: 3000, promisedDate: '2026-11-03', paidDate: '2026-11-05', amountPaid: 3000, collector: 'Saad' };
const shortLate = { id: 'CP-13', customer: 'Bilal', amountPromised: 3000, promisedDate: '2026-11-03', paidDate: '2026-11-05', amountPaid: 100, collector: 'Saad' };
const amountUnknown = { id: 'CP-14', customer: 'Bilal', amountPromised: 3000, promisedDate: '2026-11-03', paidDate: '2026-11-03', collector: 'Saad' };
const overpaid = { id: 'CP-15', customer: 'Bilal', amountPromised: 3000, promisedDate: '2026-11-03', paidDate: '2026-11-03', amountPaid: 3500, collector: 'Saad' };
const unpaid = { id: 'CP-16', customer: 'Bilal', amountPromised: 3000, promisedDate: '2026-11-03', collector: 'Saad' };

test('a short payment is partial, never kept', () => {
  assert.equal(collectionPromiseStatus(short, '2026-11-05'), 'partial');
  assert.equal(collectionPromiseStatus(fullOnTime, '2026-11-05'), 'paid');
});

test('a full payment paid late is paidLate, its own bucket', () => {
  assert.equal(collectionPromiseStatus(fullLate, '2026-11-05'), 'paidLate');
  assert.notEqual(collectionPromiseStatus(fullLate, '2026-11-05'), 'paid');
});

test('a short payment paid late is still partial, whatever the date', () => {
  assert.equal(collectionPromiseStatus(shortLate, '2026-11-05'), 'partial');
});

test('a paid date with no recorded amount is partial, not kept', () => {
  assert.equal(collectionPromiseStatus(amountUnknown, '2026-11-05'), 'partial');
});

test('an overpayment stays kept, and the exact boundary is kept', () => {
  assert.equal(collectionPromiseStatus(overpaid, '2026-11-05'), 'paid');
  assert.equal(collectionPromiseStatus({ ...fullOnTime, amountPaid: 3000 }, '2026-11-05'), 'paid');
});

test('a 1-paisa shortfall is still partial — no rounding forgives it', () => {
  assert.equal(collectionPromiseStatus({ ...short, amountPaid: 2999.99 }, '2026-11-05'), 'partial');
  assert.equal(collectionPromiseStatus({ ...short, amountPaid: 3000.01 }, '2026-11-05'), 'paid');
});

test('an unpaid promise past its date is still unkept', () => {
  assert.equal(collectionPromiseStatus(unpaid, '2026-11-05'), 'unkept');
  assert.equal(collectionPromiseStatus(unpaid, '2026-11-03'), 'open');
});

test('counts put short and late payments in their own buckets', () => {
  const list = [short, fullOnTime, fullLate, shortLate, amountUnknown, overpaid, unpaid];
  assert.deepEqual(collectionPromiseCountsForCustomer(list, 'Ahmed', '2026-11-07'), { kept: 1, keptLate: 1, partial: 1, unkept: 0, open: 0, total: 3 });
  assert.deepEqual(collectionPromiseCountsForCustomer(list, 'Bilal', '2026-11-07'), { kept: 1, keptLate: 0, partial: 2, unkept: 1, open: 0, total: 4 });
});

test('text names the shortfall: paid PKR 100 of PKR 3,000 (short by PKR 2,900)', () => {
  // Sharafat 74: the shortfall line now formats all three figures
  // through the shared formatPKR — the old pin asserted the raw
  // "paid Rs 100 of Rs 3000 (short by Rs 2900)".
  assert.match(collectionPromiseText(short, '2026-11-05'), /paid PKR 100 of PKR 3,000 \(short by PKR 2,900\)/);
  assert.doesNotMatch(collectionPromiseText(fullOnTime, '2026-11-05'), /short by/);
});

test('text for a paid date with no amount keeps "amount not recorded" and never prints NaN', () => {
  const text = collectionPromiseText(amountUnknown, '2026-11-05');
  assert.match(text, /amount not recorded/);
  assert.doesNotMatch(text, /short by/);
  assert.doesNotMatch(text, /NaN/);
});

test('text notes lateness for a short payment paid late', () => {
  // Sharafat 74: "short by PKR 2,900" — same formatter as the text twin.
  assert.match(collectionPromiseText(shortLate, '2026-11-05'), /short by PKR 2,900/);
  assert.match(collectionPromiseText(shortLate, '2026-11-05'), /paid late/);
  assert.match(collectionPromiseText(fullLate, '2026-11-05'), /paid late/);
});

test('html twin shows the same shortfall and status as the text twin', () => {
  const html = collectionPromiseHtml(short, '2026-11-05');
  assert.match(html, /status: partial/);
  assert.match(html, /paid PKR 100 of PKR 3,000 \(short by PKR 2,900\)/);
  assert.match(collectionPromiseHtml(fullLate, '2026-11-05'), /status: paidLate/);
  assert.match(collectionPromiseHtml(fullLate, '2026-11-05'), /paid late/);
  assert.match(collectionPromiseHtml(amountUnknown, '2026-11-05'), /status: partial/);
  assert.match(collectionPromiseHtml(amountUnknown, '2026-11-05'), /amount not recorded/);
  assert.doesNotMatch(collectionPromiseHtml(amountUnknown, '2026-11-05'), /short by/);
});

test('summary text counts the partial and kept-late buckets', () => {
  assert.equal(
    collectionPromiseSummaryText([short, fullOnTime, fullLate, unpaid], '2026-11-07'),
    '4 collection promise(s): 1 kept, 1 kept late, 1 partial, 1 unkept, 0 still open.'
  );
});

test('csv follows the new status', () => {
  const csv = collectionPromiseCsv([short, fullOnTime, fullLate], '2026-11-07');
  const lines = csv.split('\n');
  assert.match(lines[1], /CP-10,Ahmed,"PKR 3,000",2026-11-03,2026-11-03,PKR 100,Saad,partial/);
  assert.match(lines[2], /CP-11,Ahmed,"PKR 3,000",2026-11-03,2026-11-03,"PKR 3,000",Saad,paid/);
  assert.match(lines[3], /CP-12,Ahmed,"PKR 3,000",2026-11-03,2026-11-05,"PKR 3,000",Saad,paidLate/);
  // Sharafat 74: the CSV amount columns now read "PKR 3,000" / "PKR 100"
  // through the shared formatter — the old pins asserted the raw
  // numbers 3000/100. The status column stays raw by design.
});

test('a short payment cannot be topped up — recording a second payment is refused', () => {
  // Sharafat 65 R9: recordCollectionPromisePayment refuses an
  // already-paid promise, so the remaining PKR 2,900 cannot be added to
  // the SAME promise via the form. Topping up is its own item.
  const after = recordCollectionPromisePayment([short], 'CP-10', '2026-11-06', 2900);
  assert.deepEqual(after, [short]);
});
