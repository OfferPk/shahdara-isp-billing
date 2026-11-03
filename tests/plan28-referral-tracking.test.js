import test from 'node:test';
import assert from 'node:assert/strict';

import {
  REFERRAL_STATUS_IDS,
  normalizeReferral,
  normalizeReferrals,
  findReferral,
  upsertReferral,
  removeReferral,
  deriveReferralStatuses,
  buildReferralReport,
  referralSummaryText,
  referralReportHtml,
  referralReportCsv,
  referralReportFilename,
} from '../referral-tracking.js';

const referral = (referred, referrer, date, status, note) => ({
  referredCustomerId: referred, referrerCustomerId: referrer, date, status, note,
});
const names = { c1: 'Ahmed', c2: 'Bilal', c3: 'Chanda', c4: 'Danish', c5: 'Emaan' };

test('catalogue: exactly the plan statuses pending, activated, not eligible', () => {
  assert.deepEqual([...REFERRAL_STATUS_IDS], ['pending', 'activated', 'not_eligible']);
});

test('date validation: real dates kept, 2026-02-30 and bad formats rejected', () => {
  assert.equal(normalizeReferral(referral('c1', 'c2', '2026-03-05')).date, '2026-03-05');
  assert.equal(normalizeReferral(referral('c1', 'c2', '2024-02-29')).date, '2024-02-29');
  assert.equal(normalizeReferral(referral('c1', 'c2', '2026-02-30')).date, null);
  assert.equal(normalizeReferral(referral('c1', 'c2', '2026-13-01')).date, null);
  assert.equal(normalizeReferral(referral('c1', 'c2', '05-03-2026')).date, null);
  assert.equal(normalizeReferral(referral('c1', 'c2', undefined)).date, null);
});

test('normalisation: missing pair or self-referral rejected, unknown status falls back to pending', () => {
  assert.equal(normalizeReferral(referral('', 'c2')), null);
  assert.equal(normalizeReferral(referral('c1', '')), null);
  assert.equal(normalizeReferral(referral('c1', 'c1')), null);
  assert.equal(normalizeReferral(referral(null, null)), null);
  assert.equal(normalizeReferral(referral('c1', 'c2', null, 'bogus')).status, 'pending');
  assert.equal(normalizeReferral(referral('c1', 'c2', null, 'not_eligible')).status, 'not_eligible');
  assert.equal(normalizeReferral(referral('  c1 ', ' c2 ', null, null, '  neighbour  ')).note, 'neighbour');
  assert.equal(normalizeReferral(referral('c1', 'c2')).note, null);
});

test('normalisation never mutates its input', () => {
  const input = referral('c1', 'c2', '2026-03-05', 'pending', 'x');
  const snapshot = { ...input };
  normalizeReferral(input);
  assert.deepEqual(input, snapshot);
});

test('one record per referred customer: upsert replaces, never piles up', () => {
  const first = upsertReferral([], referral('c1', 'c2', '2026-03-01'));
  assert.equal(first.length, 1);
  const second = upsertReferral(first, referral('c1', 'c3', '2026-03-02'));
  assert.equal(second.length, 1);
  assert.equal(second[0].referrerCustomerId, 'c3');
  assert.equal(first[0].referrerCustomerId, 'c2');
  assert.equal(upsertReferral(first, referral('', 'c2')).length, 1);
});

test('find and remove by referred customer', () => {
  const rows = [referral('c1', 'c2'), referral('c3', 'c2')];
  assert.equal(findReferral(rows, 'c1').referrerCustomerId, 'c2');
  assert.equal(findReferral(rows, 'c9'), null);
  assert.equal(findReferral(rows, ''), null);
  assert.equal(removeReferral(rows, 'c1').length, 1);
  assert.equal(removeReferral(rows, 'c9').length, 2);
  assert.equal(rows.length, 2);
});

test('activation gate: activated set activates, not eligible is a preserved override, rest pending', () => {
  const rows = [
    referral('c1', 'c2', '2026-03-01', 'pending'),
    referral('c3', 'c2', '2026-03-01', 'pending'),
    referral('c4', 'c2', '2026-03-01', 'not_eligible'),
  ];
  const derived = deriveReferralStatuses(rows, ['c1', 'c4']);
  assert.equal(derived.find((r) => r.referredCustomerId === 'c1').status, 'activated');
  assert.equal(derived.find((r) => r.referredCustomerId === 'c3').status, 'pending');
  assert.equal(derived.find((r) => r.referredCustomerId === 'c4').status, 'not_eligible');
  assert.equal(rows[0].status, 'pending');
});

test('activation gate: stored activated without the gate falls back to pending', () => {
  const derived = deriveReferralStatuses([referral('c1', 'c2', null, 'activated')], []);
  assert.equal(derived[0].status, 'pending');
});

test('report: groups by referrer with counts, sorted activated then total then name', () => {
  const rows = deriveReferralStatuses([
    referral('c1', 'c2', '2026-03-02'),
    referral('c3', 'c2', '2026-03-01'),
    referral('c4', 'c5', '2026-03-01'),
    referral('c5', 'c3', '2026-03-01', 'not_eligible'),
  ], ['c1', 'c4']);
  const report = buildReferralReport(rows, { names });
  assert.equal(report.length, 3);
  assert.equal(report[0].referrerCustomerId, 'c2');
  assert.equal(report[0].activated, 1);
  assert.equal(report[0].total, 2);
  assert.equal(report[0].pending, 1);
  assert.equal(report[1].referrerCustomerId, 'c5');
  assert.equal(report[1].activated, 1);
  assert.equal(report[2].referrerCustomerId, 'c3');
  assert.equal(report[2].notEligible, 1);
  assert.deepEqual(report[0].referrals.map((r) => r.referredCustomerId), ['c3', 'c1']);
});

test('report: unknown name falls back to the id, never a guessed name', () => {
  const report = buildReferralReport([referral('c9', 'c8')], { names });
  assert.equal(report[0].referrerName, 'c8');
  assert.equal(report[0].referrals[0].referredName, 'c9');
});

test('report: a referral grants nothing — no money field exists on any row', () => {
  const report = buildReferralReport([referral('c1', 'c2')], { names });
  const row = report[0].referrals[0];
  assert.ok(!('amount' in row) && !('credit' in row) && !('discount' in row) && !('bill' in row));
});

test('summary text counts referrals, statuses and referrers', () => {
  const rows = deriveReferralStatuses([
    referral('c1', 'c2'), referral('c3', 'c2'), referral('c4', 'c5', null, 'not_eligible'),
  ], ['c1']);
  assert.equal(referralSummaryText(rows), '3 referrals · 1 activated · 1 pending · 1 not eligible · 2 referrers');
  assert.equal(referralSummaryText([]), '0 referrals · 0 activated · 0 pending · 0 not eligible · 0 referrers');
});

test('HTML: escapes names and shows not recorded for a missing date', () => {
  const report = buildReferralReport([referral('c1', 'c2')], { names: { c1: '<Ahmed & Co>', c2: 'Bilal' } });
  const html = referralReportHtml(report);
  assert.ok(html.includes('&lt;Ahmed &amp; Co&gt;'));
  assert.ok(!html.includes('<Ahmed'));
  assert.ok(html.includes('Not recorded'));
  assert.equal(referralReportHtml([]), '<p class="empty-state">No referral records yet.</p>');
});

test('HTML: pending rows offer Mark not eligible, not-eligible rows do not', () => {
  const report = buildReferralReport([
    referral('c1', 'c2'), referral('c3', 'c2', null, 'not_eligible'),
  ], { names });
  const html = referralReportHtml(report);
  assert.ok(html.includes('data-referral-not-eligible="c1"'));
  assert.ok(!html.includes('data-referral-not-eligible="c3"'));
});

test('CSV: header, rows, quoting, and filename', () => {
  const report = buildReferralReport([referral('c1', 'c2', '2026-03-01')], { names: { c1: 'Ahmed, Jr', c2: 'Bilal' } });
  const csv = referralReportCsv(report);
  assert.ok(csv.startsWith('referrer_id,referrer_name,referred_id,referred_name,date,status'));
  assert.ok(csv.includes('"Ahmed, Jr"'));
  assert.ok(csv.includes('2026-03-01,Pending'));
  assert.equal(referralReportFilename(), 'referral-report.csv');
});
