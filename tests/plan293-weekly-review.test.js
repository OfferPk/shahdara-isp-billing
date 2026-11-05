import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validWeeklyReviewDate,
  normalizeWeeklyReview,
  normalizeWeeklyReviewList,
  findWeeklyReview,
  recordWeeklyReview,
  removeWeeklyReview,
  weeklyReviewSorted,
  weeklyReviewLatest,
  weeklyReviewNextWeekActions,
  weeklyReviewSummaryText,
  weeklyReviewEntryText,
  weeklyReviewEntryHtml,
  weeklyReviewActionsHtml,
  weeklyReviewAllHtml,
  weeklyReviewCsv,
  weeklyReviewFilename,
} from '../weekly-review.js';

const first = {
  id: 'WR-1',
  week: '2026-11-02',
  collectionsNote: 'Collections steady across all mohallas',
  faultsNote: 'Two drop cable faults fixed',
  decisions: 'Keep the 5th as the due date',
  actions: 'Visit the two overdue customers',
};
const second = {
  id: 'WR-2',
  week: '2026-11-09',
  collectionsNote: 'Slow week, rain kept collectors home',
  faultsNote: '',
  decisions: '',
  actions: 'Catch up on Monday',
};
const third = {
  id: 'WR-3',
  week: '2026-10-26',
  collectionsNote: '',
  faultsNote: 'ONU replaced at one customer',
  decisions: 'Order two spare ONUs',
  actions: '',
};
const fixture = [second, first, third];

test('half-formed notes are refused', () => {
  assert.equal(normalizeWeeklyReview(null), null);
  assert.equal(normalizeWeeklyReview([]), null);
  assert.equal(normalizeWeeklyReview({ ...first, id: '  ' }), null);
  assert.equal(normalizeWeeklyReview({ ...first, week: '' }), null);
  assert.equal(normalizeWeeklyReview({ ...first, week: '2026-13-02' }), null);
  assert.equal(normalizeWeeklyReview({ ...first, week: '02-11-2026' }), null);
  assert.equal(normalizeWeeklyReview({
    id: 'WR-9', week: '2026-11-16', collectionsNote: '', faultsNote: '', decisions: '', actions: '',
  }), null);
  assert.deepEqual(normalizeWeeklyReview(first), first);
  assert.deepEqual(normalizeWeeklyReview({ ...first, collectionsNote: '  Steady  ' }).collectionsNote, 'Steady');
});

test('strict dates: only real calendar dates pass', () => {
  assert.equal(validWeeklyReviewDate('2024-02-29'), true);
  assert.equal(validWeeklyReviewDate('2025-02-29'), false);
  assert.equal(validWeeklyReviewDate('2026-04-31'), false);
  assert.equal(validWeeklyReviewDate('2026-04-30'), true);
  assert.equal(validWeeklyReviewDate('2026-00-02'), false);
  assert.equal(validWeeklyReviewDate('2026-11-00'), false);
  assert.equal(validWeeklyReviewDate('2026-11-32'), false);
  assert.equal(validWeeklyReviewDate(20261102), false);
  assert.equal(validWeeklyReviewDate('2026-11-2'), false);
});

test('one note per week: a second note for the same week is refused', () => {
  const list = recordWeeklyReview([first], { ...first, id: 'WR-9', decisions: 'Different decisions' });
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'WR-1');
  assert.equal(list[0].decisions, 'Keep the 5th as the due date');
  assert.deepEqual(normalizeWeeklyReviewList([first, { ...first, id: 'WR-9' }]).length, 2);
});

test('unknown fields are dropped and the input is never mutated', () => {
  const raw = { ...first, bill: 1000, payment: 'cash', customer: 'Ali', staff: 'Saad', extra: true };
  const before = JSON.stringify(raw);
  const clean = normalizeWeeklyReview(raw);
  assert.deepEqual(Object.keys(clean).sort(), ['actions', 'collectionsNote', 'decisions', 'faultsNote', 'id', 'week']);
  assert.equal(JSON.stringify(raw), before);
});

test('duplicate ids are never rewritten', () => {
  const list = recordWeeklyReview([first], { ...first, week: '2026-11-16', decisions: 'Different decisions' });
  assert.equal(list.length, 1);
  assert.equal(list[0].decisions, 'Keep the 5th as the due date');
  assert.deepEqual(normalizeWeeklyReviewList([first, { ...first, week: '2026-11-16' }]).length, 1);
});

test('find and remove', () => {
  assert.deepEqual(findWeeklyReview(fixture, 'WR-2'), second);
  assert.equal(findWeeklyReview(fixture, 'WR-9'), null);
  assert.equal(findWeeklyReview(fixture, ''), null);
  assert.deepEqual(removeWeeklyReview(fixture, 'WR-1').map((note) => note.id), ['WR-2', 'WR-3']);
  assert.deepEqual(removeWeeklyReview(fixture, 'WR-9').map((note) => note.id), ['WR-2', 'WR-1', 'WR-3']);
});

test('sorting is newest first, then id', () => {
  assert.deepEqual(weeklyReviewSorted(fixture).map((note) => note.id), ['WR-2', 'WR-1', 'WR-3']);
  assert.deepEqual(weeklyReviewSorted([first, second]).map((note) => note.id), ['WR-2', 'WR-1']);
  assert.deepEqual(weeklyReviewLatest(fixture), second);
  assert.equal(weeklyReviewLatest([]), null);
});

test('actions for next week come from the newest note', () => {
  assert.equal(weeklyReviewNextWeekActions(fixture), 'Catch up on Monday');
  assert.equal(weeklyReviewNextWeekActions([third]), '');
  assert.equal(weeklyReviewNextWeekActions([]), '');
  assert.equal(weeklyReviewActionsHtml(fixture).includes('Actions for next week: Catch up on Monday'), true);
  assert.equal(weeklyReviewActionsHtml([third]), '<p>No actions for next week written in the latest review.</p>');
});

test('summary text names the latest week', () => {
  assert.equal(weeklyReviewSummaryText([]), 'No weekly review notes recorded.');
  assert.equal(weeklyReviewSummaryText([first]), '1 weekly review note recorded. Latest review for week of 2026-11-02.');
  assert.equal(weeklyReviewSummaryText(fixture), '3 weekly review notes recorded. Latest review for week of 2026-11-09.');
});

test('entry text names the week and each written field', () => {
  assert.equal(weeklyReviewEntryText(null), 'No weekly review note recorded.');
  assert.equal(
    weeklyReviewEntryText(first),
    'Week of 2026-11-02 — Collections: Collections steady across all mohallas — Faults: Two drop cable faults fixed — Decisions: Keep the 5th as the due date — Actions for next week: Visit the two overdue customers',
  );
  assert.equal(
    weeklyReviewEntryText(second),
    'Week of 2026-11-09 — Collections: Slow week, rain kept collectors home — Actions for next week: Catch up on Monday',
  );
  assert.equal(
    weeklyReviewEntryText(third),
    'Week of 2026-10-26 — Faults: ONU replaced at one customer — Decisions: Order two spare ONUs',
  );
});

test('HTML escapes input and shows the actions for next week', () => {
  const nasty = { ...first, collectionsNote: 'A & B <b>bold</b>' };
  assert.equal(weeklyReviewEntryHtml(nasty).includes('<b>'), false);
  assert.equal(weeklyReviewEntryHtml(nasty).includes('A &amp; B &lt;b&gt;bold&lt;/b&gt;'), true);
  assert.equal(weeklyReviewEntryHtml(null), '<p>No weekly review note recorded.</p>');
  const html = weeklyReviewAllHtml(fixture);
  assert.equal(html.includes('Week of 2026-11-09'), true);
  assert.equal(html.includes('Actions for next week: Catch up on Monday'), true);
  assert.equal(weeklyReviewAllHtml([]), '<p>No weekly review notes recorded.</p>');
});

test('CSV export and filename', () => {
  const csv = weeklyReviewCsv(fixture);
  assert.equal(csv.split('\n')[0], '"id","week","collections note","faults note","decisions","actions for next week"');
  assert.equal(csv.includes('"WR-2","2026-11-09","Slow week, rain kept collectors home","","","Catch up on Monday"'), true);
  assert.equal(csv.split('\n').length, 4);
  assert.equal(csv.split('\n')[1].startsWith('"WR-2"'), true);
  assert.equal(weeklyReviewFilename(), 'weekly-reviews.csv');
});

test('list normalisation drops half-formed rows and keeps the first of each id', () => {
  assert.deepEqual(normalizeWeeklyReviewList(null), []);
  assert.deepEqual(normalizeWeeklyReviewList('nope'), []);
  assert.deepEqual(normalizeWeeklyReviewList([first, null, { ...first, id: '' }]).length, 1);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../weekly-review.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the monthly business review record is untouched', () => {
  const source = readFileSync(new URL('../weekly-review.js', import.meta.url), 'utf8');
  assert.equal(source.includes('review-template.js'), false, 'module must not reference the monthly business review template module');
  assert.equal(existsSync(new URL('../review-template.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'wkHeading', 'wkSummary', 'wkExportBtn', 'wkWeek', 'wkCollections',
    'wkFaults', 'wkDecisions', 'wkActions', 'wkRecordBtn', 'wkRemoveId',
    'wkRemoveBtn', 'wkActionsBody', 'wkBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the weekly review panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './weekly-review.js'"), true);
  assert.equal(source.includes('renderWeeklyReview()'), true);
  assert.equal(source.includes('loadWeeklyReviews()'), true);
  assert.equal(source.includes('shahdara_weekly_reviews_v1'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
