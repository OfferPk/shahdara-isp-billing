import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validPriceReviewDate,
  normalizePriceReviewWorksheet,
  normalizePriceReviewList,
  findPriceReviewWorksheet,
  recordPriceReviewWorksheet,
  removePriceReviewWorksheet,
  priceReviewSorted,
  priceReviewComparison,
  priceReviewsForPackage,
  priceReviewPackages,
  priceReviewSummaryText,
  priceReviewText,
  priceReviewHtml,
  priceReviewAllHtml,
  priceReviewsForPackageHtml,
  priceReviewCsv,
  priceReviewFilename,
} from '../price-review.js';

const first = {
  id: 'PR-1',
  package: '5 Mbps 150 GB',
  currentPrice: 1500,
  comparedFigure: 1600,
  costNote: 'Margin still healthy',
  reviewDate: '2026-11-01',
  reviewer: 'Aqib',
  conclusion: 'Keep the price for now',
};
const second = {
  id: 'PR-2',
  package: '5 Mbps 150 GB',
  currentPrice: 1500,
  comparedFigure: 1400,
  costNote: '',
  reviewDate: '2026-11-03',
  reviewer: 'Saad',
  conclusion: '',
};
const third = {
  id: 'PR-3',
  package: '3 Mbps 100 GB',
  currentPrice: 1000,
  comparedFigure: 1000,
  costNote: 'Cheapest in the area',
  reviewDate: '2026-11-02',
  reviewer: 'Aqib',
  conclusion: 'No change needed',
};
const fixture = [first, second, third];

test('a half-formed worksheet is refused', () => {
  assert.equal(normalizePriceReviewWorksheet(null), null);
  assert.equal(normalizePriceReviewWorksheet('nope'), null);
  assert.equal(normalizePriceReviewWorksheet([]), null);
  assert.equal(normalizePriceReviewWorksheet({ ...first, id: '' }), null);
  assert.equal(normalizePriceReviewWorksheet({ ...first, package: '' }), null);
  assert.equal(normalizePriceReviewWorksheet({ ...first, reviewer: '' }), null);
  assert.equal(normalizePriceReviewWorksheet({ ...first, reviewDate: '' }), null);
  assert.equal(normalizePriceReviewWorksheet({ ...first, currentPrice: '' }), null);
  assert.equal(normalizePriceReviewWorksheet({ ...first, comparedFigure: '' }), null);
  const optional = normalizePriceReviewWorksheet({ ...first, costNote: '', conclusion: '' });
  assert.equal(optional.costNote, '');
  assert.equal(optional.conclusion, '');
  assert.equal(normalizePriceReviewWorksheet(first).package, '5 Mbps 150 GB');
});

test('strict dates: real calendar days only', () => {
  assert.equal(validPriceReviewDate('2026-11-05'), true);
  assert.equal(validPriceReviewDate('2024-02-29'), true);
  assert.equal(validPriceReviewDate('2025-02-29'), false);
  assert.equal(validPriceReviewDate('2026-04-31'), false);
  assert.equal(validPriceReviewDate('2026-13-01'), false);
  assert.equal(validPriceReviewDate('2026-00-10'), false);
  assert.equal(validPriceReviewDate('2026-11-00'), false);
  assert.equal(validPriceReviewDate('05-11-2026'), false);
  assert.equal(validPriceReviewDate('2026/11/05'), false);
  assert.equal(validPriceReviewDate(''), false);
  assert.equal(validPriceReviewDate(null), false);
  assert.equal(normalizePriceReviewWorksheet({ ...first, reviewDate: '2025-02-29' }), null);
  assert.equal(normalizePriceReviewWorksheet({ ...first, reviewDate: '2024-02-29' }).reviewDate, '2024-02-29');
});

test('prices are whole rupees only', () => {
  assert.equal(normalizePriceReviewWorksheet({ ...first, currentPrice: 1500.5 }), null);
  assert.equal(normalizePriceReviewWorksheet({ ...first, currentPrice: 0 }), null);
  assert.equal(normalizePriceReviewWorksheet({ ...first, currentPrice: -100 }), null);
  assert.equal(normalizePriceReviewWorksheet({ ...first, currentPrice: '1500' }).currentPrice, 1500);
  assert.equal(normalizePriceReviewWorksheet({ ...first, comparedFigure: 1600.5 }), null);
  assert.equal(normalizePriceReviewWorksheet({ ...first, comparedFigure: -1 }), null);
  assert.equal(normalizePriceReviewWorksheet({ ...first, comparedFigure: 0 }).comparedFigure, 0);
  assert.equal(normalizePriceReviewWorksheet({ ...first, comparedFigure: '1600' }).comparedFigure, 1600);
  assert.equal(normalizePriceReviewWorksheet({ ...first, currentPrice: 'fifteen hundred' }), null);
});

test('unknown fields are dropped and the input is never mutated', () => {
  const raw = {
    ...first,
    priceChange: 'raise to 1700',
    bill: 'B-9',
    payment: 'P-9',
    customer: 'C-9',
    newPrice: 1700,
  };
  const frozen = { ...raw };
  const out = normalizePriceReviewWorksheet(raw);
  assert.equal(out.priceChange, undefined);
  assert.equal(out.bill, undefined);
  assert.equal(out.payment, undefined);
  assert.equal(out.customer, undefined);
  assert.equal(out.newPrice, undefined);
  assert.deepEqual(raw, frozen);
  assert.equal(out.currentPrice, 1500);
});

test('a duplicate id is never rewritten', () => {
  const next = recordPriceReviewWorksheet(fixture, { ...first, conclusion: 'Changed my mind' });
  assert.equal(next.length, 3);
  assert.equal(next[0].conclusion, 'Keep the price for now');
  assert.deepEqual(recordPriceReviewWorksheet(fixture, { ...first, id: '' }), fixture);
  assert.deepEqual(recordPriceReviewWorksheet('nope', first), [first]);
});

test('find and remove by id', () => {
  assert.deepEqual(findPriceReviewWorksheet(fixture, 'PR-2'), second);
  assert.equal(findPriceReviewWorksheet(fixture, 'PR-9'), null);
  assert.equal(findPriceReviewWorksheet(fixture, ''), null);
  assert.deepEqual(removePriceReviewWorksheet(fixture, 'PR-1').map((entry) => entry.id), ['PR-2', 'PR-3']);
  assert.deepEqual(removePriceReviewWorksheet(fixture, 'PR-9'), fixture);
  assert.deepEqual(removePriceReviewWorksheet(fixture, ''), fixture);
});

test('worksheets sort by review date, then package, then id', () => {
  const rows = priceReviewSorted([second, third, first, { ...second, id: 'PR-0', reviewDate: '2026-11-01' }]);
  assert.deepEqual(rows.map((entry) => entry.id), ['PR-0', 'PR-1', 'PR-3', 'PR-2']);
  assert.deepEqual(normalizePriceReviewList('nope'), []);
});

test('comparison reads above, below, and same in plain words', () => {
  assert.equal(priceReviewComparison(first), 'above');
  assert.equal(priceReviewComparison(second), 'below');
  assert.equal(priceReviewComparison(third), 'same');
  assert.equal(priceReviewComparison(null), null);
  assert.equal(priceReviewComparison({ ...first, comparedFigure: '' }), null);
});

test('worksheets list per package, case-insensitive, with the first spelling kept', () => {
  assert.deepEqual(priceReviewsForPackage(fixture, '5 mbps 150 gb').map((entry) => entry.id), ['PR-1', 'PR-2']);
  assert.deepEqual(priceReviewsForPackage(fixture, '5 Mbps 150 GB').map((entry) => entry.id), ['PR-1', 'PR-2']);
  assert.deepEqual(priceReviewsForPackage(fixture, 'Nobody').map((entry) => entry.id), []);
  assert.deepEqual(priceReviewsForPackage(fixture, ''), []);
  assert.deepEqual(priceReviewPackages(fixture), ['5 Mbps 150 GB', '3 Mbps 100 GB']);
  assert.deepEqual(
    priceReviewPackages([{ ...first, package: '5 mbps 150 gb' }, first]),
    ['5 mbps 150 gb'],
  );
});

test('summary names the count and the latest review', () => {
  assert.equal(priceReviewSummaryText(fixture), '3 price review worksheets recorded. Latest review: 5 Mbps 150 GB on 2026-11-03.');
  assert.equal(priceReviewSummaryText([first]), '1 price review worksheet recorded. Latest review: 5 Mbps 150 GB on 2026-11-01.');
  assert.equal(priceReviewSummaryText([]), 'No price review worksheets recorded.');
});

test('text shows inputs and conclusion in plain words', () => {
  assert.equal(priceReviewText(first),
    '5 Mbps 150 GB — current price Rs 1500, compared figure Rs 1600 — compared figure is above the current price — cost or margin: Margin still healthy — reviewed 2026-11-01 by Aqib — conclusion: Keep the price for now');
  assert.equal(priceReviewText(second),
    '5 Mbps 150 GB — current price Rs 1500, compared figure Rs 1400 — compared figure is below the current price — cost or margin: not noted — reviewed 2026-11-03 by Saad — conclusion: not recorded yet');
  assert.equal(priceReviewText(third),
    '3 Mbps 100 GB — current price Rs 1000, compared figure Rs 1000 — compared figure matches the current price — cost or margin: Cheapest in the area — reviewed 2026-11-02 by Aqib — conclusion: No change needed');
  assert.equal(priceReviewText(null), 'No price review worksheet recorded.');
  assert.equal(priceReviewText({ ...first, reviewDate: '' }), 'No price review worksheet recorded.');
});

test('html escapes input', () => {
  const evil = { id: 'PR-9', package: '<script>alert(1)</script>', currentPrice: 1500, comparedFigure: 1600, costNote: '<i>bad</i>', reviewDate: '2026-11-05', reviewer: 'Aqib', conclusion: '<b>bold</b>' };
  const html = priceReviewHtml(evil);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(html.includes('&lt;b&gt;bold&lt;/b&gt;'), true);
  assert.equal(html.includes('&lt;i&gt;bad&lt;/i&gt;'), true);
  assert.equal(html.includes('compared figure is above the current price'), true);
  assert.equal(priceReviewHtml(null), '<p>No price review worksheet recorded.</p>');
  const all = priceReviewAllHtml([evil, first]);
  assert.equal(all.includes('&lt;script&gt;'), true);
  assert.equal(priceReviewAllHtml([]), '<p>No price review worksheets recorded.</p>');
  assert.equal(priceReviewsForPackageHtml(fixture, '5 Mbps 150 GB').includes('Keep the price for now'), true);
  assert.equal(priceReviewsForPackageHtml(fixture, 'Nobody'), '<p>No price review worksheets for this package.</p>');
});

test('csv export and filename', () => {
  const csv = priceReviewCsv(fixture);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","package","current price","compared figure","comparison","cost or margin note","review date","reviewer","conclusion"');
  assert.equal(lines.length, 4);
  assert.equal(lines[1].includes('"PR-1"'), true);
  assert.equal(lines[1].includes('"5 Mbps 150 GB"'), true);
  assert.equal(lines[1].includes('"1500"'), true);
  assert.equal(lines[1].includes('"above"'), true);
  assert.equal(lines[1].includes('"Margin still healthy"'), true);
  assert.equal(lines[1].includes('"Keep the price for now"'), true);
  assert.equal(lines[2].includes('"PR-3"'), true);
  assert.equal(lines[2].includes('"same"'), true);
  assert.equal(lines[3].includes('"PR-2"'), true);
  assert.equal(lines[3].includes('"below"'), true);
  assert.equal(priceReviewCsv([]), '"id","package","current price","compared figure","comparison","cost or margin note","review date","reviewer","conclusion"');
  assert.equal(priceReviewFilename(), 'price-reviews.csv');
});

test('list normalisation drops bad worksheets and keeps the first duplicate', () => {
  const bad = { ...first, id: '' };
  const out = normalizePriceReviewList([bad, first, { ...first, reviewDate: '2026-11-09' }, second, 'nope', null]);
  assert.deepEqual(out.map((entry) => entry.id), ['PR-1', 'PR-2']);
  assert.equal(out[0].reviewDate, '2026-11-01');
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../price-review.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the price revision history and the price-change notice draft are untouched', () => {
  const source = readFileSync(new URL('../price-review.js', import.meta.url), 'utf8');
  assert.equal(source.includes('package-price-history.js'), false, 'module must not reference the price revision history module');
  assert.equal(source.includes('price-notices.js'), false, 'module must not reference the price-change notice draft module');
  assert.equal(existsSync(new URL('../package-price-history.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../price-notices.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'prwHeading', 'prwSummary', 'prwExportBtn', 'prwPackage', 'prwCurrentPrice',
    'prwComparedFigure', 'prwCostNote', 'prwReviewDate', 'prwReviewer',
    'prwConclusion', 'prwRecordBtn', 'prwRemoveId', 'prwRemoveBtn', 'prwFilter',
    'prwFilterBtn', 'prwPackageBody', 'prwBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the price review panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './price-review.js'"), true);
  assert.equal(source.includes('renderPriceReview()'), true);
  assert.equal(source.includes('loadPriceReviewWorksheets()'), true);
  assert.equal(source.includes('shahdara_price_reviews_v1'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
