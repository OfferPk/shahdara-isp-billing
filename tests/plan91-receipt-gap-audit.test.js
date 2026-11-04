/**
 * plan91-receipt-gap-audit.test.js — Plan 91: receipt-number gap audit.
 * Pins:
 * - the sequence view lists every gap in the checked range on the
 *   same fixture, each with exactly one of the three statuses;
 * - a voided number shows its void record, not a blank;
 * - an unexplained gap stays visible until the operator records an
 *   explanation, and explaining it moves it to explained;
 * - auditing never alters any receipt or payment record (inputs are
 *   never mutated, and the module names no store);
 * - issued numbers carry their Plan 5 delivery status only to show
 *   whether the receipt reached the customer; unknown statuses read
 *   as 'not recorded', never invented.
 * Synthetic data only; the audit creates no receipt, deletes none,
 * and never changes a payment.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  receiptNumberFromReference,
  isReceiptGapStatus,
  receiptGapStatusLabel,
  receiptDeliveryStatusLabel,
  normalizeReceiptEntries,
  normalizeVoidEntries,
  normalizeExplanations,
  buildGapAudit,
  filterGaps,
  unexplainedGaps,
  gapSummaryText,
  explainGap,
  removeExplanation,
  gapAuditHtml,
  issuedReceiptsHtml,
  gapAuditCsv,
  gapAuditFilename,
} from '../receipt-gap-audit.js';

// Fixture: issued 101, 102, 104, 107; voided 103; explained 106;
// 105 unexplained. A void record for issued 104 must NOT also be a gap.
const issued = [
  { number: 101, customer: 'Ayesha', date: '2026-01-05', deliveryStatus: 'sent' },
  { number: 102, customer: 'Bilal', date: '2026-01-05', deliveryStatus: 'pending' },
  { number: 104, customer: 'Chanda', date: '2026-01-06', deliveryStatus: 'generated' },
  { number: 107, customer: 'Danish', date: '2026-01-07', deliveryStatus: 'failed' },
];
const voids = [
  { number: 103, reason: 'wrong amount', voidedAt: '2026-01-06' },
  { number: 104, reason: 'duplicate entry', voidedAt: '2026-01-06' },
];
const explanations = [
  { number: 106, note: 'Book page torn out', by: 'Saad' },
];

test('plain-integer references parse; generated REC references never do', () => {
  assert.equal(receiptNumberFromReference('104'), 104);
  assert.equal(receiptNumberFromReference('  107  '), 107);
  assert.equal(receiptNumberFromReference('REC-2601-0001-AB12'), null);
  assert.equal(receiptNumberFromReference(''), null);
  assert.equal(receiptNumberFromReference('12A'), null);
  assert.equal(receiptNumberFromReference('99999999999999999999'), null);
  assert.equal(receiptNumberFromReference(null), null);
});

test('normalisers drop unusable rows, never count a guessed figure', () => {
  assert.deepEqual(normalizeReceiptEntries([
    { number: 101, customer: 'A' },
    { number: 0, customer: 'B' },
    { number: -5, customer: 'C' },
    { number: 10.5, customer: 'D' },
    { customer: 'E' },
    null,
  ]), [{ number: 101, customer: 'A', customerId: '', date: '', deliveryStatus: null }]);
  assert.deepEqual(normalizeVoidEntries([
    { number: 103, reason: 'wrong amount' },
    { number: 104 },
    { reason: 'no number' },
  ]), [{ number: 103, reason: 'wrong amount', date: '' }]);
  assert.deepEqual(normalizeExplanations([
    { number: 106, note: 'torn page' },
    { number: 107, note: '' },
    { number: 108 },
  ]), [{ number: 106, note: 'torn page', by: '' }]);
});

test('gap audit on the fixture: every gap listed with exactly one status', () => {
  const audit = buildGapAudit({ receipts: issued, voids, explanations });
  assert.deepEqual(audit.range, { from: 101, to: 107 });
  assert.deepEqual(audit.gaps.map((gap) => gap.number), [103, 105, 106]);
  assert.deepEqual(audit.gaps.map((gap) => gap.status), ['voided', 'unexplained', 'explained']);
  assert.deepEqual(audit.summary, { issued: 4, voided: 1, explained: 1, unexplained: 1, total: 3 });
});

test('a voided number shows its void record, not a blank', () => {
  const audit = buildGapAudit({ receipts: issued, voids, explanations });
  const voided = audit.gaps.find((gap) => gap.number === 103);
  assert.equal(voided.status, 'voided');
  assert.equal(voided.voidReason, 'wrong amount');
  assert.equal(voided.voidDate, '2026-01-06');
  assert.ok(gapAuditHtml(audit).includes('wrong amount'));
});

test('a number both issued and voided is issued, never also a gap', () => {
  const audit = buildGapAudit({ receipts: issued, voids, explanations });
  assert.ok(audit.issued.some((row) => row.number === 104));
  assert.ok(!audit.gaps.some((gap) => gap.number === 104));
});

test('a void record beats an explanation for the same number', () => {
  const audit = buildGapAudit({
    receipts: [{ number: 101 }, { number: 103 }],
    voids: [{ number: 102, reason: 'voided' }],
    explanations: [{ number: 102, note: 'also noted' }],
  });
  assert.deepEqual(audit.gaps, [{
    number: 102, status: 'voided', voidReason: 'voided', voidDate: '', note: '', by: '',
  }]);
});

test('an unexplained gap stays visible until explained, then moves to explained', () => {
  const before = buildGapAudit({ receipts: issued, voids, explanations });
  assert.ok(unexplainedGaps(before.gaps).some((gap) => gap.number === 105));
  const after = buildGapAudit({
    receipts: issued,
    voids,
    explanations: explainGap(explanations, { number: 105, note: 'Never issued, book skipped', by: 'Owner' }),
  });
  assert.deepEqual(unexplainedGaps(after.gaps).map((gap) => gap.number), []);
  const explained = after.gaps.find((gap) => gap.number === 105);
  assert.equal(explained.status, 'explained');
  assert.equal(explained.note, 'Never issued, book skipped');
});

test('explainGap replaces a note and removeExplanation restores unexplained', () => {
  const replaced = explainGap(explanations, { number: 106, note: 'New note' });
  assert.deepEqual(replaced, [{ number: 106, note: 'New note', by: '' }]);
  const removed = removeExplanation(replaced, 106);
  assert.deepEqual(removed, []);
  const audit = buildGapAudit({ receipts: issued, voids, explanations: removed });
  assert.equal(audit.gaps.find((gap) => gap.number === 106).status, 'unexplained');
  assert.deepEqual(explainGap(explanations, { number: 109, note: '' }), explanations);
  assert.deepEqual(removeExplanation(explanations, 'x'), explanations);
});

test('empty audit: no range, zero summary, plain empty note', () => {
  const audit = buildGapAudit({});
  assert.equal(audit.range, null);
  assert.deepEqual(audit.gaps, []);
  assert.deepEqual(audit.summary, { issued: 0, voided: 0, explained: 0, unexplained: 0, total: 0 });
  assert.equal(gapSummaryText(audit), 'No numbered receipts found — nothing to audit.');
  assert.equal(gapAuditFilename(audit), 'receipt-gap-audit.csv');
});

test('a run with no gaps reports every number accounted for', () => {
  const audit = buildGapAudit({ receipts: [{ number: 5 }, { number: 6 }, { number: 7 }] });
  assert.deepEqual(audit.gaps, []);
  assert.ok(gapAuditHtml(audit).includes('no gaps'));
  assert.equal(gapSummaryText(audit), 'Numbers 5–7: 3 issued, 0 voided, 0 explained, 0 unexplained gaps.');
});

test('summary text and filename carry the exact range', () => {
  const audit = buildGapAudit({ receipts: issued, voids, explanations });
  assert.equal(gapSummaryText(audit), 'Numbers 101–107: 4 issued, 1 voided, 1 explained, 1 unexplained gap.');
  assert.equal(gapAuditFilename(audit), 'receipt-gap-audit-101-107.csv');
});

test('filterGaps by status; unknown filter returns every gap', () => {
  const audit = buildGapAudit({ receipts: issued, voids, explanations });
  assert.deepEqual(filterGaps(audit.gaps, 'voided').map((gap) => gap.number), [103]);
  assert.deepEqual(filterGaps(audit.gaps, 'bogus').map((gap) => gap.number), [103, 105, 106]);
  assert.equal(isReceiptGapStatus('voided'), true);
  assert.equal(isReceiptGapStatus('bogus'), false);
  assert.equal(receiptGapStatusLabel('bogus'), 'Unexplained');
});

test('delivery status: known statuses labelled, unknown reads as not recorded', () => {
  assert.equal(receiptDeliveryStatusLabel('sent'), 'Sent');
  assert.equal(receiptDeliveryStatusLabel('bogus'), 'Not recorded');
  const audit = buildGapAudit({
    receipts: [{ number: 101, customer: 'A', deliveryStatus: 'sent' }, { number: 102, customer: 'B', deliveryStatus: 'bogus' }],
  });
  const html = issuedReceiptsHtml(audit);
  assert.ok(html.includes('Sent'));
  assert.ok(html.includes('Not recorded'));
});

test('auditing never mutates its inputs', () => {
  const receiptsCopy = JSON.parse(JSON.stringify(issued));
  const voidsCopy = JSON.parse(JSON.stringify(voids));
  const explanationsCopy = JSON.parse(JSON.stringify(explanations));
  buildGapAudit({ receipts: issued, voids, explanations });
  assert.deepEqual(issued, receiptsCopy);
  assert.deepEqual(voids, voidsCopy);
  assert.deepEqual(explanations, explanationsCopy);
});

test('HTML escaping and CSV quoting for notes with markup and commas', () => {
  const audit = buildGapAudit({
    receipts: [{ number: 101 }, { number: 103 }],
    explanations: [{ number: 102, note: 'Page <torn>, "damaged"' }],
  });
  assert.ok(!gapAuditHtml(audit).includes('<torn>'));
  assert.ok(gapAuditHtml(audit).includes('&lt;torn&gt;'));
  assert.ok(gapAuditCsv(audit).includes('"Note: Page <torn>, ""damaged"""'));
});

test('purity fence: the module imports nothing and names no store', () => {
  const source = readFileSync(new URL('../receipt-gap-audit.js', import.meta.url), 'utf8');
  assert.ok(!/^import /m.test(source));
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('shahdara_'));
});
