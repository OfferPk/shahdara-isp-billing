import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validRefundApprovalDate,
  normalizeRefundApproval,
  normalizeRefundApprovalList,
  recordRefundApproval,
  removeRefundApproval,
  findRefundApproval,
  approvalsForRefund,
  approvalsSorted,
  approvalsForPeriod,
  normalizeRefundForCheck,
  refundNeedsApproval,
  refundHasPriorApproval,
  refundApprovalStatus,
  refundsMissingApproval,
  refundApprovalText,
  refundApprovalHtml,
  refundApprovalAllHtml,
  refundApprovalSummaryText,
  refundApprovalCsv,
  refundApprovalFilename,
} from '../refund-approval.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'refund-approval.js'), 'utf8');

const approval = (overrides = {}) => ({
  id: 'RA-1',
  refundRef: 'RF-100',
  approver: 'Owner',
  date: '2026-11-01',
  amount: 5000,
  ...overrides,
});

test('half-formed approval refused: no id, no refund ref, no approver, no date, no amount', () => {
  assert.equal(normalizeRefundApproval(approval({ id: '' })), null);
  assert.equal(normalizeRefundApproval(approval({ refundRef: '  ' })), null);
  assert.equal(normalizeRefundApproval(approval({ approver: '' })), null);
  assert.equal(normalizeRefundApproval(approval({ date: '' })), null);
  assert.equal(normalizeRefundApproval(approval({ amount: 0 })), null);
  assert.equal(normalizeRefundApproval(approval({ amount: -50 })), null);
  assert.equal(normalizeRefundApproval(null), null);
});

test('strict dates: 2026-02-30 refused, 2024-02-29 accepted', () => {
  assert.equal(validRefundApprovalDate('2026-02-30'), false);
  assert.equal(validRefundApprovalDate('2024-02-29'), true);
  assert.equal(validRefundApprovalDate('2026-13-01'), false);
  assert.equal(normalizeRefundApproval(approval({ date: '2026-02-30' })), null);
  assert.notEqual(normalizeRefundApproval(approval({ date: '2024-02-29' })), null);
});

test('unknown fields dropped, cents used as-is, rupees convert once', () => {
  const clean = normalizeRefundApproval(approval({ paymentId: 'P-9', billTotal: 999, amountCents: 250000 }));
  assert.equal(clean.paymentId, undefined);
  assert.equal(clean.amountCents, 250000);
  assert.equal(normalizeRefundApproval(approval({ amount: 50 })).amountCents, 5000);
  assert.equal(normalizeRefundApproval(approval({ amountCents: 5000 })).amountCents, 5000);
});

test('duplicate id never rewritten; record returns null on duplicate or half-formed', () => {
  const base = [approval()];
  assert.equal(recordRefundApproval(base, approval({ approver: 'Someone else' })), null);
  assert.equal(recordRefundApproval(base, approval({ id: '' })), null);
  const next = recordRefundApproval(base, approval({ id: 'RA-2' }));
  assert.equal(next.length, 2);
  assert.equal(base.length, 1);
});

test('find and remove', () => {
  const list = [approval(), approval({ id: 'RA-2', refundRef: 'RF-101' })];
  assert.equal(findRefundApproval(list, 'RA-2').refundRef, 'RF-101');
  assert.equal(findRefundApproval(list, 'RA-9'), null);
  assert.equal(removeRefundApproval(list, 'RA-1').length, 1);
  assert.equal(removeRefundApproval(list, '').length, 2);
});

test('sorting: date, then refund ref, then id', () => {
  const list = [
    approval({ id: 'RA-3', date: '2026-11-02', refundRef: 'RF-102' }),
    approval({ id: 'RA-1', date: '2026-11-01', refundRef: 'RF-101' }),
    approval({ id: 'RA-2', date: '2026-11-01', refundRef: 'RF-100' }),
  ];
  assert.deepEqual(approvalsSorted(list).map((item) => item.id), ['RA-2', 'RA-1', 'RA-3']);
});

test('period filter inclusive at both ends; bad or reversed range yields nothing', () => {
  const list = [approval({ date: '2026-11-01' }), approval({ id: 'RA-2', date: '2026-11-15' }), approval({ id: 'RA-3', date: '2026-11-30' })];
  assert.equal(approvalsForPeriod(list, { from: '2026-11-01', to: '2026-11-15' }).length, 2);
  assert.equal(approvalsForPeriod(list, { from: '2026-11-15', to: '2026-11-01' }).length, 0);
  assert.equal(approvalsForPeriod(list, { from: '2026-02-30', to: '' }).length, 0);
  assert.equal(approvalsForPeriod(list, { from: '', to: '2026-11-15' }).length, 2);
});

test('approvals for one refund reference only', () => {
  const list = [approval(), approval({ id: 'RA-2', refundRef: 'RF-101' })];
  assert.equal(approvalsForRefund(list, 'RF-100').length, 1);
  assert.equal(approvalsForRefund(list, '').length, 0);
});

test('tier rule: strictly above the limit needs approval; equal does not', () => {
  assert.equal(refundNeedsApproval({ refundRef: 'RF-100', amount: 5001 }, 500000), true);
  assert.equal(refundNeedsApproval({ refundRef: 'RF-100', amount: 5000 }, 500000), false);
  assert.equal(refundNeedsApproval({ refundRef: 'RF-100', amount: 5000 }, null), false);
  assert.equal(refundNeedsApproval({ refundRef: 'RF-100', amount: 5000 }, -1), false);
  assert.equal(refundNeedsApproval({ refundRef: '', amount: 9000 }, 500000), false);
});

test('prior approval: same ref dated on or before the refund date; later approval does not count', () => {
  const approvals = [approval({ date: '2026-11-01' })];
  assert.equal(refundHasPriorApproval({ refundRef: 'RF-100', amount: 9000, date: '2026-11-05' }, approvals), true);
  assert.equal(refundHasPriorApproval({ refundRef: 'RF-100', amount: 9000, date: '2026-11-01' }, approvals), true);
  assert.equal(refundHasPriorApproval({ refundRef: 'RF-100', amount: 9000, date: '2026-10-01' }, approvals), false);
  assert.equal(refundHasPriorApproval({ refundRef: 'RF-999', amount: 9000, date: '2026-11-05' }, approvals), false);
  assert.equal(refundHasPriorApproval({ refundRef: 'RF-100', amount: 9000 }, approvals), true);
});

test('status: not-required, approved, missing-approval, unknown', () => {
  const approvals = [approval({ date: '2026-11-01' })];
  assert.equal(refundApprovalStatus({ refundRef: 'RF-100', amount: 100, date: '2026-11-05' }, approvals, 500000), 'not-required');
  assert.equal(refundApprovalStatus({ refundRef: 'RF-100', amount: 9000, date: '2026-11-05' }, approvals, 500000), 'approved');
  assert.equal(refundApprovalStatus({ refundRef: 'RF-101', amount: 9000, date: '2026-11-05' }, approvals, 500000), 'missing-approval');
  assert.equal(refundApprovalStatus({ refundRef: 'RF-101', amount: 9000, date: '2026-11-05' }, approvals, null), 'unknown');
  assert.equal(refundApprovalStatus({ refundRef: '', amount: 9000 }, approvals, 500000), 'unknown');
});

test('missing-approval list flags only the unapproved above-tier refunds', () => {
  const approvals = [approval({ date: '2026-11-01' })];
  const refunds = [
    { refundRef: 'RF-100', amount: 9000, date: '2026-11-05' },
    { refundRef: 'RF-101', amount: 9000, date: '2026-11-05' },
    { refundRef: 'RF-102', amount: 100, date: '2026-11-05' },
  ];
  const flagged = refundsMissingApproval(refunds, approvals, 500000);
  assert.deepEqual(flagged.map((item) => item.refundRef), ['RF-101']);
  assert.equal(refundsMissingApproval('not-a-list', approvals, 500000).length, 0);
});

test('text, HTML escaping, all-HTML order, CSV and filename', () => {
  assert.equal(refundApprovalText(approval()), 'Refund RF-100 approved by Owner on 2026-11-01 for PKR 5,000.');
  assert.match(refundApprovalHtml(approval({ approver: '<b>Owner</b>' })), /&lt;b&gt;Owner&lt;\/b&gt;/);
  assert.doesNotMatch(refundApprovalHtml(approval({ approver: '<b>Owner</b>' })), /<b>Owner<\/b>/);
  assert.match(refundApprovalAllHtml([]), /No refund approvals recorded/);
  const csv = refundApprovalCsv([approval()]);
  assert.match(csv, /^id,refundRef,approver,date,amountCents\nRA-1,RF-100,Owner,2026-11-01,500000$/);
  assert.equal(refundApprovalFilename(), 'refund-approvals.csv');
});

test('summary text counts approvals and flagged refunds', () => {
  const approvals = [approval()];
  const refunds = [{ refundRef: 'RF-101', amount: 9000, date: '2026-11-05' }];
  assert.equal(
    refundApprovalSummaryText(approvals, refunds, 500000),
    '1 refund approval(s) recorded. 1 refund(s) flagged as missing prior approval.',
  );
});

test('inputs never mutated; list normalisation drops half-formed and duplicates', () => {
  const input = approval({ extra: 'x' });
  const before = JSON.stringify(input);
  normalizeRefundApproval(input);
  assert.equal(JSON.stringify(input), before);
  const list = [approval(), approval(), approval({ id: '' })];
  assert.equal(normalizeRefundApprovalList(list).length, 1);
});

test('purity fence: no storage, DOM, network, clock, or neighbour module', () => {
  assert.doesNotMatch(moduleSrc, /localStorage|document\.|fetch\(|XMLHttpRequest/);
  assert.doesNotMatch(moduleSrc, /new Date|Date\.now|Date\.UTC/);
  assert.doesNotMatch(moduleSrc, /from '\.\//);
  assert.doesNotMatch(moduleSrc, /refund-records|approval-limits/);
});

test('panel ids present in index.html', () => {
  for (const id of [
    'raHeading', 'raSummary', 'raExportBtn', 'raRefundRef', 'raApprover', 'raDate',
    'raAmount', 'raSaveBtn', 'raRemoveId', 'raRemoveBtn', 'raPeriodFrom', 'raPeriodTo',
    'raTierLimit', 'raCheckRef', 'raCheckAmount', 'raCheckDate', 'raCheckBtn',
    'raCheckResult', 'raBody',
  ]) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wiring: import, store key, render function, render call', () => {
  assert.match(appJs, /from '\.\/refund-approval\.js'/);
  assert.match(appJs, /shahdara_refund_approvals_v1/);
  assert.match(appJs, /function renderRefundApprovals\(\)/);
  assert.match(appJs, /renderRefundApprovals\(\);/);
});

test('deployment guard: no standalone OLT word added to app.js by this plan', () => {
  const lines = appJs.split('\n').filter((line) => /\bOLT\b/.test(line));
  assert.equal(lines.length, 0);
});
