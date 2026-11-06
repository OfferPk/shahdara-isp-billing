import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as dataQualityReviewModule from '../data-quality-review.js';
import {
  validDataQualityReviewDay,
  normalizeDataQualityReviewIssue,
  normalizeDataQualityReviewIssues,
  normalizeDataQualityReviewCleared,
  normalizeDataQualityReview,
  normalizeDataQualityReviewList,
  recordDataQualityReview,
  dataQualityReviewRoundFor,
  dataQualityReviewCounts,
  dataQualityReviewCountsAll,
  dataQualityReviewCarriedForward,
  dataQualityReviewSummaryText,
  dataQualityReviewText,
  dataQualityReviewRoundsHtml,
  dataQualityReviewCarriedForwardHtml,
  dataQualityReviewCsv,
  dataQualityReviewFilename,
} from '../data-quality-review.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'data-quality-review.js'), 'utf8');

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function baseRound(overrides = {}) {
  return {
    id: 'R-1',
    roundDate: '2026-11-06',
    reviewer: 'Owner',
    areasChecked: ['Bills', 'Customers'],
    issuesFound: [{ reference: 'Q-1', description: 'wrong amount' }],
    issuesCleared: [],
    ...overrides,
  };
}

test('strict round date: real calendar dates only, leap years handled', () => {
  assert.equal(validDataQualityReviewDay('2026-11-06'), true);
  assert.equal(validDataQualityReviewDay('2028-02-29'), true);
  assert.equal(validDataQualityReviewDay('2027-02-29'), false);
  assert.equal(validDataQualityReviewDay('2026-11-31'), false);
  assert.equal(validDataQualityReviewDay('2026-13-01'), false);
  assert.equal(validDataQualityReviewDay('2026-11-6'), false);
  assert.equal(validDataQualityReviewDay('06-11-2026'), false);
  assert.equal(validDataQualityReviewDay(20261106), false);
  assert.equal(validDataQualityReviewDay(''), false);
});

test('record refuses a round with no id', () => {
  const list = recordDataQualityReview([], baseRound({ id: '' }));
  assert.equal(list.length, 0);
});

test('record refuses a round with a bad round date', () => {
  const list = recordDataQualityReview([], baseRound({ roundDate: '2026-02-30' }));
  assert.equal(list.length, 0);
});

test('record refuses a round with no reviewer', () => {
  const list = recordDataQualityReview([], baseRound({ reviewer: '   ' }));
  assert.equal(list.length, 0);
});

test('record refuses a round with no areas checked', () => {
  assert.equal(recordDataQualityReview([], baseRound({ areasChecked: [] })).length, 0);
  assert.equal(recordDataQualityReview([], baseRound({ areasChecked: '  ' })).length, 0);
});

test('record keeps a well-formed round and drops unknown fields', () => {
  const next = recordDataQualityReview([], baseRound({ amount: 500, customer: 'CUST-1' }));
  assert.equal(next.length, 1);
  assert.deepEqual(Object.keys(next[0]).sort(), ['areasChecked', 'id', 'issuesCleared', 'issuesFound', 'reviewer', 'roundDate']);
  assert.equal(next[0].reviewer, 'Owner');
});

test('record refuses a duplicate id and never rewrites the first round', () => {
  const first = recordDataQualityReview([], baseRound());
  const second = recordDataQualityReview(first, baseRound({ reviewer: 'Saad' }));
  assert.equal(second.length, 1);
  assert.equal(second[0].reviewer, 'Owner');
});

test('areas checked: comma string accepted, trimmed, deduped, first spelling kept', () => {
  const clean = normalizeDataQualityReview(baseRound({ areasChecked: 'Bills, customers , Bills,  Payments ' }));
  assert.deepEqual(clean.areasChecked, ['Bills', 'customers', 'Payments']);
});

test('issues found: a reference is required, string form parses, duplicates collapse', () => {
  assert.equal(normalizeDataQualityReviewIssue(''), null);
  assert.equal(normalizeDataQualityReviewIssue(': no reference'), null);
  assert.equal(normalizeDataQualityReviewIssue({ description: 'no reference' }), null);
  assert.deepEqual(normalizeDataQualityReviewIssue('Q-1: wrong amount'), { reference: 'Q-1', description: 'wrong amount' });
  assert.deepEqual(normalizeDataQualityReviewIssue('Q-2'), { reference: 'Q-2', description: '' });
  const issues = normalizeDataQualityReviewIssues(['Q-1: first', 'q-1: second', 'Q-2: other', '']);
  assert.deepEqual(issues, [
    { reference: 'Q-1', description: 'first' },
    { reference: 'Q-2', description: 'other' },
  ]);
});

test('issues cleared: strings and objects accepted, deduped case-insensitively', () => {
  assert.deepEqual(
    normalizeDataQualityReviewCleared(['Q-1', { reference: 'q-2' }, 'q-1', 'Q-2 ', '']),
    ['Q-1', 'q-2'],
  );
  assert.deepEqual(normalizeDataQualityReviewCleared('Q-1, q-2\nQ-3'), ['Q-1', 'q-2', 'Q-3']);
});

test('counts reconcile per round; cleared counts only refs matching found issues', () => {
  const counts = dataQualityReviewCounts(baseRound({
    issuesFound: [
      { reference: 'Q-1', description: 'wrong amount' },
      { reference: 'Q-2', description: 'missing phone' },
    ],
    issuesCleared: ['Q-1', 'ZZZ'],
  }));
  assert.deepEqual(counts, { found: 2, cleared: 1, uncleared: 1 });
  assert.equal(counts.found, counts.cleared + counts.uncleared);
  assert.deepEqual(dataQualityReviewCounts(null), { found: 0, cleared: 0, uncleared: 0 });
});

test('counts across rounds reconcile on distinct references; summary text matches', () => {
  const rounds = [
    baseRound({ id: 'R-1', roundDate: '2026-11-01', issuesFound: [{ reference: 'Q-1', description: 'a' }, { reference: 'Q-2', description: 'b' }], issuesCleared: [] }),
    baseRound({ id: 'R-2', roundDate: '2026-11-05', issuesFound: [{ reference: 'Q-2', description: 'b again' }, { reference: 'Q-3', description: 'c' }], issuesCleared: ['Q-1'] }),
  ];
  const counts = dataQualityReviewCountsAll(rounds);
  assert.deepEqual(counts, { rounds: 2, found: 3, cleared: 1, uncleared: 2 });
  assert.equal(counts.found, counts.cleared + counts.uncleared);
  assert.equal(dataQualityReviewSummaryText(rounds), '2 review rounds recorded, 3 issues found, 1 cleared, 2 still open.');
});

test('carried forward: never-cleared issues stay, later-round clearing removes them', () => {
  const rounds = [
    baseRound({ id: 'R-1', roundDate: '2026-11-01', issuesFound: [{ reference: 'Q-1', description: 'wrong amount' }, { reference: 'Q-2', description: 'missing phone' }], issuesCleared: [] }),
    baseRound({ id: 'R-2', roundDate: '2026-11-05', issuesFound: [], issuesCleared: ['q-1'] }),
  ];
  const carried = dataQualityReviewCarriedForward(rounds);
  assert.equal(carried.length, 1);
  assert.equal(carried[0].reference, 'Q-2');
  assert.equal(carried[0].roundDate, '2026-11-01');
});

test('carried forward: oldest found first', () => {
  const rounds = [
    baseRound({ id: 'R-2', roundDate: '2026-11-10', issuesFound: [{ reference: 'Q-9', description: 'late' }], issuesCleared: [] }),
    baseRound({ id: 'R-1', roundDate: '2026-11-01', issuesFound: [{ reference: 'Q-1', description: 'early' }], issuesCleared: [] }),
  ];
  const carried = dataQualityReviewCarriedForward(rounds);
  assert.deepEqual(carried.map((issue) => issue.reference), ['Q-1', 'Q-9']);
});

test('carried forward: a reference found in two rounds appears once, at first finding', () => {
  const rounds = [
    baseRound({ id: 'R-1', roundDate: '2026-11-01', issuesFound: [{ reference: 'Q-1', description: 'first' }], issuesCleared: [] }),
    baseRound({ id: 'R-2', roundDate: '2026-11-05', issuesFound: [{ reference: 'Q-1', description: 'second' }], issuesCleared: [] }),
  ];
  const carried = dataQualityReviewCarriedForward(rounds);
  assert.equal(carried.length, 1);
  assert.equal(carried[0].roundDate, '2026-11-01');
  assert.equal(carried[0].description, 'first');
});

test('summary text for no rounds', () => {
  assert.equal(dataQualityReviewSummaryText([]), 'No data quality review rounds recorded.');
  assert.deepEqual(dataQualityReviewCountsAll([]), { rounds: 0, found: 0, cleared: 0, uncleared: 0 });
});

test('round text names date, reviewer, areas, and counts', () => {
  const text = dataQualityReviewText(baseRound({
    issuesFound: [{ reference: 'Q-1', description: 'a' }, { reference: 'Q-2', description: 'b' }],
    issuesCleared: ['Q-1'],
  }));
  assert.equal(text, '2026-11-06 — reviewed by Owner: Bills, Customers checked, 2 found, 1 cleared, 1 still open.');
});

test('HTML escapes markup in reviewer, areas, and issue text', () => {
  const rounds = [baseRound({
    reviewer: '<script>alert(1)</script>',
    areasChecked: ['Bills <b>'],
    issuesFound: [{ reference: 'Q-1', description: '<img src=x>' }],
  })];
  const html = dataQualityReviewRoundsHtml(rounds);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('Bills &lt;b&gt;'));
  assert.ok(html.includes('&lt;img src=x&gt;'));
  const carriedHtml = dataQualityReviewCarriedForwardHtml(rounds);
  assert.ok(!carriedHtml.includes('<img'));
  assert.ok(carriedHtml.includes('&lt;img src=x&gt;'));
});

test('CSV has one row per round with reconciled counts, and the filename is fixed', () => {
  const rounds = [baseRound({
    issuesFound: [{ reference: 'Q-1', description: 'a' }, { reference: 'Q-2', description: 'b' }],
    issuesCleared: ['Q-1'],
  })];
  const csv = dataQualityReviewCsv(rounds);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,roundDate,reviewer,areasChecked,issuesFound,issuesCleared,found,cleared,uncleared');
  assert.equal(lines[1], 'R-1,2026-11-06,Owner,Bills; Customers,Q-1; Q-2,Q-1,2,1,1');
  assert.equal(dataQualityReviewFilename(), 'data-quality-review-rounds.csv');
});

test('inputs are never mutated, even on deep-frozen fixtures', () => {
  const frozenList = deepFreeze([baseRound()]);
  const frozenRound = deepFreeze(baseRound({
    id: 'R-2',
    roundDate: '2026-11-07',
    reviewer: 'Saad',
    areasChecked: 'Customers',
    issuesFound: 'Q-2: missing phone',
    issuesCleared: '',
  }));
  const before = JSON.stringify(frozenList);
  const next = recordDataQualityReview(frozenList, frozenRound);
  assert.equal(next.length, 2);
  assert.equal(JSON.stringify(frozenList), before);
  assert.equal(dataQualityReviewCarriedForward(frozenList).length, 1);
  assert.ok(dataQualityReviewCsv(frozenList).includes('R-1'));
  assert.ok(dataQualityReviewRoundsHtml(frozenList).includes('2026-11-06'));
});

test('normalize list drops invalid entries and keeps valid ones', () => {
  const list = normalizeDataQualityReviewList([
    baseRound(),
    baseRound({ id: '' }),
    null,
    'junk',
    baseRound({ id: 'R-2', roundDate: '2026-11-07' }),
  ]);
  assert.deepEqual(list.map((round) => round.id), ['R-1', 'R-2']);
  assert.deepEqual(normalizeDataQualityReviewList(null), []);
  assert.equal(normalizeDataQualityReview(null), null);
});

test('round lookup finds by id and returns null for a missing id', () => {
  const rounds = [baseRound(), baseRound({ id: 'R-2', roundDate: '2026-11-07' })];
  assert.equal(dataQualityReviewRoundFor(rounds, 'R-2').roundDate, '2026-11-07');
  assert.equal(dataQualityReviewRoundFor(rounds, 'missing'), null);
});

test('purity: no storage, clock, network, page, or version-changing access', () => {
  assert.ok(!/new Date\(/.test(moduleSrc));
  assert.ok(!/Date\.now\(/.test(moduleSrc));
  assert.ok(!/document\./.test(moduleSrc));
  assert.ok(!/localStorage/.test(moduleSrc));
  assert.ok(!/fetch\(/.test(moduleSrc));
  assert.ok(!/window\./.test(moduleSrc));
  assert.ok(!/import /.test(moduleSrc));
  assert.ok(!/\bOLT\b/.test(moduleSrc));
  const exported = Object.keys(dataQualityReviewModule);
  assert.ok(!exported.some((name) => /install|rollback|apply|change|send/i.test(name)));
});

test('fence: module never names the existing data-quality files', () => {
  assert.ok(!moduleSrc.includes('core.js'));
  assert.ok(!moduleSrc.includes('quality-log'));
  assert.ok(!moduleSrc.includes('qa-data-integrity'));
});

test('wiring: app.js imports the module, renders it, and stores it under the dqr key', () => {
  assert.ok(appJs.includes("from './data-quality-review.js'"));
  assert.ok(appJs.includes('renderDataQualityReviews()'));
  assert.ok(appJs.includes('shahdara_dqr_rounds_v1'));
  assert.ok(appJs.includes('dataQualityReviewSummaryText'));
  assert.ok(!/renderDataQualityReviews\(\)\s*;\s*renderDataQualityReviews\(\)/.test(appJs));
});

test('wiring: index.html carries the dqr panel after the Plan 346 panel', () => {
  assert.ok(indexHtml.includes('id="dqrHeading"'));
  assert.ok(indexHtml.includes('id="dqrBody"'));
  assert.ok(indexHtml.includes('id="dqrSummary"'));
  assert.ok(indexHtml.includes('id="dqrSaveBtn"'));
  assert.ok(indexHtml.includes('id="dqrCarriedBody"'));
  assert.ok(indexHtml.indexOf('id="mktHeading"') < indexHtml.indexOf('id="dqrHeading"'));
});
