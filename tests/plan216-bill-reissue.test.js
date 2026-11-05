import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validReissueDate,
  normalizeBillReissue,
  normalizeBillReissueList,
  findBillReissue,
  recordBillReissue,
  removeBillReissue,
  billReissuesSorted,
  billReissuesForCustomer,
  billReissueSummaryText,
  reissueCopyText,
  billReissueText,
  billReissueHtml,
  billReissueAllHtml,
  billReissueCsv,
  billReissueFilename,
} from '../bill-reissue.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'bill-reissue.js'), 'utf8');

const noteA = { id: 'BR-1', customer: 'Ahmed', originalBillRef: 'BILL-2026-11-001', reissueDate: '2026-11-05', reason: 'Lost copy', reissuedBy: 'Saad' };
const noteB = { id: 'BR-2', customer: 'Ahmed', originalBillRef: 'BILL-2026-10-004', reissueDate: '2026-11-03', reason: 'Damaged copy' };
const noteC = { id: 'BR-3', customer: 'Bilal', originalBillRef: 'BILL-2026-11-002', reissueDate: '2026-11-04' };

test('half-formed reissue notes are refused', () => {
  assert.equal(normalizeBillReissue({ id: 'BR-9', originalBillRef: 'BILL-1', reissueDate: '2026-11-05' }), null);
  assert.equal(normalizeBillReissue({ id: 'BR-9', customer: 'Ahmed', reissueDate: '2026-11-05' }), null);
  assert.equal(normalizeBillReissue({ id: 'BR-9', customer: 'Ahmed', originalBillRef: 'BILL-1' }), null);
  assert.equal(normalizeBillReissue({ id: 'BR-9', customer: 'Ahmed', originalBillRef: 'BILL-1', reissueDate: '2026-13-01' }), null);
  assert.equal(normalizeBillReissue({ id: '', customer: 'Ahmed', originalBillRef: 'BILL-1', reissueDate: '2026-11-05' }), null);
  assert.equal(normalizeBillReissue(null), null);
  assert.equal(normalizeBillReissue('not an object'), null);
});

test('strict calendar dates: 2026-02-30 refused, leap day accepted', () => {
  assert.equal(validReissueDate('2026-02-30'), false);
  assert.equal(validReissueDate('2024-02-29'), true);
  assert.equal(validReissueDate('2026-02-29'), false);
  assert.equal(validReissueDate('2026-11-05'), true);
  assert.equal(validReissueDate('5 Nov 2026'), false);
  assert.equal(validReissueDate(20261105), false);
});

test('unknown fields are dropped, so a note can never grow an amount or total', () => {
  const clean = normalizeBillReissue({ ...noteA, amount: 5000, totalCents: 500000, charge: 100 });
  assert.deepEqual(Object.keys(clean).sort(), ['customer', 'id', 'originalBillRef', 'reason', 'reissueDate', 'reissuedBy']);
  assert.equal('amount' in clean, false);
  assert.equal('totalCents' in clean, false);
});

test('list normalisation drops half-formed notes and duplicate ids', () => {
  assert.deepEqual(normalizeBillReissueList('not a list'), []);
  assert.deepEqual(normalizeBillReissueList([noteA, noteA, { id: 'BR-9' }]).map((n) => n.id), ['BR-1']);
});

test('duplicate ids never rewrite a recorded note', () => {
  const before = [noteA];
  const after = recordBillReissue(before, { ...noteA, reason: 'Changed reason' });
  assert.equal(after.length, 1);
  assert.equal(after[0].reason, 'Lost copy');
  assert.equal(recordBillReissue(before, { id: 'BR-9' }).length, 1);
});

test('find and remove work by id', () => {
  assert.equal(findBillReissue([noteA, noteB], 'BR-2').originalBillRef, 'BILL-2026-10-004');
  assert.equal(findBillReissue([noteA], 'BR-9'), null);
  assert.equal(findBillReissue([noteA], ''), null);
  assert.deepEqual(removeBillReissue([noteA, noteB], 'BR-1').map((n) => n.id), ['BR-2']);
  assert.equal(removeBillReissue([noteA], 'BR-9').length, 1);
});

test('reissues sort per customer, then by reissue date', () => {
  assert.deepEqual(billReissuesSorted([noteC, noteA, noteB]).map((n) => n.id), ['BR-2', 'BR-1', 'BR-3']);
});

test('customer filter is case-insensitive substring', () => {
  assert.deepEqual(billReissuesForCustomer([noteA, noteB, noteC], 'ahm').map((n) => n.id), ['BR-2', 'BR-1']);
  assert.deepEqual(billReissuesForCustomer([noteA, noteC], 'BILAL').map((n) => n.id), ['BR-3']);
  assert.equal(billReissuesForCustomer([noteA, noteC], '').length, 2);
});

test('summary text counts notes and customers', () => {
  assert.equal(billReissueSummaryText([]), 'No bill reissues recorded.');
  assert.equal(billReissueSummaryText([noteA]), '1 bill reissue recorded for 1 customer.');
  assert.equal(billReissueSummaryText([noteA, noteB, noteC]), '3 bill reissues recorded for 2 customers.');
});

test('every reissued bill carries a REISSUE mark with original reference and date', () => {
  const mark = reissueCopyText('BILL-2026-11-001', '2026-11-05');
  assert.match(mark, /REISSUE/);
  assert.match(mark, /BILL-2026-11-001/);
  assert.match(mark, /2026-11-05/);
  assert.match(mark, /not a new charge/);
  assert.equal(reissueCopyText('', '2026-11-05'), '');
  assert.equal(reissueCopyText('BILL-1', '2026-02-30'), '');
});

test('note text names the reason and reissuer, or says so plainly', () => {
  assert.match(billReissueText(noteA), /Lost copy/);
  assert.match(billReissueText(noteA), /Saad/);
  assert.match(billReissueText(noteC), /No reason noted\./);
  assert.equal(billReissueText({ id: 'BR-9' }), '');
});

test('html escapes user text', () => {
  const html = billReissueHtml({ ...noteA, reason: '<script>alert(1)</script>' });
  assert.equal(html.includes('<script>'), false);
  assert.match(html, /&lt;script&gt;/);
});

test('all-html lists notes in sorted order', () => {
  const html = billReissueAllHtml([noteC, noteA]);
  assert.ok(html.indexOf('Ahmed') < html.indexOf('Bilal'));
});

test('csv export and filename', () => {
  const csv = billReissueCsv([noteB, noteA]);
  assert.match(csv, /^id,customer,original_bill_ref,reissue_date,reason,reissued_by\n/);
  assert.match(csv, /BR-2,Ahmed,BILL-2026-10-004,2026-11-03,Damaged copy,/);
  assert.equal(billReissueFilename(), 'bill-reissues.csv');
});

test('inputs are never mutated', () => {
  const raw = { ...noteA };
  const snapshot = JSON.stringify(raw);
  normalizeBillReissue(raw);
  recordBillReissue([raw], noteB);
  assert.equal(JSON.stringify(raw), snapshot);
});

test('module purity fence: no imports, clock, storage, or network', () => {
  assert.equal(/^import /m.test(moduleSrc), false);
  assert.equal(/localStorage/.test(moduleSrc), false);
  assert.equal(/fetch\(/.test(moduleSrc), false);
  assert.equal(/new Date/.test(moduleSrc), false);
  assert.equal(/receipt-reprints/.test(moduleSrc), true); // fence comment names Plan 121 only
  assert.equal(/from '\.\/receipt/.test(moduleSrc), false);
});

test('panel element ids exist in index.html', () => {
  for (const id of ['brHeading', 'brCustomer', 'brOriginalBill', 'brReissueDate', 'brReason', 'brReissuedBy', 'brSaveBtn', 'brRemoveId', 'brRemoveBtn', 'brCustomerFilter', 'brBody', 'brSummary', 'brExportBtn']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wires the bill reissue panel', () => {
  assert.ok(appJs.includes("from './bill-reissue.js'"));
  assert.ok(appJs.includes('BILL_REISSUE_KEY'));
  assert.ok(appJs.includes('renderBillReissues()'));
  assert.ok(appJs.includes('billReissueCsv'));
});

test('deployment guard: no standalone OLT word added to app.js by this plan', () => {
  const added = appJs.match(/renderBillReissues[\s\S]*?function renderCorrectionApprovals/);
  assert.ok(added, 'bill reissue render block present');
  assert.equal(/\bOLT\b/.test(added[0]), false);
});
