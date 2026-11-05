import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validApprovalDate,
  normalizeCorrectionApproval,
  normalizeCorrectionApprovalList,
  recordCorrectionApproval,
  removeCorrectionApproval,
  findCorrectionApproval,
  approvalsForCorrection,
  approvalsSorted,
  approvalsForPeriod,
  requiresSecondApprover,
  approvalsMissingSecondApprover,
  correctionApprovalSummaryText,
  correctionApprovalText,
  correctionApprovalHtml,
  correctionApprovalAllHtml,
  correctionApprovalCsv,
  correctionApprovalFilename,
} from '../correction-approval.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'correction-approval.js'), 'utf8');

const LIMIT = 1000000; // PKR 10,000 in cents, review-time operator tier limit
const a = { id: 'CA-1', correctionRef: 'CORR-1', approver: 'Owner', secondApprover: '', date: '2026-11-02', amountCents: 500000 };
const b = { id: 'CA-2', correctionRef: 'CORR-2', approver: 'Owner', secondApprover: 'Saad', date: '2026-11-05', amountCents: 2500000 };
const c = { id: 'CA-3', correctionRef: 'CORR-3', approver: 'Saad', secondApprover: '', date: '2026-11-03', amountCents: 2000000 };

test('half-formed approvals are refused', () => {
  assert.equal(normalizeCorrectionApproval(null), null);
  assert.equal(normalizeCorrectionApproval({}), null);
  assert.equal(normalizeCorrectionApproval({ id: 'CA-1', correctionRef: 'CORR-1', approver: 'Owner' }), null);
  assert.equal(normalizeCorrectionApproval({ correctionRef: 'CORR-1', approver: 'Owner', date: '2026-11-02' }), null);
  assert.equal(normalizeCorrectionApproval({ id: 'CA-1', approver: 'Owner', date: '2026-11-02' }), null);
  assert.equal(normalizeCorrectionApproval({ id: 'CA-1', correctionRef: 'CORR-1', date: '2026-11-02' }), null);
  assert.equal(normalizeCorrectionApproval({ id: '  ', correctionRef: 'CORR-1', approver: 'Owner', date: '2026-11-02' }), null);
  assert.equal(normalizeCorrectionApproval({ ...a, amountCents: -100 }), null);
});

test('strict dates: real calendar only', () => {
  assert.equal(validApprovalDate('2026-11-02'), true);
  assert.equal(validApprovalDate('2026-02-29'), false);
  assert.equal(validApprovalDate('2024-02-29'), true);
  assert.equal(validApprovalDate('2026-04-31'), false);
  assert.equal(validApprovalDate('2026-13-01'), false);
  assert.equal(validApprovalDate('2026-11-2'), false);
  assert.equal(validApprovalDate(''), false);
  assert.equal(normalizeCorrectionApproval({ ...a, date: '2026-02-30' }), null);
});

test('unknown fields are dropped and second approver defaults empty', () => {
  const clean = normalizeCorrectionApproval({ ...a, discount: 500, grant: true });
  assert.equal(clean.discount, undefined);
  assert.equal(clean.secondApprover, '');
  assert.equal(clean.amountCents, 500000);
});

test('rupees convert to cents exactly once', () => {
  assert.equal(normalizeCorrectionApproval({ ...a, amountCents: undefined, amount: 2500 }).amountCents, 250000);
  assert.equal(normalizeCorrectionApproval({ ...a, amountCents: undefined }).amountCents, null);
});

test('duplicate ids are never rewritten', () => {
  const list = recordCorrectionApproval([], a);
  assert.equal(recordCorrectionApproval(list, { ...a, approver: 'Someone else' }), null);
  assert.equal(list[0].approver, 'Owner');
  assert.equal(recordCorrectionApproval(list, b).length, 2);
});

test('list normalization drops bad rows and later duplicates', () => {
  assert.deepEqual(normalizeCorrectionApprovalList([a, null, a, { ...b, date: 'bad' }]), [normalizeCorrectionApproval(a)]);
  assert.deepEqual(normalizeCorrectionApprovalList('nope'), []);
});

test('find and remove work by id only', () => {
  const list = [a, b, c];
  assert.equal(findCorrectionApproval(list, 'CA-2').correctionRef, 'CORR-2');
  assert.equal(findCorrectionApproval(list, 'CA-9'), null);
  assert.equal(findCorrectionApproval(list, ''), null);
  assert.deepEqual(removeCorrectionApproval(list, 'CA-2').map((x) => x.id), ['CA-1', 'CA-3']);
  assert.equal(removeCorrectionApproval(list, '').length, 3);
});

test('approvals for one correction reference', () => {
  const list = [a, b, { ...c, correctionRef: 'CORR-1' }];
  assert.equal(approvalsForCorrection(list, 'CORR-1').length, 2);
  assert.deepEqual(approvalsForCorrection(list, ''), []);
});

test('sorting is by date, then correction reference, then id', () => {
  const sorted = approvalsSorted([b, c, a]);
  assert.deepEqual(sorted.map((x) => x.id), ['CA-1', 'CA-3', 'CA-2']);
});

test('period review is inclusive at both ends', () => {
  const list = [a, b, c];
  assert.deepEqual(approvalsForPeriod(list, { from: '2026-11-02', to: '2026-11-03' }).map((x) => x.id), ['CA-1', 'CA-3']);
  assert.deepEqual(approvalsForPeriod(list, { from: '2026-11-03' }).map((x) => x.id), ['CA-3', 'CA-2']);
  assert.deepEqual(approvalsForPeriod(list, { to: '2026-11-03' }).map((x) => x.id), ['CA-1', 'CA-3']);
  assert.deepEqual(approvalsForPeriod(list, {}).map((x) => x.id), ['CA-1', 'CA-3', 'CA-2']);
});

test('period review rejects bad and reversed ranges', () => {
  assert.deepEqual(approvalsForPeriod([a], { from: 'bad', to: '2026-11-30' }), []);
  assert.deepEqual(approvalsForPeriod([a], { from: '2026-11-10', to: '2026-11-02' }), []);
});

test('second approver required only strictly above the tier', () => {
  assert.equal(requiresSecondApprover(a, LIMIT), false);
  assert.equal(requiresSecondApprover(b, LIMIT), true);
  assert.equal(requiresSecondApprover({ ...a, amountCents: LIMIT }, LIMIT), false);
  assert.equal(requiresSecondApprover({ ...a, amountCents: LIMIT + 1 }, LIMIT), true);
  assert.equal(requiresSecondApprover({ ...a, amountCents: null }, LIMIT), false);
  assert.equal(requiresSecondApprover(b, null), false);
  assert.equal(requiresSecondApprover(b, -1), false);
});

test('flagging lists only above-tier approvals with no second approver', () => {
  assert.deepEqual(approvalsMissingSecondApprover([a, b, c], LIMIT).map((x) => x.id), ['CA-3']);
  assert.deepEqual(approvalsMissingSecondApprover([a, b], LIMIT), []);
});

test('summary text counts approvals and flags', () => {
  assert.equal(correctionApprovalSummaryText([], LIMIT), 'No correction approvals recorded.');
  assert.match(correctionApprovalSummaryText([a, b], LIMIT), /2 correction approvals recorded/);
  assert.match(correctionApprovalSummaryText([a, b], LIMIT), /None flagged/);
  assert.match(correctionApprovalSummaryText([c], LIMIT), /1 flagged/);
});

test('approval text shows flag only when above tier and unseconded', () => {
  assert.match(correctionApprovalText(c, LIMIT), /FLAGGED/);
  assert.doesNotMatch(correctionApprovalText(b, LIMIT), /FLAGGED/);
  assert.doesNotMatch(correctionApprovalText(a, LIMIT), /FLAGGED/);
  assert.equal(correctionApprovalText(null, LIMIT), '');
});

test('HTML escapes user text', () => {
  const html = correctionApprovalHtml({ ...a, approver: '<b>Owner</b>' }, LIMIT);
  assert.doesNotMatch(html, /<b>Owner<\/b>/);
  assert.match(html, /&lt;b&gt;Owner&lt;\/b&gt;/);
  assert.equal(correctionApprovalHtml(null, LIMIT), '');
  assert.match(correctionApprovalAllHtml([a, c], LIMIT), /CORR-1/);
});

test('CSV export and filename', () => {
  const csv = correctionApprovalCsv([b, a]);
  assert.match(csv, /^id,correctionRef,approver,secondApprover,date,amountCents\n/);
  assert.match(csv, /CA-1,CORR-1,Owner,,2026-11-02,500000/);
  assert.equal(correctionApprovalFilename(), 'correction-approvals.csv');
});

test('inputs are never mutated', () => {
  const input = { ...a, extra: 'x' };
  const before = JSON.stringify(input);
  recordCorrectionApproval([], input);
  normalizeCorrectionApprovalList([input]);
  assert.equal(JSON.stringify(input), before);
});

test('purity fence: module imports nothing and names no outside record system', () => {
  assert.doesNotMatch(moduleSrc, /^\s*import\s/m);
  assert.doesNotMatch(moduleSrc, /localStorage|document\./);
  assert.doesNotMatch(moduleSrc, /normalizeBillingCorrection|normalizeApprovalList|tierForAmount/);
});

test('app.js wires the approval trail panel', () => {
  for (const token of ['correction-approval.js', 'recordCorrectionApproval', 'renderCorrectionApprovals', 'CORRECTION_APPROVAL_KEY', 'approvalsSorted', 'caExportBtn']) {
    assert.ok(appJs.includes(token), `app.js missing ${token}`);
  }
  assert.doesNotMatch(appJs, /\bOLT\b/);
});

test('panel element ids are present in index.html', () => {
  for (const id of ['caSummary', 'caExportBtn', 'caCorrectionRef', 'caApprover', 'caSecondApprover', 'caDate', 'caAmount', 'caSaveBtn', 'caRemoveId', 'caRemoveBtn', 'caPeriodFrom', 'caPeriodTo', 'caTierLimit', 'caBody', 'caFlaggedBody']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `index.html missing ${id}`);
  }
});
