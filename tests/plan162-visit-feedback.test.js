import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  VISIT_FEEDBACK_RATINGS,
  normalizeVisitFeedback,
  normalizeVisitFeedbackList,
  findVisitFeedback,
  upsertVisitFeedback,
  removeVisitFeedback,
  markVisitFeedbackReviewed,
  feedbackForCustomer,
  feedbackForVisit,
  unreviewedNotSatisfied,
  feedbackCustomers,
  feedbackCounts,
  feedbackSummaryText,
  feedbackAllHtml,
  feedbackCustomerHtml,
  feedbackUnreviewedHtml,
  feedbackCsv,
  feedbackFilename,
} from '../visit-feedback.js';

const dir = dirname(fileURLToPath(import.meta.url));

const fb = (over = {}) => ({
  id: 'FB-1',
  visitId: 'VIS-1',
  customer: 'Ahmed',
  date: '2026-11-04',
  rating: 'satisfied',
  comment: 'Net is fine now',
  reviewed: false,
  ...over,
});

test('strict dates: 31-day months pass, Feb 30 and Apr 31 refused, Feb 29 leap only', () => {
  assert.equal(normalizeVisitFeedback(fb({ date: '2026-08-31' })).date, '2026-08-31');
  assert.equal(normalizeVisitFeedback(fb({ date: '2026-10-31' })).date, '2026-10-31');
  assert.equal(normalizeVisitFeedback(fb({ date: '2026-12-31' })).date, '2026-12-31');
  assert.equal(normalizeVisitFeedback(fb({ date: '2026-02-30' })), null);
  assert.equal(normalizeVisitFeedback(fb({ date: '2026-04-31' })), null);
  assert.equal(normalizeVisitFeedback(fb({ date: '2024-02-29' })).date, '2024-02-29');
  assert.equal(normalizeVisitFeedback(fb({ date: '2026-02-29' })), null);
});

test('half-formed refusal: no visit, no customer, no date, no rating, bad rating', () => {
  assert.equal(normalizeVisitFeedback(fb({ visitId: '' })), null);
  assert.equal(normalizeVisitFeedback(fb({ customer: '  ' })), null);
  assert.equal(normalizeVisitFeedback(fb({ date: '' })), null);
  assert.equal(normalizeVisitFeedback(fb({ rating: '' })), null);
  assert.equal(normalizeVisitFeedback(fb({ rating: 'happy' })), null);
  assert.equal(normalizeVisitFeedback(fb({ rating: 'unhappy' })), null);
  assert.equal(normalizeVisitFeedback(fb({ id: '' })), null);
});

test('rating normalization: space and underscore spellings fold to the fixed three', () => {
  assert.equal(normalizeVisitFeedback(fb({ rating: 'partly satisfied' })).rating, 'partly-satisfied');
  assert.equal(normalizeVisitFeedback(fb({ rating: 'NOT_SATISFIED' })).rating, 'not-satisfied');
  assert.equal(normalizeVisitFeedback(fb({ rating: 'Satisfied' })).rating, 'satisfied');
  assert.deepEqual(VISIT_FEEDBACK_RATINGS, ['satisfied', 'partly-satisfied', 'not-satisfied']);
});

test('unknown-field drop: no visit-outcome, bill, payment, or status field can creep in', () => {
  const record = normalizeVisitFeedback(
    fb({ billTotal: 1500, paymentId: 'PAY-1', status: 'closed', visitOutcome: 'done' }),
  );
  assert.equal(record.billTotal, undefined);
  assert.equal(record.paymentId, undefined);
  assert.equal(record.status, undefined);
  assert.equal(record.visitOutcome, undefined);
});

test('duplicate-id rules: identical re-save unchanged, different figures refused', () => {
  const before = [fb()];
  assert.deepEqual(upsertVisitFeedback(before, fb()), before);
  assert.deepEqual(upsertVisitFeedback(before, fb({ rating: 'not-satisfied' })), before);
  assert.deepEqual(upsertVisitFeedback(before, fb({ comment: 'Changed' })), before);
});

test('one feedback per visit: a second record for the same visit id is refused', () => {
  const before = [fb()];
  assert.deepEqual(upsertVisitFeedback(before, fb({ id: 'FB-2' })), before);
  assert.deepEqual(upsertVisitFeedback(before, fb({ id: 'FB-2', customer: 'Bilal' })), before);
  assert.equal(upsertVisitFeedback(before, fb({ id: 'FB-2', visitId: 'VIS-2' })).length, 2);
});

test('find and remove', () => {
  const list = [fb(), fb({ id: 'FB-2', visitId: 'VIS-2', customer: 'Bilal' })];
  assert.equal(findVisitFeedback(list, 'FB-2').customer, 'Bilal');
  assert.equal(findVisitFeedback(list, 'FB-9'), null);
  assert.deepEqual(removeVisitFeedback(list, 'FB-1').map((item) => item.id), ['FB-2']);
  assert.equal(removeVisitFeedback(list, 'FB-9').length, 2);
});

test('customer listing: newest first, case-insensitive match', () => {
  const list = [
    fb({ id: 'FB-1', date: '2026-11-01' }),
    fb({ id: 'FB-2', visitId: 'VIS-2', date: '2026-11-04' }),
    fb({ id: 'FB-3', visitId: 'VIS-3', customer: 'Bilal', date: '2026-11-03' }),
  ];
  assert.deepEqual(
    feedbackForCustomer(list, 'ahmed').map((item) => item.id),
    ['FB-2', 'FB-1'],
  );
  assert.deepEqual(feedbackForCustomer(list, ''), []);
  assert.deepEqual(feedbackForCustomer(list, 'Nobody'), []);
});

test('visit listing: only that visit id, newest first', () => {
  const list = [
    fb(),
    fb({ id: 'FB-2', visitId: 'VIS-2', date: '2026-11-05' }),
  ];
  assert.deepEqual(feedbackForVisit(list, 'VIS-1').map((item) => item.id), ['FB-1']);
  assert.deepEqual(feedbackForVisit(list, 'VIS-9'), []);
});

test('unreviewed not-satisfied list: flagged until the operator marks it reviewed', () => {
  const list = [
    fb({ id: 'FB-1', rating: 'not-satisfied', date: '2026-11-01' }),
    fb({ id: 'FB-2', visitId: 'VIS-2', rating: 'not-satisfied', reviewed: true, date: '2026-11-02' }),
    fb({ id: 'FB-3', visitId: 'VIS-3', rating: 'satisfied', date: '2026-11-03' }),
  ];
  assert.deepEqual(unreviewedNotSatisfied(list).map((item) => item.id), ['FB-1']);
  const marked = markVisitFeedbackReviewed(list, 'FB-1');
  assert.deepEqual(unreviewedNotSatisfied(marked), []);
  assert.equal(marked.find((item) => item.id === 'FB-1').reviewed, true);
  assert.equal(marked.find((item) => item.id === 'FB-1').rating, 'not-satisfied');
  assert.deepEqual(markVisitFeedbackReviewed(list, 'FB-9'), list);
});

test('customers list: A-Z, first spelling kept', () => {
  const list = [
    fb({ customer: 'Bilal' }),
    fb({ id: 'FB-2', visitId: 'VIS-2', customer: 'ahmed' }),
    fb({ id: 'FB-3', visitId: 'VIS-3', customer: 'AHMED' }),
  ];
  assert.deepEqual(feedbackCustomers(list), ['Bilal', 'ahmed']);
});

test('counts are simple totals only: no blended score, average, or percentage', () => {
  const list = [
    fb({ rating: 'satisfied' }),
    fb({ id: 'FB-2', visitId: 'VIS-2', rating: 'partly-satisfied' }),
    fb({ id: 'FB-3', visitId: 'VIS-3', rating: 'not-satisfied' }),
    fb({ id: 'FB-4', visitId: 'VIS-4', rating: 'not-satisfied', reviewed: true }),
  ];
  assert.deepEqual(feedbackCounts(list), {
    total: 4,
    satisfied: 1,
    partlySatisfied: 1,
    notSatisfied: 2,
    unreviewedNotSatisfied: 1,
  });
  assert.equal(feedbackCounts([]).total, 0);
});

test('summary text', () => {
  assert.equal(feedbackSummaryText([]), 'No visit feedback recorded yet.');
  assert.equal(
    feedbackSummaryText([fb(), fb({ id: 'FB-2', visitId: 'VIS-2', rating: 'not-satisfied' })]),
    '2 feedback records — 1 satisfied, 0 partly satisfied, 1 not satisfied (1 unreviewed).',
  );
});

test('customer HTML flags unreviewed not-satisfied and escapes input', () => {
  const list = [
    fb({ rating: 'not-satisfied', comment: '<script>alert(1)</script>' }),
  ];
  const html = feedbackCustomerHtml(list, 'Ahmed');
  assert.match(html, /needs review/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(feedbackCustomerHtml(list, 'Nobody'), /No visit feedback for this customer/);
});

test('all HTML newest first; unreviewed HTML only lists unreviewed not-satisfied', () => {
  const list = [
    fb({ date: '2026-11-01' }),
    fb({ id: 'FB-2', visitId: 'VIS-2', date: '2026-11-04', rating: 'not-satisfied' }),
  ];
  const all = feedbackAllHtml(list);
  assert.ok(all.indexOf('2026-11-04') < all.indexOf('2026-11-01'));
  assert.match(feedbackUnreviewedHtml(list), /VIS-2/);
  assert.doesNotMatch(feedbackUnreviewedHtml(list), /VIS-1/);
  assert.match(feedbackUnreviewedHtml([]), /No unreviewed not-satisfied feedback/);
});

test('CSV and filename', () => {
  const csv = feedbackCsv([fb({ comment: 'Good, fast' })]);
  assert.ok(csv.startsWith('id,visitId,customer,date,rating,comment,reviewed'));
  assert.match(csv, /"Good, fast"/);
  assert.equal(feedbackFilename(), 'visit-feedback.csv');
});

test('non-mutation: inputs are never changed', () => {
  const raw = fb({ rating: '  NOT-SATISFIED ' });
  const snapshot = JSON.stringify(raw);
  normalizeVisitFeedback(raw);
  upsertVisitFeedback([], raw);
  assert.equal(JSON.stringify(raw), snapshot);
  const list = [fb()];
  const before = JSON.stringify(list);
  markVisitFeedbackReviewed(list, 'FB-1');
  assert.equal(JSON.stringify(list), before);
});

test('normalize list drops half-formed, duplicate ids, and duplicate visits', () => {
  const list = normalizeVisitFeedbackList([
    fb(),
    fb({ id: 'FB-1', comment: 'Different' }),
    fb({ id: 'FB-2' }),
    fb({ id: 'FB-3', visitId: 'VIS-3', rating: 'bad' }),
    fb({ id: 'FB-4', visitId: 'VIS-4' }),
  ]);
  assert.deepEqual(list.map((item) => item.id), ['FB-1', 'FB-4']);
});

test('purity fence: no imports, storage, clock, or network use', () => {
  const src = readFileSync(join(dir, '..', 'visit-feedback.js'), 'utf8');
  assert.doesNotMatch(src, /^\s*import\s/m);
  assert.doesNotMatch(src, /localStorage|fetch\(|XMLHttpRequest|Date\.now|new Date\(/);
});

test('panel ids present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['fbCustomer', 'fbVisit', 'fbDate', 'fbRating', 'fbComment', 'fbSaveBtn', 'fbReviewBtn', 'fbRemoveId', 'fbRemoveBtn', 'fbExportBtn', 'fbFilter', 'fbCustomerBody', 'fbUnreviewedBody', 'fbBody', 'fbSummary']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
