import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validRetentionReviewDay,
  normalizeRetentionReviewSections,
  normalizeRetentionReviewFinding,
  normalizeRetentionReviewFindings,
  normalizeRetentionReview,
  normalizeRetentionReviewList,
  findRetentionReview,
  recordRetentionReview,
  removeRetentionReview,
  retentionReviewsForSection,
  retentionReviewSections,
  overdueRetentionReviews,
  retentionReviewOpenFollowUps,
  retentionReviewSummaryText,
  retentionReviewFindingText,
  retentionReviewEntryText,
  retentionReviewEntryHtml,
  retentionReviewsHtml,
  overdueRetentionReviewsHtml,
  retentionReviewCsv,
  retentionReviewFilename,
} from '../retention-review.js';

const first = {
  id: 'RR-1',
  reviewDate: '2026-11-01',
  reviewer: 'Bike',
  sectionsChecked: ['how long records are kept', 'who may read old bills'],
  findings: [
    { section: 'how long records are kept', finding: 'Old bills kept longer than the policy says', followUpDate: '2026-11-20' },
  ],
  followUpNote: 'Check the archive cupboard next visit.',
  nextReviewDate: '2027-05-01',
};

const second = {
  id: 'RR-2',
  reviewDate: '2026-05-01',
  reviewer: 'Saad',
  sectionsChecked: 'who may read old bills, yearly archive list',
  findings: [
    { section: 'yearly archive list', finding: 'Last year archive list was never written', followUpDate: '2026-05-20' },
  ],
  followUpNote: '',
  nextReviewDate: '2026-11-01',
};

test('validRetentionReviewDay accepts real calendar dates only', () => {
  assert.equal(validRetentionReviewDay('2026-11-05'), true);
  assert.equal(validRetentionReviewDay('2028-02-29'), true);
  assert.equal(validRetentionReviewDay('2027-02-29'), false);
  assert.equal(validRetentionReviewDay('2026-04-31'), false);
  assert.equal(validRetentionReviewDay('2026-13-01'), false);
  assert.equal(validRetentionReviewDay('05-11-2026'), false);
  assert.equal(validRetentionReviewDay(''), false);
  assert.equal(validRetentionReviewDay(null), false);
});

test('sections normalise from an array or a comma string, repeats collapse to the first spelling', () => {
  assert.deepEqual(normalizeRetentionReviewSections(['  Data kept  ', 'data kept', 'Who reads', '']), ['Data kept', 'Who reads']);
  assert.deepEqual(normalizeRetentionReviewSections('who reads, yearly archive list, WHO READS'), ['who reads', 'yearly archive list']);
  assert.deepEqual(normalizeRetentionReviewSections(null), []);
  assert.deepEqual(normalizeRetentionReviewSections(42), []);
});

test('a finding needs a section, plain-words finding, and a strict follow-up date', () => {
  assert.deepEqual(normalizeRetentionReviewFinding(first.findings[0]), first.findings[0]);
  assert.equal(normalizeRetentionReviewFinding({ section: 'x', finding: 'y' }), null);
  assert.equal(normalizeRetentionReviewFinding({ section: 'x', finding: 'y', followUpDate: '2026-02-30' }), null);
  assert.equal(normalizeRetentionReviewFinding({ section: '', finding: 'y', followUpDate: '2026-11-20' }), null);
  assert.equal(normalizeRetentionReviewFinding({ finding: 'y', followUpDate: '2026-11-20' }), null);
  assert.equal(normalizeRetentionReviewFinding(null), null);
});

test('normalizeRetentionReview keeps a well-formed review and drops unknown fields', () => {
  const clean = normalizeRetentionReview({ ...first, billAmount: 3000, customerId: 'CUST-1' });
  assert.equal(clean.billAmount, undefined);
  assert.equal(clean.customerId, undefined);
  assert.deepEqual(clean.sectionsChecked, first.sectionsChecked);
  assert.deepEqual(clean.findings, first.findings);
  assert.equal(clean.nextReviewDate, '2027-05-01');
});

test('normalizeRetentionReview refuses a half-formed review', () => {
  assert.equal(normalizeRetentionReview({ ...first, id: '' }), null);
  assert.equal(normalizeRetentionReview({ ...first, reviewDate: '2026-11-31' }), null);
  assert.equal(normalizeRetentionReview({ ...first, reviewer: '   ' }), null);
  assert.equal(normalizeRetentionReview({ ...first, sectionsChecked: [] }), null);
  assert.equal(normalizeRetentionReview({ ...first, sectionsChecked: ' , ' }), null);
  assert.equal(normalizeRetentionReview(null), null);
  assert.equal(normalizeRetentionReview('RR-1'), null);
});

test('a bad next review date reads empty instead of a guessed date', () => {
  assert.equal(normalizeRetentionReview({ ...first, nextReviewDate: 'not a date' }).nextReviewDate, '');
  assert.equal(normalizeRetentionReview({ ...first, nextReviewDate: '2026-02-30' }).nextReviewDate, '');
  assert.equal(normalizeRetentionReview({ ...first, nextReviewDate: undefined }).nextReviewDate, '');
});

test('a finding with no dated follow-up is dropped, never kept undated', () => {
  const clean = normalizeRetentionReview({
    ...first,
    findings: [
      { section: 'a', finding: 'kept', followUpDate: '2026-11-20' },
      { section: 'b', finding: 'no date given' },
      { section: 'c', finding: 'bad date', followUpDate: '2026-13-01' },
    ],
  });
  assert.equal(clean.findings.length, 1);
  assert.equal(clean.findings[0].section, 'a');
  assert.deepEqual(normalizeRetentionReviewFindings('not a list'), []);
});

test('the list keeps the first review for a duplicate id and drops half-formed rows', () => {
  const clean = normalizeRetentionReviewList([second, first, { ...first, reviewer: 'Someone else' }, { ...first, id: '' }]);
  assert.equal(clean.length, 2);
  assert.equal(clean[1].reviewer, 'Bike');
});

test('record, find, and remove change only the one review', () => {
  const one = recordRetentionReview([], first);
  assert.equal(one.length, 1);
  assert.equal(recordRetentionReview(one, first).length, 1);
  assert.equal(recordRetentionReview(one, { ...first, id: '' }).length, 1);
  assert.equal(findRetentionReview(one, 'RR-1').reviewer, 'Bike');
  assert.equal(findRetentionReview(one, 'RR-9'), null);
  assert.equal(removeRetentionReview(one, 'RR-9').length, 1);
  assert.equal(removeRetentionReview(one, 'RR-1').length, 0);
});

test('reviews for one section match case-insensitively, newest review date first', () => {
  const rows = retentionReviewsForSection([second, first], 'WHO MAY READ OLD BILLS');
  assert.deepEqual(rows.map((entry) => entry.id), ['RR-1', 'RR-2']);
  assert.deepEqual(retentionReviewsForSection([first], 'yearly archive list'), []);
  assert.deepEqual(retentionReviewsForSection([first], ''), []);
});

test('sections across the log list A-Z with the first spelling kept', () => {
  assert.deepEqual(
    retentionReviewSections([second, first]),
    ['how long records are kept', 'who may read old bills', 'yearly archive list'],
  );
  assert.deepEqual(retentionReviewSections([]), []);
});

test('an overdue review is one whose next review date has passed', () => {
  const rows = overdueRetentionReviews([first, second], '2026-11-06');
  assert.deepEqual(rows.map((entry) => entry.id), ['RR-2']);
  assert.deepEqual(overdueRetentionReviews([first, second], '2026-11-01'), []);
  assert.deepEqual(overdueRetentionReviews([first, second], '2027-05-01'), ['RR-2'].map((id) => findRetentionReview([first, second], id)));
  assert.deepEqual(overdueRetentionReviews([first, second], 'not a date'), []);
});

test('a review with no next review date is never listed as overdue', () => {
  const noNext = { ...first, nextReviewDate: '' };
  assert.deepEqual(overdueRetentionReviews([noNext], '2027-01-01'), []);
});

test('overdue reviews sort by the oldest next review date first', () => {
  const third = { ...first, id: 'RR-3', nextReviewDate: '2026-10-15' };
  const rows = overdueRetentionReviews([second, third, first], '2026-11-06');
  assert.deepEqual(rows.map((entry) => entry.id), ['RR-3', 'RR-2']);
});

test('open follow-ups are findings whose dated follow-up has passed', () => {
  const rows = retentionReviewOpenFollowUps([first, second], '2026-11-06');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].reviewId, 'RR-2');
  assert.equal(rows[0].section, 'yearly archive list');
  assert.equal(rows[0].followUpDate, '2026-05-20');
  assert.deepEqual(retentionReviewOpenFollowUps([first, second], '2026-05-20'), []);
  assert.deepEqual(retentionReviewOpenFollowUps([first], 'bad date'), []);
});

test('open follow-ups sort by the earliest follow-up date first', () => {
  const early = { ...first, id: 'RR-0', findings: [{ section: 'a', finding: 'early', followUpDate: '2026-05-10' }] };
  const rows = retentionReviewOpenFollowUps([second, early], '2026-11-06');
  assert.deepEqual(rows.map((row) => row.reviewId), ['RR-0', 'RR-2']);
});

test('summary text counts reviews and findings in plain words', () => {
  assert.equal(retentionReviewSummaryText([]), 'No retention reviews logged.');
  assert.equal(retentionReviewSummaryText([first]), '1 retention review logged, 1 finding with dated follow-ups.');
  assert.equal(retentionReviewSummaryText([first, second]), '2 retention reviews logged, 2 findings with dated follow-ups.');
  assert.equal(retentionReviewSummaryText([{ ...first, findings: [] }]), '1 retention review logged, 0 findings with dated follow-ups.');
});

test('entry text names the date, reviewer, sections, findings, note, and next review date', () => {
  const line = retentionReviewEntryText(first);
  assert.match(line, /2026-11-01/);
  assert.match(line, /review by Bike/);
  assert.match(line, /how long records are kept, who may read old bills/);
  assert.match(line, /Old bills kept longer than the policy says \(follow up by 2026-11-20\)/);
  assert.match(line, /Check the archive cupboard next visit\./);
  assert.match(line, /next review due 2027-05-01/);
  assert.match(retentionReviewEntryText({ ...first, findings: [], followUpNote: '', nextReviewDate: '' }), /no findings/);
  assert.equal(retentionReviewEntryText({ ...first, id: '' }), '');
});

test('finding text is empty for a half-formed finding', () => {
  assert.equal(retentionReviewFindingText({ section: 'a', finding: 'b' }), '');
  assert.equal(retentionReviewFindingText({ section: 'a', finding: 'b', followUpDate: '2026-11-20' }), 'a: b (follow up by 2026-11-20)');
});

test('HTML escapes user text and lists reviews newest first', () => {
  const nasty = { ...first, id: 'RR-9', reviewer: '<b>Boss</b>', reviewDate: '2026-12-01' };
  const html = retentionReviewsHtml([first, nasty]);
  assert.equal(html.includes('<b>Boss</b>'), false);
  assert.match(html, /&lt;b&gt;Boss&lt;\/b&gt;/);
  assert.ok(html.indexOf('2026-12-01') < html.indexOf('2026-11-01'), 'newest review lists first');
  assert.equal(retentionReviewsHtml([]), '<p>No retention reviews logged.</p>');
  assert.equal(retentionReviewEntryHtml({ ...first, id: '' }), '');
});

test('overdue HTML names the due date and the reviewer', () => {
  const html = overdueRetentionReviewsHtml([first, second], '2026-11-06');
  assert.match(html, /RR-2/);
  assert.match(html, /next review was due 2026-11-01/);
  assert.match(html, /reviewed 2026-05-01 by Saad/);
  assert.equal(overdueRetentionReviewsHtml([first], '2026-11-06'), '<p>No overdue retention reviews.</p>');
});

test('CSV has one row per review with the header first', () => {
  const csv = retentionReviewCsv([first, second]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,review date,reviewer,sections checked,findings,next review date,follow-up note');
  assert.equal(lines.length, 3);
  assert.match(lines[1], /RR-1,2026-11-01,Bike/);
  assert.match(lines[2], /RR-2,2026-05-01,Saad/);
  assert.equal(retentionReviewCsv([]), 'id,review date,reviewer,sections checked,findings,next review date,follow-up note');
  assert.equal(retentionReviewFilename(), 'retention-reviews.csv');
});

test('the module is pure: no clock, no fenced module named, no OLT', () => {
  const source = readFileSync(new URL('../retention-review.js', import.meta.url), 'utf8');
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('fetch('), false);
  for (const fenced of ['retention-policy', 'quarterly-snapshot', 'backup-media']) {
    assert.equal(source.includes(fenced), false, `module must not name the fenced module ${fenced}`);
  }
  assert.equal(source.includes('OLT'), false);
});

test('the module never mutates its input', () => {
  const frozen = Object.freeze([
    Object.freeze({ ...first, sectionsChecked: Object.freeze([...first.sectionsChecked]), findings: Object.freeze([Object.freeze({ ...first.findings[0] })]) }),
  ]);
  assert.doesNotThrow(() => {
    normalizeRetentionReviewList(frozen);
    recordRetentionReview(frozen, second);
    retentionReviewSummaryText(frozen);
    retentionReviewsHtml(frozen);
    retentionReviewCsv(frozen);
  });
  assert.equal(frozen[0].reviewer, 'Bike');
});
