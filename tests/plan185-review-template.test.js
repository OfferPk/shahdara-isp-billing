import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isReviewMonth,
  normalizeReviewTemplate,
  normalizeReviewTemplateList,
  findReviewTemplate,
  recordReviewTemplate,
  removeReviewTemplate,
  reviewTemplateSections,
  composeReview,
  reviewTemplateStarters,
  reviewTemplateSummaryText,
  reviewTemplateText,
  reviewTemplateHtml,
  reviewTemplateCsv,
  reviewTemplateFilename,
} from '../review-template.js';

const dir = dirname(fileURLToPath(import.meta.url));

const template = (over = {}) => ({
  id: 'RT-1',
  name: 'Monthly business review',
  sections: [
    { key: 'collections', heading: 'Collections', source: 'Owner Khata report' },
    { key: 'notes', heading: 'Owner notes', source: '' },
  ],
  ...over,
});

test('half-formed templates are refused', () => {
  assert.equal(normalizeReviewTemplate(null), null);
  assert.equal(normalizeReviewTemplate({ name: 'X', sections: [{ heading: 'A' }] }), null);
  assert.equal(normalizeReviewTemplate({ id: 'RT-1', sections: [{ heading: 'A' }] }), null);
  assert.equal(normalizeReviewTemplate({ id: 'RT-1', name: 'X', sections: [] }), null);
  assert.equal(normalizeReviewTemplate({ id: 'RT-1', name: 'X', sections: [{ source: 'Y' }] }), null);
});

test('review months are strict YYYY-MM', () => {
  assert.equal(isReviewMonth('2026-11'), true);
  assert.equal(isReviewMonth('2026-13'), false);
  assert.equal(isReviewMonth('2026-1'), false);
  assert.equal(isReviewMonth('2026-11-01'), false);
  assert.equal(isReviewMonth('Nov 2026'), false);
  assert.equal(composeReview(template(), '2026-13'), null);
  assert.equal(composeReview(template(), 'not-a-month'), null);
});

test('section keys fall back to a slug of the heading', () => {
  const entry = normalizeReviewTemplate(template({ sections: [{ heading: 'Bills Issued', source: 'Billing run log' }] }));
  assert.equal(entry.sections[0].key, 'bills-issued');
  assert.equal(entry.sections[0].source, 'Billing run log');
});

test('unknown fields are dropped from templates and sections', () => {
  const entry = normalizeReviewTemplate(template({ billTotal: 500, sections: [{ heading: 'A', payment: 1, rating: 5 }] }));
  assert.equal('billTotal' in entry, false);
  assert.equal('payment' in entry.sections[0], false);
  assert.equal('rating' in entry.sections[0], false);
});

test('duplicate section keys keep only the first', () => {
  const entry = normalizeReviewTemplate(template({
    sections: [
      { key: 'Collections', heading: 'Collections', source: 'Owner Khata report' },
      { key: 'collections', heading: 'Collections again', source: 'Other report' },
    ],
  }));
  assert.equal(entry.sections.length, 1);
  assert.equal(entry.sections[0].source, 'Owner Khata report');
});

test('duplicate template ids are never rewritten', () => {
  const first = recordReviewTemplate([], template());
  assert.equal(recordReviewTemplate(first, template()).length, 1);
  const changed = recordReviewTemplate(first, template({ name: 'Different name' }));
  assert.equal(changed.length, 1);
  assert.equal(changed[0].name, 'Monthly business review');
});

test('find and remove work by id', () => {
  const list = recordReviewTemplate([], template());
  assert.equal(findReviewTemplate(list, 'rt-1').name, 'Monthly business review');
  assert.equal(findReviewTemplate(list, 'missing'), null);
  assert.equal(removeReviewTemplate(list, 'RT-1').length, 0);
  assert.equal(removeReviewTemplate(list, 'missing').length, 1);
});

test('section order is the same every time', () => {
  const entry = template();
  const a = reviewTemplateSections(entry).map((s) => s.heading);
  const b = reviewTemplateSections(entry).map((s) => s.heading);
  assert.deepEqual(a, b);
  assert.deepEqual(a, ['Collections', 'Owner notes']);
  assert.deepEqual(reviewTemplateSections(entry).map((s) => s.position), [1, 2]);
});

test('a composed review states each source plainly, including no source', () => {
  const review = composeReview(template(), '2026-11');
  assert.equal(review.month, '2026-11');
  assert.equal(review.sections[0].sourceNote, 'Source report: Owner Khata report.');
  assert.equal(review.sections[1].sourceNote, 'No source report for this section — fill in by hand.');
});

test('a composed review computes no totals and no ratings', () => {
  const review = composeReview(template(), '2026-11');
  const keys = Object.keys(review).concat(...review.sections.map((s) => Object.keys(s)));
  for (const banned of ['total', 'sum', 'rating', 'score', 'amount', 'count']) {
    assert.equal(keys.includes(banned), false, `composed review must not carry ${banned}`);
  }
});

test('the starter template has a fixed order and a no-source section', () => {
  const starters = reviewTemplateStarters();
  assert.equal(starters.length, 1);
  assert.equal(starters[0].id, 'RT-DEFAULT');
  assert.deepEqual(reviewTemplateSections(starters[0]).map((s) => s.heading), [
    'Collections',
    'Bills issued',
    'Arrears and write-offs',
    'Faults and field work',
    'Customer trust and communication',
    'Shop and owner operations',
    'Growth readiness',
    'Owner notes',
  ]);
  const review = composeReview(starters[0], '2026-11');
  assert.equal(review.sections.at(-1).sourceNote, 'No source report for this section — fill in by hand.');
  assert.equal(recordReviewTemplate(recordReviewTemplate([], starters[0]), starters[0]).length, 1);
});

test('summary text counts templates', () => {
  assert.equal(reviewTemplateSummaryText([]), '0 review templates');
  assert.equal(reviewTemplateSummaryText([template()]), '1 review template');
});

test('review text lists sections in order', () => {
  const text = reviewTemplateText(template(), '2026-11');
  assert.ok(text.includes('2026-11'));
  assert.ok(text.indexOf('Collections') < text.indexOf('Owner notes'));
  assert.equal(reviewTemplateText(template(), 'bad-month'), '');
});

test('html escapes headings and sources', () => {
  const html = reviewTemplateHtml(template({ name: '<b>Review</b>', sections: [{ heading: 'A & B', source: '<script>' }] }));
  assert.ok(!html.includes('<b>Review</b>'));
  assert.ok(html.includes('&lt;b&gt;Review&lt;/b&gt;'));
  assert.ok(html.includes('A &amp; B'));
});

test('csv and filename cover every section', () => {
  const csv = reviewTemplateCsv([template()]);
  assert.ok(csv.startsWith('id,name,position,heading,source'));
  assert.ok(csv.includes('Collections'));
  assert.ok(csv.includes('Owner notes'));
  assert.equal(reviewTemplateFilename(), 'review-templates.csv');
});

test('inputs are never mutated', () => {
  const raw = template();
  const snapshot = JSON.stringify(raw);
  recordReviewTemplate([], raw);
  composeReview(raw, '2026-11');
  assert.equal(JSON.stringify(raw), snapshot);
});

test('list normalization drops bad entries and duplicate ids', () => {
  const list = normalizeReviewTemplateList([template(), null, template({ name: 'Other' }), { id: 'x' }]);
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'Monthly business review');
});

test('module is pure: no clock, storage, network, or imports', () => {
  const source = readFileSync(join(dir, '..', 'review-template.js'), 'utf8');
  assert.ok(!source.includes('new Date('));
  assert.ok(!source.includes('Date.now('));
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('fetch('));
  assert.ok(!source.match(/^import /m));
});

test('panel element ids are present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['rtHeading', 'rtSummary', 'rtName', 'rtSections', 'rtSaveBtn', 'rtStarterBtn', 'rtMonth', 'rtComposeId', 'rtComposeBtn', 'rtComposeBody', 'rtRemoveId', 'rtRemoveBtn', 'rtExportBtn', 'rtBody']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wires the review-template store', () => {
  const app = readFileSync(join(dir, '..', 'app.js'), 'utf8');
  assert.ok(app.includes("from './review-template.js'"));
  assert.ok(app.includes('shahdara_review_templates_v1'));
  assert.ok(app.includes('renderReviewTemplate'));
});
