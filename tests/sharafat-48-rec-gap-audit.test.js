/**
 * sharafat-48-rec-gap-audit.test.js — Sharafat 48: the receipt-number
 * gap audit understands stored REC-YYMM-CCCC-XXXX references.
 * Pins:
 * - the doc's REC- sequence does not exist in live data: a REC- tail
 *   is the payment id's last four characters, not a run — so the
 *   audit parses stored REC- refs per (month, customer) run and
 *   never feeds DERIVED refs in (derived tails would invent gaps);
 * - the doc's acceptance run (REC-2611-0012-1001, …-1003) flags
 *   …-1002 as unexplained, and a voided number in the run reads
 *   voided with its reason;
 * - non-numeric tails are real receipts, listed as issued, never
 *   gap-checked; a run with no integer tails audits as issued-only;
 * - REC- gaps are keyed by the full reference and explained /
 *   un-explained by that reference; the old parser still returns
 *   null for REC- refs (Plan 91 pin, restated once for contrast);
 * - plain-integer audits are unchanged by the presence of REC- rows.
 * Synthetic data only; no real customer names, no real phone numbers.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  receiptNumberFromReference,
  parseReceiptReference,
  normalizeRecReceiptEntries,
  normalizeRecVoidEntries,
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

// Doc acceptance run: REC-2611-0012-1001 and …-1003 issued, …-1002 missing.
const recIssued = [
  { ref: 'REC-2611-0012-1001', customer: 'A', date: '2026-11-04' },
  { ref: 'REC-2611-0012-1003', customer: 'A', date: '2026-11-04' },
];

test('parseReceiptReference: a stored REC- ref parses into its run; anything else is null', () => {
  assert.deepEqual(parseReceiptReference('REC-2611-0012-1001'), {
    ref: 'REC-2611-0012-1001',
    runKey: '2611-0012',
    yymm: '2611',
    customer: '0012',
    tail: '1001',
    tailNumber: 1001,
  });
  // A customer number above 9999 prints five digits, not four.
  assert.equal(parseReceiptReference('REC-2611-12345-1001').runKey, '2611-12345');
  assert.equal(parseReceiptReference('REC-2611-12345-1001').customer, '12345');
  // A numeric tail is canonicalised to four digits, so one receipt
  // has one key however the tail was typed.
  assert.equal(parseReceiptReference('REC-2611-0012-7').ref, 'REC-2611-0012-0007');
  assert.equal(parseReceiptReference('REC-2611-0012-7').tailNumber, 7);
  // Lowercase input normalises to the stored form.
  assert.equal(parseReceiptReference('rec-2611-0012-ebb7').ref, 'REC-2611-0012-EBB7');
  // A non-numeric tail parses, but has no integer tail to sequence.
  assert.equal(parseReceiptReference('REC-2611-0012-EBB7').tailNumber, null);
  // A UUID-derived tail of all zeroes is a real tail (0), not "no tail".
  assert.equal(parseReceiptReference('REC-2611-0012-0000').tailNumber, 0);
  assert.equal(parseReceiptReference('104'), null);
  assert.equal(parseReceiptReference('RCPT-12-202611-01'), null);
  assert.equal(parseReceiptReference('REC-2611-0012'), null);
  assert.equal(parseReceiptReference('REC-261-0012-1001'), null);
  assert.equal(parseReceiptReference('REC-2611-0012-10012'), null);
  assert.equal(parseReceiptReference(''), null);
  assert.equal(parseReceiptReference(null), null);
});

test('the old parser still returns null for REC- refs (Plan 91 contract, unchanged)', () => {
  assert.equal(receiptNumberFromReference('REC-2611-0012-1001'), null);
  assert.equal(receiptNumberFromReference('REC-2611-0012-EBB7'), null);
  assert.equal(receiptNumberFromReference('104'), 104);
});

test('doc acceptance: REC-2611-0012-1001 and …-1003 flag …-1002 as unexplained', () => {
  const audit = buildGapAudit({ receipts: recIssued });
  assert.equal(audit.range, null);
  assert.deepEqual(audit.gaps, []);
  assert.equal(audit.runs.length, 1);
  const run = audit.runs[0];
  assert.equal(run.runKey, '2611-0012');
  assert.deepEqual(run.range, { from: 1001, to: 1003 });
  assert.deepEqual(run.gaps.map((gap) => gap.number), ['REC-2611-0012-1002']);
  assert.deepEqual(run.gaps.map((gap) => gap.status), ['unexplained']);
  assert.deepEqual(run.summary, { issued: 2, voided: 0, explained: 0, unexplained: 1, total: 1 });
  assert.equal(gapSummaryText(run), 'REC-2611-0012: tails 1001–1003: 2 issued, 0 voided, 0 explained, 1 unexplained gap.');
  assert.equal(gapAuditFilename(run), 'receipt-gap-audit-2611-0012-1001-1003.csv');
  assert.ok(gapAuditCsv(run).includes('REC-2611-0012-1002,unexplained,Unexplained'));
});

test('a voided number in the REC- run reads voided with its reason', () => {
  const audit = buildGapAudit({
    receipts: recIssued,
    voids: [{ ref: 'REC-2611-0012-1002', reason: 'wrong amount', date: '2026-11-05' }],
  });
  const run = audit.runs[0];
  assert.deepEqual(run.gaps, [{
    number: 'REC-2611-0012-1002',
    ref: 'REC-2611-0012-1002',
    tail: 1002,
    runKey: '2611-0012',
    status: 'voided',
    voidReason: 'wrong amount',
    voidDate: '2026-11-05',
    note: '',
    by: '',
  }]);
  assert.equal(run.summary.voided, 1);
  assert.ok(gapAuditHtml(run).includes('wrong amount'));
});

test('a REC- gap is explained and un-explained by its full reference', () => {
  const before = buildGapAudit({ receipts: recIssued });
  assert.ok(unexplainedGaps(before.runs[0].gaps).some((gap) => gap.number === 'REC-2611-0012-1002'));
  const explained = explainGap([], { ref: 'REC-2611-0012-1002', note: 'Never issued, book skipped', by: 'Owner' });
  assert.deepEqual(explained, [{ ref: 'REC-2611-0012-1002', runKey: '2611-0012', note: 'Never issued, book skipped', by: 'Owner' }]);
  const after = buildGapAudit({ receipts: recIssued, explanations: explained });
  assert.deepEqual(unexplainedGaps(after.runs[0].gaps).map((gap) => gap.number), []);
  const gap = after.runs[0].gaps.find((row) => row.number === 'REC-2611-0012-1002');
  assert.equal(gap.status, 'explained');
  assert.equal(gap.note, 'Never issued, book skipped');
  // A typed tail without zero-padding explains the same gap.
  const typed = explainGap([], { ref: 'rec-2611-0012-1002', note: 'Typed short' });
  assert.deepEqual(typed, [{ ref: 'REC-2611-0012-1002', runKey: '2611-0012', note: 'Typed short', by: '' }]);
  const removed = removeExplanation(explained, 'REC-2611-0012-1002');
  assert.deepEqual(removed, []);
  const reopened = buildGapAudit({ receipts: recIssued, explanations: removed });
  assert.equal(reopened.runs[0].gaps.find((row) => row.number === 'REC-2611-0012-1002').status, 'unexplained');
  assert.deepEqual(removeExplanation(explained, 'REC-2611-0012-9999'), explained);
});

test('non-numeric tails are issued, never gap-checked', () => {
  const audit = buildGapAudit({
    receipts: [
      { ref: 'REC-2611-0012-EBB7', customer: 'A' },
      { ref: 'REC-2611-0012-1001', customer: 'A' },
      { ref: 'REC-2611-0012-1003', customer: 'A' },
    ],
  });
  const run = audit.runs[0];
  assert.deepEqual(run.range, { from: 1001, to: 1003 });
  assert.deepEqual(run.issued.map((row) => row.ref), [
    'REC-2611-0012-1001',
    'REC-2611-0012-1003',
    'REC-2611-0012-EBB7',
  ]);
  // Only the integer middle is a gap; EBB7 is not a hole.
  assert.deepEqual(run.gaps.map((gap) => gap.number), ['REC-2611-0012-1002']);
  assert.equal(run.summary.issued, 3);
});

test('a run with no integer tails audits as issued-only, never gap-filled', () => {
  const audit = buildGapAudit({
    receipts: [
      { ref: 'REC-2611-0012-EBB7', customer: 'A' },
      { ref: 'REC-2611-0012-0F7B', customer: 'A' },
    ],
  });
  const run = audit.runs[0];
  assert.equal(run.range, null);
  assert.deepEqual(run.gaps, []);
  assert.deepEqual(run.summary, { issued: 2, voided: 0, explained: 0, unexplained: 0, total: 0 });
  assert.equal(gapSummaryText(run), 'REC-2611-0012: 2 issued, no numbered run — non-numeric tails only.');
  assert.equal(gapAuditFilename(run), 'receipt-gap-audit-2611-0012.csv');
  assert.ok(gapAuditHtml(run).includes('no numbered run'));
});

test('different runs never mix: same tail in another month or customer is a different run', () => {
  const audit = buildGapAudit({
    receipts: [
      { ref: 'REC-2611-0012-1001' },
      { ref: 'REC-2611-0012-1003' },
      { ref: 'REC-2611-0013-1002' },
      { ref: 'REC-2612-0012-1002' },
    ],
  });
  assert.deepEqual(audit.runs.map((run) => run.runKey), ['2611-0012', '2611-0013', '2612-0012']);
  // The 0012/2611 run still flags only its own missing middle; the
  // other runs hold a single tail each, so they have no gaps.
  assert.deepEqual(audit.runs[0].gaps.map((gap) => gap.number), ['REC-2611-0012-1002']);
  assert.deepEqual(audit.runs[1].gaps, []);
  assert.deepEqual(audit.runs[2].gaps, []);
});

test('a voided number beats an explanation in a REC- run, and issued-and-voided is issued', () => {
  const audit = buildGapAudit({
    receipts: [
      { ref: 'REC-2611-0012-1001' },
      { ref: 'REC-2611-0012-1003' },
      { ref: 'REC-2611-0012-1004' },
    ],
    voids: [
      { ref: 'REC-2611-0012-1002', reason: 'voided', date: '2026-11-05' },
      { ref: 'REC-2611-0012-1004', reason: 'duplicate entry', date: '2026-11-05' },
    ],
    explanations: [{ ref: 'REC-2611-0012-1002', note: 'also noted' }],
  });
  const run = audit.runs[0];
  assert.deepEqual(run.gaps.map((gap) => [gap.number, gap.status]), [
    ['REC-2611-0012-1002', 'voided'],
  ]);
  // 1004 is issued, so its void record is not also a gap.
  assert.ok(run.issued.some((row) => row.ref === 'REC-2611-0012-1004'));
  assert.ok(!run.gaps.some((gap) => gap.number === 'REC-2611-0012-1004'));
});

test('a voided non-numeric tail stays visible with its reason, outside the numbered range', () => {
  const audit = buildGapAudit({
    receipts: [{ ref: 'REC-2611-0012-1001' }, { ref: 'REC-2611-0012-1002' }],
    voids: [{ ref: 'REC-2611-0012-DSET', reason: 'deposit settled', date: '2026-11-06' }],
  });
  const run = audit.runs[0];
  assert.deepEqual(run.gaps, []);
  assert.deepEqual(run.voids.map((row) => row.ref), ['REC-2611-0012-DSET']);
  assert.ok(gapAuditHtml(run).includes('REC-2611-0012-DSET'));
  assert.ok(gapAuditHtml(run).includes('deposit settled'));
});

test('duplicate stored refs count once (first wins), like the plain normalisers', () => {
  const audit = buildGapAudit({
    receipts: [
      { ref: 'REC-2611-0012-1001', customer: 'A' },
      { ref: 'REC-2611-0012-1001', customer: 'B' },
      { ref: 'REC-2611-0012-1003', customer: 'A' },
    ],
  });
  const run = audit.runs[0];
  assert.equal(run.summary.issued, 2);
  assert.equal(run.issued.find((row) => row.ref === 'REC-2611-0012-1001').customer, 'A');
  assert.deepEqual(normalizeRecReceiptEntries([
    { ref: 'REC-2611-0012-1001' },
    { ref: 'REC-2611-0012-1001' },
  ]).length, 1);
  assert.deepEqual(normalizeRecVoidEntries([
    { ref: 'REC-2611-0012-1002', reason: 'first' },
    { ref: 'REC-2611-0012-1002', reason: 'second' },
  ]).map((row) => row.reason), ['first']);
});

test('plain-integer audits are unchanged by REC- rows in the same call', () => {
  // An explanation alone never extends the range: 104 is explained
  // only because 105 is issued. (Plan 91 fixture rule, restated.)
  const audit = buildGapAudit({
    receipts: [{ number: 101 }, { number: 103 }, { number: 105 }, ...recIssued],
    voids: [{ number: 102, reason: 'wrong amount', date: '2026-01-06' }],
    explanations: [{ number: 104, note: 'Book page torn out', by: 'Saad' }],
  });
  assert.deepEqual(audit.range, { from: 101, to: 105 });
  assert.deepEqual(audit.gaps.map((gap) => gap.number), [102, 104]);
  assert.deepEqual(audit.gaps.map((gap) => gap.status), ['voided', 'explained']);
  assert.deepEqual(audit.summary, { issued: 3, voided: 1, explained: 1, unexplained: 0, total: 2 });
  assert.equal(gapSummaryText(audit), 'Numbers 101–105: 3 issued, 1 voided, 1 explained, 0 unexplained gaps.');
  assert.equal(gapAuditFilename(audit), 'receipt-gap-audit-101-105.csv');
  assert.equal(audit.runs.length, 1);
  assert.equal(audit.runs[0].runKey, '2611-0012');
});

test('empty audit still has no range — with or without a REC- run elsewhere', () => {
  const audit = buildGapAudit({});
  assert.equal(audit.range, null);
  assert.deepEqual(audit.gaps, []);
  assert.deepEqual(audit.runs, []);
  assert.deepEqual(audit.summary, { issued: 0, voided: 0, explained: 0, unexplained: 0, total: 0 });
  assert.equal(gapSummaryText(audit), 'No numbered receipts found — nothing to audit.');
  assert.equal(gapAuditFilename(audit), 'receipt-gap-audit.csv');
});

test('explanations normalise identically for plain rows, and sort plain before REC-', () => {
  assert.deepEqual(normalizeExplanations([{ number: 106, note: 'Book page torn out', by: 'Saad' }]), [
    { number: 106, note: 'Book page torn out', by: 'Saad' },
  ]);
  assert.deepEqual(normalizeExplanations([
    { ref: 'REC-2611-0012-1002', note: 'rec note' },
    { number: 105, note: 'plain note' },
    { number: 103, note: 'earlier plain' },
  ]).map((row) => row.number ?? row.ref), [103, 105, 'REC-2611-0012-1002']);
  // A note without a number or a reference is still dropped.
  assert.deepEqual(normalizeExplanations([{ note: 'no key' }]), []);
  assert.deepEqual(normalizeExplanations([{ ref: 'REC-2611-0012-1002' }]), []);
});

test('a run with no gaps reports every number accounted for, in HTML and issued tables', () => {
  const audit = buildGapAudit({
    receipts: [
      { ref: 'REC-2611-0012-1001', customer: 'A', date: '2026-11-04', deliveryStatus: 'sent' },
      { ref: 'REC-2611-0012-1002', customer: 'A', date: '2026-11-04', deliveryStatus: 'bogus' },
    ],
  });
  const run = audit.runs[0];
  assert.deepEqual(run.gaps, []);
  assert.ok(gapAuditHtml(run).includes('no gaps'));
  assert.ok(gapAuditHtml(run).includes('REC-2611-0012: tails 1001–1002'));
  const html = issuedReceiptsHtml(run);
  assert.ok(html.includes('REC-2611-0012-1001'));
  assert.ok(html.includes('Sent'));
  assert.ok(html.includes('Not recorded'));
});

test('filtering a REC- run by status keeps only that status', () => {
  // 1002 is voided; 1003 is explained; nothing is unexplained.
  const audit2 = buildGapAudit({
    receipts: [{ ref: 'REC-2611-0012-1001' }, { ref: 'REC-2611-0012-1004' }],
    voids: [{ ref: 'REC-2611-0012-1002', reason: 'voided', date: '2026-11-05' }],
    explanations: [{ ref: 'REC-2611-0012-1003', note: 'never issued' }],
  });
  assert.deepEqual(filterGaps(audit2.runs[0].gaps, 'voided').map((gap) => gap.number), ['REC-2611-0012-1002']);
  assert.deepEqual(filterGaps(audit2.runs[0].gaps, 'explained').map((gap) => gap.number), ['REC-2611-0012-1003']);
  assert.deepEqual(unexplainedGaps(audit2.runs[0].gaps).map((gap) => gap.number), []);
  assert.deepEqual(filterGaps(audit2.runs[0].gaps, 'bogus').map((gap) => gap.number), [
    'REC-2611-0012-1002',
    'REC-2611-0012-1003',
  ]);
});

test('auditing never mutates its inputs, including REC- rows', () => {
  const receiptsCopy = JSON.parse(JSON.stringify(recIssued));
  const voidsCopy = [{ ref: 'REC-2611-0012-1002', reason: 'voided' }];
  const voidsBefore = JSON.parse(JSON.stringify(voidsCopy));
  const explanations = [{ ref: 'REC-2611-0012-1002', note: 'noted' }];
  const explanationsCopy = JSON.parse(JSON.stringify(explanations));
  buildGapAudit({ receipts: recIssued, voids: voidsCopy, explanations });
  assert.deepEqual(recIssued, receiptsCopy);
  assert.deepEqual(voidsCopy, voidsBefore);
  assert.deepEqual(explanations, explanationsCopy);
});
