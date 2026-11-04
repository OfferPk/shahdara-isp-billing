import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  APPROVAL_KINDS,
  validApprovalDate,
  normalizeTier,
  normalizeTierList,
  upsertTier,
  removeTier,
  findTier,
  tierForAmount,
  normalizeApproval,
  normalizeApprovalList,
  addApproval,
  findApproval,
  approvalsForCustomer,
  approvalExpired,
  approvalsForReview,
  checkPosting,
  approvalSummaryText,
  approvalHtml,
  approvalCsv,
  approvalFilename,
} from '../approval-limits.js';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'approval-limits.js'), 'utf8');

const tiers = () => ([
  { id: 'collector', role: 'Collector', upToCents: 50000 },
  { id: 'owner', role: 'Owner', upToCents: 500000 },
]);

const approval = (overrides = {}) => ({
  id: 'APPR-1',
  customerId: 'CUST-76',
  customerName: 'Orient school',
  kind: 'discount',
  tierId: 'owner',
  approver: 'Owner',
  reason: 'Festival goodwill',
  amountCents: 200000,
  date: '2026-11-04',
  expiresDate: '2026-12-31',
  ...overrides,
});

test('strict dates: real calendar dates only', () => {
  assert.equal(validApprovalDate('2026-11-04'), true);
  assert.equal(validApprovalDate('2024-02-29'), true);
  assert.equal(validApprovalDate('2026-02-30'), false);
  assert.equal(validApprovalDate('2025-02-29'), false);
  assert.equal(validApprovalDate('2026-13-01'), false);
  assert.equal(validApprovalDate('04-11-2026'), false);
  assert.equal(validApprovalDate(''), false);
});

test('tiers: half-formed refused, unknown fields dropped, sorted by limit', () => {
  assert.equal(normalizeTier({ id: '', role: 'Owner', upToCents: 100 }), null);
  assert.equal(normalizeTier({ id: 'o', role: '', upToCents: 100 }), null);
  assert.equal(normalizeTier({ id: 'o', role: 'Owner', upToCents: 0 }), null);
  assert.equal(normalizeTier({ id: 'o', role: 'Owner', upToCents: -5 }), null);
  const tier = normalizeTier({ id: 'o', role: 'Owner', upToCents: 100, billId: 'BILL-1' });
  assert.deepEqual(tier, { id: 'o', role: 'Owner', upToCents: 100 });
  const sorted = normalizeTierList([
    { id: 'owner', role: 'Owner', upToCents: 500000 },
    { id: 'collector', role: 'Collector', upToCents: 50000 },
    { id: 'owner', role: 'Owner again', upToCents: 1 },
  ]);
  assert.deepEqual(sorted.map((item) => item.id), ['collector', 'owner']);
});

test('tierForAmount: exactly at the limit is covered, one cent over moves on', () => {
  assert.equal(tierForAmount(tiers(), 50000).id, 'collector');
  assert.equal(tierForAmount(tiers(), 50001).id, 'owner');
  assert.equal(tierForAmount(tiers(), 500000).id, 'owner');
  assert.equal(tierForAmount(tiers(), 500001), null);
  assert.equal(tierForAmount(tiers(), 0), null);
});

test('upsert/remove/find tiers: duplicate id leaves the list unchanged', () => {
  const before = tiers();
  assert.deepEqual(upsertTier(before, { id: 'collector', role: 'Someone else', upToCents: 1 }), normalizeTierList(before));
  assert.equal(upsertTier(before, { id: 'x', role: '', upToCents: 1 }).length, 2);
  assert.equal(upsertTier(before, { id: 'senior', role: 'Senior', upToCents: 150000 }).length, 3);
  assert.deepEqual(removeTier(before, 'collector').map((item) => item.id), ['owner']);
  assert.equal(findTier(before, 'owner').role, 'Owner');
  assert.equal(findTier(before, 'nobody'), null);
});

test('approvals: tier, approver, and reason are mandatory', () => {
  assert.equal(normalizeApproval(approval({ tierId: '' })), null);
  assert.equal(normalizeApproval(approval({ approver: '  ' })), null);
  assert.equal(normalizeApproval(approval({ reason: '' })), null);
  assert.equal(normalizeApproval(approval({ kind: 'refund' })), null);
  assert.equal(normalizeApproval(approval({ amountCents: 0 })), null);
  assert.equal(normalizeApproval(approval({ date: '2026-02-30' })), null);
  assert.equal(normalizeApproval(approval({ expiresDate: '2026-11-03' })), null);
  const item = normalizeApproval(approval({ billId: 'BILL-9', amountCents: 2000 }));
  assert.equal(item.amountCents, 2000);
  const rupees = normalizeApproval(approval({ amountCents: undefined, amount: 2000 }));
  assert.equal(rupees.amountCents, 200000);
  assert.equal('billId' in item, false);
});

test('addApproval: duplicate id and half-formed records leave the list unchanged', () => {
  const first = addApproval([], approval());
  assert.equal(first.length, 1);
  assert.equal(addApproval(first, approval({ reason: 'Different reason' })), null);
  assert.equal(addApproval(first, approval({ id: 'APPR-2', reason: '' })), null);
  assert.equal(addApproval(first, approval({ id: 'APPR-2' })).length, 2);
  assert.equal(findApproval(first, 'APPR-1').approver, 'Owner');
  assert.equal(findApproval(first, 'APPR-9'), null);
  assert.deepEqual(approvalsForCustomer(first, 'CUST-76').map((item) => item.id), ['APPR-1']);
  assert.deepEqual(approvalsForCustomer(first, 'CUST-1'), []);
});

test('expiry: valid on the expiry date, expired the day after', () => {
  const item = approval();
  assert.equal(approvalExpired(item, '2026-12-31'), false);
  assert.equal(approvalExpired(item, '2027-01-01'), true);
  assert.equal(approvalExpired(item, 'not-a-date'), true);
  assert.equal(approvalExpired({ ...item, date: '2026-02-30' }, '2026-12-31'), true);
});

test('approvalsForReview: filters and expired flags on the review date', () => {
  const list = normalizeApprovalList([
    approval(),
    approval({ id: 'APPR-2', kind: 'waiver', customerId: 'CUST-1', date: '2026-11-05', expiresDate: '2026-11-10' }),
  ]);
  const rows = approvalsForReview(list, { onDate: '2026-11-20' });
  assert.deepEqual(rows.map((item) => item.expired), [false, true]);
  assert.deepEqual(approvalsForReview(list, { customerId: 'CUST-1', onDate: '2026-11-01' }).map((item) => item.id), ['APPR-2']);
  assert.deepEqual(approvalsForReview(list, { kind: 'waiver', onDate: '2026-11-01' }).length, 1);
});

test('checkPosting: within the operator tier, with a reason, is allowed', () => {
  const result = checkPosting({ tiers: tiers(), operatorTierId: 'collector', amountCents: 50000, kind: 'discount', reason: 'Goodwill', approvals: [], date: '2026-11-04' });
  assert.equal(result.allowed, true);
  assert.equal(result.tier.id, 'collector');
  assert.equal(result.refusal, '');
});

test('checkPosting: above the operator tier without a higher approval is refused', () => {
  const result = checkPosting({ tiers: tiers(), operatorTierId: 'collector', amountCents: 200000, kind: 'discount', reason: 'Goodwill', approvals: [], date: '2026-11-04' });
  assert.equal(result.allowed, false);
  assert.equal(result.tier.id, 'owner');
  assert.match(result.refusal, /higher approval/);
});

test('checkPosting: a valid higher approval covering the amount allows the posting', () => {
  const result = checkPosting({ tiers: tiers(), operatorTierId: 'collector', amountCents: 200000, kind: 'discount', reason: 'Goodwill', approvals: [approval()], date: '2026-11-04' });
  assert.equal(result.allowed, true);
  assert.equal(result.tier.id, 'owner');
});

test('checkPosting: expired, smaller, wrong-kind, or low-tier approvals do not allow it', () => {
  const base = { tiers: tiers(), operatorTierId: 'collector', amountCents: 200000, kind: 'discount', reason: 'Goodwill', date: '2026-11-04' };
  assert.equal(checkPosting({ ...base, approvals: [approval()], date: '2027-01-05' }).allowed, false);
  assert.equal(checkPosting({ ...base, approvals: [approval({ amountCents: 199999 })] }).allowed, false);
  assert.equal(checkPosting({ ...base, approvals: [approval({ kind: 'waiver' })] }).allowed, false);
  assert.equal(checkPosting({ ...base, approvals: [approval({ tierId: 'collector' })] }).allowed, false);
});

test('checkPosting: missing reason, bad amount, unknown tier, or bad date is refused', () => {
  const base = { tiers: tiers(), operatorTierId: 'collector', amountCents: 10000, kind: 'waiver', reason: 'Hardship', approvals: [], date: '2026-11-04' };
  assert.equal(checkPosting({ ...base, reason: '  ' }).allowed, false);
  assert.equal(checkPosting({ ...base, amountCents: 0 }).allowed, false);
  assert.equal(checkPosting({ ...base, operatorTierId: 'nobody' }).allowed, false);
  assert.equal(checkPosting({ ...base, date: '2026-02-30' }).allowed, false);
  assert.equal(checkPosting({ ...base, kind: 'promo' }).allowed, false);
});

test('checkPosting and lists never mutate their inputs', () => {
  const list = [approval()];
  const snapshot = JSON.stringify(list);
  checkPosting({ tiers: tiers(), operatorTierId: 'collector', amountCents: 200000, kind: 'discount', reason: 'Goodwill', approvals: list, date: '2026-11-04' });
  approvalsForReview(list, { onDate: '2026-11-04' });
  assert.equal(JSON.stringify(list), snapshot);
});

test('summary, HTML escaping, CSV quoting, filename', () => {
  assert.equal(approvalSummaryText([]), 'No approvals recorded yet.');
  assert.match(approvalSummaryText([approval()]), /1 approval recorded \(1 discount, 0 waivers\), totalling PKR 2,000/);
  const html = approvalHtml(approval({ reason: '<b>bold</b>', approver: 'A & B' }));
  assert.match(html, /&lt;b&gt;bold&lt;\/b&gt;/);
  assert.match(html, /A &amp; B/);
  const csv = approvalCsv([approval({ reason: 'Say "hi", please' })]);
  assert.match(csv, /^id,customer,kind,tier,approver,reason,amount_cents,date,expires_date\n/);
  assert.match(csv, /"Say ""hi"", please"/);
  assert.equal(approvalFilename(), 'approval-limits.csv');
});

test('purity fence: no promo, dispute, storage, or DOM access', () => {
  assert.equal(/promo-offers|promoOffers/.test(source), false);
  assert.equal(/dispute-resolutions|disputeResolutions|dispute_signoff/.test(source), false);
  assert.equal(/localStorage|document\.|window\.|fetch\(/.test(source), false);
  assert.equal(/^import |from '\.\//m.test(source), false);
});
