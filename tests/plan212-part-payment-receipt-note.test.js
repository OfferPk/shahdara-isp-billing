import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validReceiptNoteDate,
  normalizeReceiptNoteBill,
  normalizePartPaymentReceiptNote,
  normalizePartPaymentReceiptNoteList,
  recordPartPaymentReceiptNote,
  removePartPaymentReceiptNote,
  findPartPaymentReceiptNote,
  receiptNotesForCustomer,
  receiptNotesForReceipt,
  receiptNotesSorted,
  receiptNoteTotalPaidCents,
  receiptNoteTotalRemainingCents,
  receiptNoteText,
  receiptNoteSummaryText,
  receiptNoteHtml,
  receiptNoteAllHtml,
  receiptNoteCsv,
  receiptNoteFilename,
  receiptsMissingReceiptNotes,
  reconcileReceiptNote,
} from '../part-payment-receipt-note.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'part-payment-receipt-note.js'), 'utf8');

const billA = { billRef: 'B-1', month: '2026-10', dueCents: 100000, paidCents: 60000 };
const billB = { billRef: 'B-2', month: '2026-11', dueCents: 50000, paidCents: 50000 };
const noteA = { id: 'PPN-1', receiptNo: 'R-101', customer: 'Ahmed', date: '2026-11-05', bills: [billA, billB] };
const noteB = { id: 'PPN-2', receiptNo: 'R-102', customer: 'Ahmed', date: '2026-11-04', bills: [{ billRef: 'B-3', month: '2026-11', dueCents: 80000, paidCents: 30000 }] };

test('half-formed notes are refused', () => {
  assert.equal(normalizePartPaymentReceiptNote(null), null);
  assert.equal(normalizePartPaymentReceiptNote({}), null);
  assert.equal(normalizePartPaymentReceiptNote({ ...noteA, id: '  ' }), null);
  assert.equal(normalizePartPaymentReceiptNote({ ...noteA, receiptNo: '' }), null);
  assert.equal(normalizePartPaymentReceiptNote({ ...noteA, customer: '' }), null);
  assert.equal(normalizePartPaymentReceiptNote({ ...noteA, date: '2026-11-5' }), null);
  assert.equal(normalizePartPaymentReceiptNote({ ...noteA, bills: [] }), null);
  assert.equal(normalizePartPaymentReceiptNote({ ...noteA, bills: [{ billRef: 'B-1' }] }), null);
  assert.equal(normalizePartPaymentReceiptNote({ ...noteA, bills: [{ billRef: '', dueCents: 100, paidCents: 50 }] }), null);
  assert.equal(normalizePartPaymentReceiptNote({ ...noteA, unallocatedCents: -1 }), null);
});

test('strict dates: real calendar only', () => {
  assert.equal(validReceiptNoteDate('2026-11-05'), true);
  assert.equal(validReceiptNoteDate('2026-02-29'), false);
  assert.equal(validReceiptNoteDate('2024-02-29'), true);
  assert.equal(validReceiptNoteDate('2026-04-31'), false);
  assert.equal(validReceiptNoteDate('2026-13-01'), false);
  assert.equal(validReceiptNoteDate('2026-11-5'), false);
  assert.equal(validReceiptNoteDate(''), false);
  assert.equal(normalizePartPaymentReceiptNote({ ...noteA, date: '2026-02-30' }), null);
});

test('paid beyond due is refused, and a malformed bill line refuses the whole note', () => {
  assert.equal(normalizeReceiptNoteBill({ billRef: 'B-1', dueCents: 100, paidCents: 101 }), null);
  assert.equal(normalizePartPaymentReceiptNote({ ...noteA, bills: [billA, { billRef: 'B-2', dueCents: 100, paidCents: 101 }] }), null);
  assert.equal(normalizePartPaymentReceiptNote({ ...noteA, bills: [billA, { billRef: 'B-2', dueCents: -5, paidCents: 0 }] }), null);
});

test('duplicate bill reference in one note is refused', () => {
  assert.equal(normalizePartPaymentReceiptNote({ ...noteA, bills: [billA, billA] }), null);
});

test('unknown fields are dropped and remaining is derived', () => {
  const clean = normalizePartPaymentReceiptNote({ ...noteA, discount: 500, grant: true });
  assert.equal(clean.discount, undefined);
  assert.equal(clean.bills[0].remainingCents, 40000);
  assert.equal(clean.bills[1].remainingCents, 0);
  assert.equal(clean.unallocatedCents, 0);
});

test('rupees figures convert to cents exactly once', () => {
  const clean = normalizePartPaymentReceiptNote({
    id: 'PPN-9', receiptNo: 'R-109', customer: 'Ahmed', date: '2026-11-05',
    bills: [{ billRef: 'B-9', due: 1000, paid: 250 }],
  });
  assert.equal(clean.bills[0].dueCents, 100000);
  assert.equal(clean.bills[0].paidCents, 25000);
  assert.equal(clean.bills[0].remainingCents, 75000);
});

test('record, duplicate id, find, and remove', () => {
  const list = recordPartPaymentReceiptNote([], noteA);
  assert.equal(list.length, 1);
  assert.equal(recordPartPaymentReceiptNote(list, noteA).length, 1);
  assert.equal(recordPartPaymentReceiptNote(list, { ...noteA, receiptNo: 'R-999' }).length, 1);
  assert.equal(recordPartPaymentReceiptNote(list, null), null);
  assert.equal(findPartPaymentReceiptNote(list, 'PPN-1').receiptNo, 'R-101');
  assert.equal(findPartPaymentReceiptNote(list, 'PPN-9'), null);
  assert.equal(removePartPaymentReceiptNote(list, 'PPN-1').length, 0);
  assert.equal(removePartPaymentReceiptNote(list, 'PPN-9').length, 1);
});

test('customer and receipt filters are case-insensitive', () => {
  const list = [noteA, noteB];
  assert.equal(receiptNotesForCustomer(list, 'ahmed').length, 2);
  assert.equal(receiptNotesForCustomer(list, 'Saad').length, 0);
  assert.equal(receiptNotesForReceipt(list, 'r-101').length, 1);
  assert.equal(receiptNotesForReceipt(list, '').length, 0);
});

test('notes sort by date, then receipt number, then id', () => {
  const sorted = receiptNotesSorted([noteA, noteB]);
  assert.deepEqual(sorted.map((note) => note.id), ['PPN-2', 'PPN-1']);
});

test('totals: paid includes unallocated, remaining sums bill lines', () => {
  assert.equal(receiptNoteTotalPaidCents(noteA), 110000);
  assert.equal(receiptNoteTotalRemainingCents(noteA), 40000);
  const withUnallocated = { ...noteA, unallocatedCents: 5000 };
  assert.equal(receiptNoteTotalPaidCents(withUnallocated), 115000);
  assert.equal(receiptNoteTotalRemainingCents(withUnallocated), 40000);
});

test('note text shows paid and remaining in plain words', () => {
  const text = receiptNoteText(noteA);
  assert.match(text, /Receipt R-101 for Ahmed, 2026-11-05: paid PKR 1,100\./);
  assert.match(text, /Bill B-1 \(2026-10\): paid PKR 600, remaining PKR 400 \(settled in part\)\./);
  assert.match(text, /Bill B-2 \(2026-11\): paid PKR 500, remaining PKR 0 \(settled in full\)\./);
  assert.match(text, /Total remaining balance: PKR 400\./);
});

test('note text says plainly when no balance remains and shows unallocated', () => {
  const settled = { id: 'PPN-3', receiptNo: 'R-103', customer: 'Ahmed', date: '2026-11-05', bills: [billB], unallocatedCents: 2000 };
  const text = receiptNoteText(settled);
  assert.match(text, /Unallocated: PKR 20\./);
  assert.match(text, /No balance remains\./);
});

test('summary text', () => {
  assert.equal(receiptNoteSummaryText([]), 'No part-payment receipt notes recorded yet.');
  assert.match(receiptNoteSummaryText([noteA, noteB]), /2 part-payment receipt notes: PKR 1,400 paid, PKR 900 still remaining\./);
});

test('html escapes customer and receipt text', () => {
  const html = receiptNoteHtml({ ...noteA, customer: '<b>Ahmed</b>', receiptNo: 'R-<1>' });
  assert.match(html, /&lt;b&gt;Ahmed&lt;\/b&gt;/);
  assert.match(html, /R-&lt;1&gt;/);
  assert.doesNotMatch(html, /<b>Ahmed<\/b>/);
  assert.equal(receiptNoteAllHtml([]), '<p style="font-size: 13px;">No part-payment receipt notes recorded yet.</p>');
});

test('csv rows and filename', () => {
  const csv = receiptNoteCsv([noteA]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'Note id,Receipt no,Customer,Date,Bill,Month,Due (Rs.),Paid (Rs.),Remaining (Rs.),Unallocated (Rs.)');
  assert.equal(lines.length, 3);
  assert.match(lines[1], /PPN-1,R-101,Ahmed,2026-11-05,B-1,2026-10,1000,600,400,0/);
  assert.equal(receiptNoteFilename(), 'part-payment-receipt-notes.csv');
});

test('inputs are never mutated', () => {
  const input = JSON.parse(JSON.stringify(noteA));
  const snapshot = JSON.stringify(input);
  recordPartPaymentReceiptNote([], input);
  receiptNoteText(input);
  reconcileReceiptNote(input, [{ billRef: 'B-1', dueCents: 100000 }, { billRef: 'B-2', dueCents: 50000 }]);
  assert.equal(JSON.stringify(input), snapshot);
});

test('receipts with no note are flagged, case-insensitively, without duplicates', () => {
  const missing = receiptsMissingReceiptNotes(['R-101', 'R-102', 'r-101', '', 'R-200'], [noteA]);
  assert.deepEqual(missing, ['R-102', 'R-200']);
  assert.deepEqual(receiptsMissingReceiptNotes([], [noteA]), []);
  assert.deepEqual(receiptsMissingReceiptNotes(['R-101'], [noteA]), []);
});

test('reconciliation passes when paid plus remaining equals dues', () => {
  const result = reconcileReceiptNote(noteA, [
    { billRef: 'B-1', dueCents: 100000 },
    { billRef: 'B-2', dueCents: 50000 },
  ]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.problems, []);
});

test('reconciliation reports every kind of mismatch', () => {
  const wrongDue = reconcileReceiptNote(noteA, [
    { billRef: 'B-1', dueCents: 90000 },
    { billRef: 'B-2', dueCents: 50000 },
  ]);
  assert.equal(wrongDue.ok, false);
  assert.match(wrongDue.problems.join(' '), /B-1 due figure on the note/);

  const missingFromNote = reconcileReceiptNote(noteA, [
    { billRef: 'B-1', dueCents: 100000 },
    { billRef: 'B-2', dueCents: 50000 },
    { billRef: 'B-9', dueCents: 10000 },
  ]);
  assert.equal(missingFromNote.ok, false);
  assert.match(missingFromNote.problems.join(' '), /B-9 is in the customer's dues but missing from the note/);

  const extraOnNote = reconcileReceiptNote(noteA, [{ billRef: 'B-1', dueCents: 100000 }]);
  assert.equal(extraOnNote.ok, false);
  assert.match(extraOnNote.problems.join(' '), /B-2 is on the note but not in the customer's dues/);

  assert.equal(reconcileReceiptNote(null, []).ok, false);
});

test('purity fence: no storage, clock, or network in the module', () => {
  assert.doesNotMatch(moduleSrc, /localStorage|sessionStorage|fetch\(|XMLHttpRequest|new Date|Date\.now|document\.|window\./);
});

test('panel ids are present in index.html and wired in app.js', () => {
  for (const id of ['ppnReceiptNo', 'ppnCustomer', 'ppnDate', 'ppnBillLines', 'ppnUnallocated', 'ppnSaveBtn', 'ppnRemoveId', 'ppnRemoveBtn', 'ppnBody', 'ppnSummary', 'ppnExportBtn', 'ppnCheckReceipts', 'ppnCheckBtn', 'ppnFlaggedBody']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `index.html missing ${id}`);
  }
  assert.ok(appJs.includes('part-payment-receipt-note.js'));
  assert.ok(appJs.includes('renderPartPaymentReceiptNotes'));
  assert.ok(appJs.includes('shahdara_part_payment_receipt_notes_v1'));
});

test('deployment guard: no standalone OLT word in app.js', () => {
  assert.doesNotMatch(appJs, /\bOLT\b/);
});
