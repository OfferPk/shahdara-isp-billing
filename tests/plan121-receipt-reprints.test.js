import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  validReprintDate,
  normalizeReceiptReprint,
  normalizeReceiptReprintList,
  addReceiptReprint,
  findReceiptReprint,
  reprintsForReceipt,
  reprintCountForReceipt,
  normalizeOriginalReceipt,
  originalReceiptView,
  reprintCopy,
  receiptReprintSummaryText,
  receiptReprintHtml,
  originalReceiptHtml,
  receiptReprintCsv,
  receiptReprintFilename,
} from '../receipt-reprints.js';

const dir = dirname(fileURLToPath(import.meta.url));

test('strict reprint dates: real dates pass, impossible dates fail', () => {
  assert.equal(validReprintDate('2026-11-04'), '2026-11-04');
  assert.equal(validReprintDate('2024-02-29'), '2024-02-29');
  assert.equal(validReprintDate('2026-02-30'), null);
  assert.equal(validReprintDate('2026-02-29'), null);
  assert.equal(validReprintDate('2026-13-01'), null);
  assert.equal(validReprintDate('04-11-2026'), null);
  assert.equal(validReprintDate(''), null);
  assert.equal(validReprintDate(null), null);
});

test('rupees convert once, cents pass through as-is', () => {
  const byRupees = normalizeReceiptReprint({ id: 'R1', receiptNumber: 'REC-1', amount: 1500, reprintDate: '2026-11-04' });
  assert.equal(byRupees.amountCents, 150000);
  const byCents = normalizeReceiptReprint({ id: 'R2', receiptNumber: 'REC-1', amountCents: 150000, reprintDate: '2026-11-04' });
  assert.equal(byCents.amountCents, 150000);
  // A cents figure is never re-multiplied as rupees.
  const guard = normalizeReceiptReprint({ id: 'R3', receiptNumber: 'REC-1', amountCents: 5000, amount: 999, reprintDate: '2026-11-04' });
  assert.equal(guard.amountCents, 5000);
});

test('half-formed reprints refused, unknown fields dropped', () => {
  assert.equal(normalizeReceiptReprint({ receiptNumber: 'REC-1', amount: 100, reprintDate: '2026-11-04' }), null);
  assert.equal(normalizeReceiptReprint({ id: 'R1', amount: 100, reprintDate: '2026-11-04' }), null);
  assert.equal(normalizeReceiptReprint({ id: 'R1', receiptNumber: 'REC-1', amount: 0, reprintDate: '2026-11-04' }), null);
  assert.equal(normalizeReceiptReprint({ id: 'R1', receiptNumber: 'REC-1', amount: -50, reprintDate: '2026-11-04' }), null);
  assert.equal(normalizeReceiptReprint({ id: 'R1', receiptNumber: 'REC-1', amount: 100, reprintDate: '2026-02-30' }), null);
  assert.equal(normalizeReceiptReprint({ id: 'R1', receiptNumber: 'REC-1', amount: '100', reprintDate: '2026-11-04' }), null);
  const clean = normalizeReceiptReprint({
    id: 'R1', receiptNumber: 'REC-1', amount: 100, reprintDate: '2026-11-04',
    operator: 'Saad', paymentId: 'P-9', newReceiptNumber: 'REC-2', total: 999,
  });
  assert.equal(clean.operator, 'Saad');
  assert.equal('paymentId' in clean, false);
  assert.equal('newReceiptNumber' in clean, false);
  assert.equal('total' in clean, false);
});

test('duplicate id never rewritten', () => {
  const first = { id: 'R1', receiptNumber: 'REC-1', amount: 100, reprintDate: '2026-11-04' };
  const base = addReceiptReprint([], first);
  assert.equal(base.length, 1);
  assert.equal(addReceiptReprint(base, first).length, 1);
  const changed = addReceiptReprint(base, { ...first, reprintDate: '2026-11-05' });
  assert.equal(changed.length, 1);
  assert.equal(changed[0].reprintDate, '2026-11-04');
  const refused = addReceiptReprint(base, { id: 'R2', receiptNumber: 'REC-1', amount: 100, reprintDate: '2026-02-30' });
  assert.equal(refused.length, 1);
});

test('reprints listed per receipt, oldest first, exact number match', () => {
  const list = [
    { id: 'R2', receiptNumber: 'REC-1', amount: 100, reprintDate: '2026-11-05' },
    { id: 'R1', receiptNumber: 'REC-1', amount: 100, reprintDate: '2026-11-04' },
    { id: 'R3', receiptNumber: 'REC-2', amount: 200, reprintDate: '2026-11-03' },
  ];
  const forRec1 = reprintsForReceipt(list, 'REC-1');
  assert.deepEqual(forRec1.map((item) => item.id), ['R1', 'R2']);
  assert.equal(reprintCountForReceipt(list, 'REC-1'), 2);
  assert.equal(reprintCountForReceipt(list, 'REC-2'), 1);
  assert.deepEqual(reprintsForReceipt(list, 'REC-10'), []);
  assert.deepEqual(reprintsForReceipt(list, ''), []);
  assert.deepEqual(reprintsForReceipt(list, ' rec-1 '), []);
});

test('original receipt view carries count and verbatim amount', () => {
  const list = [
    { id: 'R1', receiptNumber: 'REC-1', amount: 100, reprintDate: '2026-11-04' },
    { id: 'R2', receiptNumber: 'REC-1', amount: 100, reprintDate: '2026-11-06' },
  ];
  const view = originalReceiptView({ receiptNumber: 'REC-1', amount: 100 }, list);
  assert.equal(view.receiptNumber, 'REC-1');
  assert.equal(view.amountCents, 10000);
  assert.equal(view.reprintCount, 2);
  assert.equal(view.lastReprintDate, '2026-11-06');
  const never = originalReceiptView({ receiptNumber: 'REC-9', amount: 50 }, list);
  assert.equal(never.reprintCount, 0);
  assert.equal(never.lastReprintDate, null);
  // A reprint record can never restate the original amount.
  const tampered = originalReceiptView({ receiptNumber: 'REC-1', amount: 100 }, [
    { id: 'R1', receiptNumber: 'REC-1', amount: 999, reprintDate: '2026-11-04' },
  ]);
  assert.equal(tampered.amountCents, 10000);
  assert.equal(originalReceiptView({ receiptNumber: '', amount: 100 }, list), null);
  assert.equal(originalReceiptView({ receiptNumber: 'REC-1', amount: 0 }, list), null);
});

test('reprint copy always marked REPRINT with original number and amount', () => {
  const list = [{ id: 'R1', receiptNumber: 'REC-1', amount: 100, reprintDate: '2026-11-04' }];
  const copy = reprintCopy({ receiptNumber: 'REC-1', amount: 100 }, list);
  assert.equal(copy.mark, 'REPRINT');
  assert.equal(copy.receiptNumber, 'REC-1');
  assert.equal(copy.amountCents, 10000);
  assert.equal(copy.reprintCount, 1);
  assert.equal(copy.lastReprintDate, '2026-11-04');
  assert.equal('newReceiptNumber' in copy, false);
  assert.equal(reprintCopy({ receiptNumber: '', amount: 100 }, list), null);
});

test('find, list normalisation, and summary text', () => {
  const list = normalizeReceiptReprintList([
    { id: 'R1', receiptNumber: 'REC-1', amount: 100, reprintDate: '2026-11-04' },
    { id: 'R1', receiptNumber: 'REC-1', amount: 100, reprintDate: '2026-11-04' },
    { id: 'BAD', receiptNumber: '', amount: 100, reprintDate: '2026-11-04' },
    null,
  ]);
  assert.equal(list.length, 1);
  assert.equal(findReceiptReprint(list, 'R1').receiptNumber, 'REC-1');
  assert.equal(findReceiptReprint(list, 'NOPE'), null);
  assert.equal(receiptReprintSummaryText([]), 'No receipt reprint recorded yet.');
  assert.equal(receiptReprintSummaryText(list), '1 reprint(s) recorded for 1 receipt(s).');
});

test('inputs never mutated', () => {
  const raw = { id: 'R1', receiptNumber: 'REC-1', amount: 100, reprintDate: '2026-11-04' };
  const before = JSON.stringify(raw);
  const list = [{ id: 'R0', receiptNumber: 'REC-1', amount: 100, reprintDate: '2026-11-03' }];
  const listBefore = JSON.stringify(list);
  addReceiptReprint(list, raw);
  reprintsForReceipt(list, 'REC-1');
  originalReceiptView({ receiptNumber: 'REC-1', amount: 100 }, list);
  assert.equal(JSON.stringify(raw), before);
  assert.equal(JSON.stringify(list), listBefore);
  assert.equal(Object.isFrozen(normalizeReceiptReprint(raw)), true);
});

test('HTML escapes input, CSV quotes, filename', () => {
  const evil = { id: 'R1', receiptNumber: 'REC-<1>', amount: 100, reprintDate: '2026-11-04', operator: 'A "B"', note: 'x,y' };
  const html = receiptReprintHtml(evil);
  assert.ok(html.includes('REPRINT'));
  assert.ok(html.includes('REC-&lt;1&gt;'));
  assert.ok(!html.includes('<1>'));
  assert.ok(html.includes('A &quot;B&quot;'));
  const viewHtml = originalReceiptHtml(originalReceiptView({ receiptNumber: 'REC-<1>', amount: 100 }, [evil]));
  assert.ok(viewHtml.includes('Original receipt'));
  assert.ok(viewHtml.includes('1 reprint(s)'));
  const csv = receiptReprintCsv([evil]);
  assert.ok(csv.startsWith('id,receipt_number,amount_cents,reprint_date,operator,note'));
  assert.ok(csv.includes('"x,y"'));
  assert.equal(receiptReprintFilename(), 'receipt-reprints.csv');
});

test('purity fence: no imports, storage, DOM, network, or other-module identifiers', () => {
  const src = readFileSync(join(dir, '..', 'receipt-reprints.js'), 'utf8');
  assert.ok(!src.includes('import '));
  assert.ok(!src.includes('localStorage'));
  assert.ok(!src.includes('document.'));
  assert.ok(!src.includes('fetch('));
  assert.ok(!src.includes('XMLHttpRequest'));
  // Receipt-number rules live elsewhere; this module must not name them.
  assert.ok(!src.includes('receipt-gap'));
  assert.ok(!src.includes('deposit-slips'));
  assert.ok(!src.includes('cash-reconciliation'));
  assert.ok(!src.includes('method-reconciliation'));
});

test('panel element IDs present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of [
    'receiptReprintBody', 'receiptReprintSummary', 'receiptReprintNumber',
    'receiptReprintAmount', 'receiptReprintDate', 'receiptReprintOperator',
    'receiptReprintNote', 'receiptReprintSaveBtn', 'receiptReprintFilter',
    'receiptReprintExportBtn', 'receiptReprintCopy',
  ]) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
