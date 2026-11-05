import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validFeedbackTrendDate,
  normalizeFeedbackTrendRow,
  normalizeFeedbackTrendRows,
  feedbackTrendInPeriod,
  feedbackTrendFor,
  feedbackTrendsByMohalla,
  feedbackTrendMohallas,
  feedbackTrendText,
  feedbackTrendSummaryText,
  feedbackTrendHtml,
  feedbackTrendsHtml,
  feedbackTrendCsv,
  feedbackTrendFilename,
} from '../feedback-trend.js';

const north1 = { mohalla: 'Mohalla North', date: '2026-11-02', rating: 'satisfied', comment: 'Line fixed quickly' };
const north2 = { mohalla: 'Mohalla North', date: '2026-11-05', rating: 'satisfied', comment: 'Line fixed quickly' };
const north3 = { mohalla: 'Mohalla North', date: '2026-11-09', rating: 'not-satisfied', comment: 'Late visit' };
const north4 = { mohalla: 'Mohalla North', date: '2026-11-12', rating: 'partly-satisfied', comment: 'Late visit' };
const northOld = { mohalla: 'Mohalla North', date: '2026-10-28', rating: 'satisfied', comment: 'Out of period' };
const south1 = { mohalla: 'Mohalla South', date: '2026-11-03', rating: 'not-satisfied', comment: 'Bill confusing' };
const south2 = { mohalla: 'Mohalla South', date: '2026-11-20', rating: 'satisfied', comment: '' };
const badRating = { mohalla: 'Mohalla South', date: '2026-11-21', rating: 'happy', comment: 'Not a rating' };
const fixture = [north1, north2, north3, north4, northOld, south1, south2, badRating];

test('half-formed rows are refused, good rows pass, unknown fields drop', () => {
  assert.equal(normalizeFeedbackTrendRow(null), null);
  assert.equal(normalizeFeedbackTrendRow({ mohalla: '', date: '2026-11-02', rating: 'satisfied' }), null);
  assert.equal(normalizeFeedbackTrendRow({ mohalla: 'Mohalla North', date: 'not-a-date', rating: 'satisfied' }), null);
  assert.equal(normalizeFeedbackTrendRow({ mohalla: 'Mohalla North', date: '2026-11-02', rating: 'happy' }), null);
  assert.equal(normalizeFeedbackTrendRow({ mohalla: 'Mohalla North', date: '2026-11-02' }), null);
  assert.deepEqual(
    normalizeFeedbackTrendRow({ mohalla: '  Mohalla North ', date: '2026-11-02', rating: 'satisfied', comment: '  Good  ', extra: 'dropped' }),
    { mohalla: 'Mohalla North', date: '2026-11-02', rating: 'satisfied', comment: 'Good' },
  );
  assert.equal(normalizeFeedbackTrendRow(north1).comment, 'Line fixed quickly');
});

test('strict dates: 31-day months pass, bad dates fail, leap years work', () => {
  assert.equal(validFeedbackTrendDate('2026-01-31'), true);
  assert.equal(validFeedbackTrendDate('2026-08-31'), true);
  assert.equal(validFeedbackTrendDate('2026-10-31'), true);
  assert.equal(validFeedbackTrendDate('2026-12-31'), true);
  assert.equal(validFeedbackTrendDate('2026-04-31'), false);
  assert.equal(validFeedbackTrendDate('2026-02-29'), false);
  assert.equal(validFeedbackTrendDate('2024-02-29'), true);
  assert.equal(validFeedbackTrendDate('2026-11-32'), false);
  assert.equal(validFeedbackTrendDate('2026-13-01'), false);
  assert.equal(validFeedbackTrendDate('02-11-2026'), false);
});

test('rating spellings fold to the fixed three', () => {
  assert.equal(normalizeFeedbackTrendRow({ mohalla: 'M', date: '2026-11-02', rating: 'Partly Satisfied' }).rating, 'partly-satisfied');
  assert.equal(normalizeFeedbackTrendRow({ mohalla: 'M', date: '2026-11-02', rating: 'partly_satisfied' }).rating, 'partly-satisfied');
  assert.equal(normalizeFeedbackTrendRow({ mohalla: 'M', date: '2026-11-02', rating: 'not' }).rating, 'not-satisfied');
  assert.equal(normalizeFeedbackTrendRow({ mohalla: 'M', date: '2026-11-02', rating: 'NOT SATISFIED' }).rating, 'not-satisfied');
  assert.equal(normalizeFeedbackTrendRow({ mohalla: 'M', date: '2026-11-02', rating: '  Satisfied ' }).rating, 'satisfied');
});

test('inputs are never mutated and lists normalise', () => {
  const before = JSON.stringify(fixture);
  normalizeFeedbackTrendRows(fixture);
  feedbackTrendFor(fixture, 'Mohalla North', '2026-11-01', '2026-11-30');
  assert.equal(JSON.stringify(fixture), before);
  assert.deepEqual(normalizeFeedbackTrendRows(null), []);
  assert.deepEqual(normalizeFeedbackTrendRows('nope'), []);
  assert.equal(normalizeFeedbackTrendRows(fixture).length, 7);
});

test('counts sum to that mohalla feedback for the period', () => {
  const trend = feedbackTrendFor(fixture, 'Mohalla North', '2026-11-01', '2026-11-30');
  assert.equal(trend.total, 4);
  assert.equal(trend.satisfied, 2);
  assert.equal(trend.partlySatisfied, 1);
  assert.equal(trend.notSatisfied, 1);
  assert.equal(trend.satisfied + trend.partlySatisfied + trend.notSatisfied, trend.total);
  assert.equal(trend.hasFeedback, true);
  assert.equal(trend.from, '2026-11-01');
  assert.equal(trend.to, '2026-11-30');
});

test('period filter is inclusive at both ends and drops out-of-period rows', () => {
  const inPeriod = feedbackTrendInPeriod(fixture, '2026-11-01', '2026-11-30');
  assert.equal(inPeriod.length, 6);
  assert.equal(inPeriod.some((row) => row.comment === 'Out of period'), false);
  const edge = feedbackTrendFor(fixture, 'Mohalla North', '2026-11-02', '2026-11-12');
  assert.equal(edge.total, 4);
  const single = feedbackTrendFor(fixture, 'Mohalla South', '2026-11-20', '2026-11-20');
  assert.equal(single.total, 1);
  assert.equal(single.satisfied, 1);
});

test('bad periods give no trend and no rows', () => {
  assert.equal(feedbackTrendFor(fixture, 'Mohalla North', '2026-11-30', '2026-11-01'), null);
  assert.equal(feedbackTrendFor(fixture, 'Mohalla North', 'not-a-date', '2026-11-30'), null);
  assert.equal(feedbackTrendFor(fixture, '', '2026-11-01', '2026-11-30'), null);
  assert.deepEqual(feedbackTrendInPeriod(fixture, '2026-11-30', '2026-11-01'), []);
  assert.deepEqual(feedbackTrendsByMohalla(fixture, '2026-11-30', '2026-11-01'), []);
});

test('a mohalla with no feedback says so plainly', () => {
  const trend = feedbackTrendFor(fixture, 'Mohalla East', '2026-11-01', '2026-11-30');
  assert.equal(trend.total, 0);
  assert.equal(trend.hasFeedback, false);
  assert.deepEqual(trend.themes, []);
  assert.equal(
    feedbackTrendText(trend),
    'No feedback recorded for Mohalla East from 2026-11-01 to 2026-11-30.',
  );
  assert.equal(feedbackTrendHtml(trend), '<p>No feedback recorded for Mohalla East from 2026-11-01 to 2026-11-30.</p>');
});

test('common note themes are counted, most frequent first, first spelling kept', () => {
  const trend = feedbackTrendFor(fixture, 'Mohalla North', '2026-11-01', '2026-11-30');
  assert.deepEqual(trend.themes, [
    { theme: 'Late visit', count: 2 },
    { theme: 'Line fixed quickly', count: 2 },
  ]);
  const south = feedbackTrendFor(fixture, 'Mohalla South', '2026-11-01', '2026-11-30');
  assert.deepEqual(south.themes, [{ theme: 'Bill confusing', count: 1 }]);
  const cased = normalizeFeedbackTrendRows([
    { mohalla: 'M', date: '2026-11-02', rating: 'satisfied', comment: 'line fixed quickly' },
    { mohalla: 'M', date: '2026-11-03', rating: 'satisfied', comment: 'Line Fixed Quickly' },
    { mohalla: 'M', date: '2026-11-04', rating: 'satisfied', comment: '  line fixed quickly  ' },
  ]);
  const casedTrend = feedbackTrendFor(cased, 'M', '2026-11-01', '2026-11-30');
  assert.deepEqual(casedTrend.themes, [{ theme: 'line fixed quickly', count: 3 }]);
});

test('trends by mohalla are A-Z with first spelling kept, mohalla match is case-insensitive', () => {
  const trends = feedbackTrendsByMohalla(fixture, '2026-11-01', '2026-11-30');
  assert.deepEqual(trends.map((t) => t.mohalla), ['Mohalla North', 'Mohalla South']);
  assert.deepEqual(trends.map((t) => t.total), [4, 2]);
  const lower = feedbackTrendFor(fixture, 'mohalla north', '2026-11-01', '2026-11-30');
  assert.equal(lower.total, 4);
  assert.equal(lower.mohalla, 'Mohalla North');
  assert.deepEqual(feedbackTrendMohallas(fixture), ['Mohalla North', 'Mohalla South']);
  const mixed = feedbackTrendMohallas([
    { mohalla: 'mohalla south', date: '2026-11-02', rating: 'satisfied' },
    { mohalla: 'Mohalla South', date: '2026-11-03', rating: 'satisfied' },
  ]);
  assert.deepEqual(mixed, ['mohalla south']);
});

test('trend text states the split and the themes', () => {
  const trend = feedbackTrendFor(fixture, 'Mohalla North', '2026-11-01', '2026-11-30');
  assert.equal(
    feedbackTrendText(trend),
    'Mohalla North \u2014 2026-11-01 to 2026-11-30: 4 feedback (2 satisfied, 1 partly satisfied, 1 not satisfied). Most common notes: \u201cLate visit\u201d \u00d72; \u201cLine fixed quickly\u201d \u00d72.',
  );
  assert.equal(feedbackTrendText(null), 'Give a mohalla and a real period to see its feedback trend.');
});

test('summary text totals across mohallas', () => {
  assert.equal(
    feedbackTrendSummaryText(fixture, '2026-11-01', '2026-11-30'),
    '2 mohallas, 6 feedback in the period (3 satisfied, 1 partly satisfied, 2 not satisfied).',
  );
  assert.equal(
    feedbackTrendSummaryText(fixture, '2026-10-01', '2026-10-31'),
    '1 mohalla, 1 feedback in the period (1 satisfied, 0 partly satisfied, 0 not satisfied).',
  );
  assert.equal(
    feedbackTrendSummaryText(fixture, '2026-12-01', '2026-12-31'),
    'No feedback recorded from 2026-12-01 to 2026-12-31.',
  );
  assert.equal(
    feedbackTrendSummaryText(fixture, '2026-11-30', '2026-11-01'),
    'Give a real period to summarise feedback trends.',
  );
});

test('HTML escapes comment text', () => {
  const trend = feedbackTrendFor([
    { mohalla: 'M', date: '2026-11-02', rating: 'satisfied', comment: '<script>alert("x")</script>' },
  ], 'M', '2026-11-01', '2026-11-30');
  const html = feedbackTrendHtml(trend);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(feedbackTrendsHtml([]), '<p>No feedback trends to show for this period.</p>');
  assert.equal(feedbackTrendHtml(null), '<p>Give a mohalla and a real period to see its feedback trend.</p>');
  assert.equal(feedbackTrendsHtml([trend]).includes('1 feedback'), true);
});

test('CSV and filename', () => {
  const trends = feedbackTrendsByMohalla(fixture, '2026-11-01', '2026-11-30');
  const csv = feedbackTrendCsv(trends);
  assert.equal(csv.split('\n')[0], 'mohalla,from,to,total,satisfied,partly_satisfied,not_satisfied,top_theme,top_theme_count');
  assert.equal(csv.includes('Mohalla North,2026-11-01,2026-11-30,4,2,1,1,Late visit,2'), true);
  assert.equal(csv.includes('Mohalla South,2026-11-01,2026-11-30,2,1,0,1,Bill confusing,1'), true);
  assert.equal(feedbackTrendFilename(), 'feedback-trends.csv');
  const quoted = feedbackTrendCsv([{
    mohalla: 'M, "quoted"', from: '2026-11-01', to: '2026-11-30', total: 1,
    satisfied: 1, partlySatisfied: 0, notSatisfied: 0,
    themes: [{ theme: 'Said "hello", then left', count: 1 }],
  }]);
  assert.equal(quoted.includes('"M, ""quoted"""'), true);
  assert.equal(quoted.includes('"Said ""hello"", then left"'), true);
});

test('purity fence: no storage, clock, network, or DOM access', () => {
  const source = readFileSync(new URL('../feedback-trend.js', import.meta.url), 'utf8');
  assert.equal(source.includes('import '), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the per-visit record and the ticket note are untouched', () => {
  const source = readFileSync(new URL('../feedback-trend.js', import.meta.url), 'utf8');
  assert.equal(source.includes('visit-feedback'), false, 'module must not reference the per-visit record module');
  assert.equal(source.includes('satisfaction'), false, 'module must not reference the ticket note module');
  assert.equal(existsSync(new URL('../visit-feedback.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../satisfaction.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'ftHeading', 'ftSummary', 'ftExportBtn',
    'ftMohalla', 'ftPeriodFrom', 'ftPeriodTo', 'ftRows', 'ftShowBtn',
    'ftTrendBody', 'ftAllBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the feedback trend panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './feedback-trend.js'"), true);
  assert.equal(source.includes('renderFeedbackTrend()'), true);
  assert.equal(source.includes('feedbackTrendFor'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
