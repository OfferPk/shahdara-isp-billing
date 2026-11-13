import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildReceivablesAgeing } from '../receivables-ageing.js';
import {
  mohallaAgeingKey,
  mohallaAgeingLabel,
  buildMohallaAgeing,
  mohallaAgeingSummaryText,
  mohallaAgeingRowText,
  mohallaAgeingHtml,
  mohallaAgeingCsv,
  mohallaAgeingFilename,
} from '../mohalla-ageing.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'mohalla-ageing.js'), 'utf8');

// As of 2026-11: Bani has a current, a 1-month and a 3+ month bill;
// Chungi has a single 2-month bill; Saddar is known but has no dues.
// Sharafat 14: amounts are integer CENTS (1000 rupees = 100000 cents);
// the view carries cents end-to-end and rounds only at display.
const entries = [
  { customerId: 'C1', customerName: 'Ahmed', mohalla: 'Bani', billMonth: '2026-11', amount: 100000 },
  { customerId: 'C1', customerName: 'Ahmed', mohalla: 'MOHALLA BANI', billMonth: '2026-10', amount: 50000 },
  { customerId: 'C2', customerName: 'Bilal', mohalla: 'bani', billMonth: '2026-08', amount: 20000 },
  { customerId: 'C3', customerName: 'Usman', mohalla: 'Chungi', billMonth: '2026-09', amount: 30000 },
];
const view = buildReceivablesAgeing(entries, '2026-11');
const summary = buildMohallaAgeing(view, ['Bani', 'Chungi', 'Saddar']);

test('plan 7 view fixture is valid and totals as expected', () => {
  assert.equal(view.valid, true);
  assert.equal(view.totalOutstanding, 200000);
});

test('age bands sum exactly to each mohalla total', () => {
  const bani = summary.rows.find((row) => row.key === 'BANI');
  assert.equal(bani.byBucket.current, 100000);
  assert.equal(bani.byBucket.one, 50000);
  assert.equal(bani.byBucket.two, 0);
  assert.equal(bani.byBucket.threePlus, 20000);
  assert.equal(bani.bandsTotal, 170000);
  assert.equal(bani.unaged, 0);
  assert.equal(bani.total, 170000);
  const chungi = summary.rows.find((row) => row.key === 'CHUNGI');
  assert.equal(chungi.byBucket.two, 30000);
  assert.equal(chungi.total, 30000);
  assert.equal(summary.bandsMatch, true);
});

test('all mohalla totals sum to the business total on the same fixture', () => {
  assert.equal(summary.businessTotal, 200000);
  assert.equal(summary.rowsTotal, 200000);
  assert.equal(summary.sumsMatch, true);
});

test('a mohalla with no dues says so plainly', () => {
  const saddar = summary.rows.find((row) => row.key === 'SADDAR');
  assert.ok(saddar);
  assert.equal(saddar.total, 0);
  assert.equal(saddar.hasDues, false);
  assert.equal(saddar.note, 'No dues.');
  assert.equal(mohallaAgeingRowText(saddar), 'Saddar: No dues.');
  assert.equal(summary.mohallasWithoutDues, 1);
  assert.equal(summary.mohallasWithDues, 2);
  assert.equal(summary.mohallaCount, 3);
});

test('mohalla key normalisation matches plan 7', () => {
  assert.equal(mohallaAgeingKey('MOHALLA Bani'), 'BANI');
  assert.equal(mohallaAgeingKey('  bani  '), 'BANI');
  assert.equal(mohallaAgeingKey(''), 'UNASSIGNED');
  assert.equal(mohallaAgeingLabel(''), 'Unassigned');
  assert.equal(mohallaAgeingLabel('Bani'), 'Bani');
  // "MOHALLA BANI", "bani" and "Bani" all landed on one Bani row above.
  assert.equal(summary.rows.filter((row) => row.key === 'BANI').length, 1);
});

test('a mohalla in the view but not in the known list is still included', () => {
  const narrow = buildMohallaAgeing(view, ['Bani']);
  assert.ok(narrow.rows.find((row) => row.key === 'CHUNGI'));
  assert.equal(narrow.sumsMatch, true);
  assert.equal(narrow.rowsTotal, 200000);
});

test('unreadable bill months sit outside the bands but inside the total', () => {
  const withUnaged = buildReceivablesAgeing(
    [...entries, { customerId: 'C4', customerName: 'Zain', mohalla: 'Bani', billMonth: 'not-a-month', amount: 40000 }],
    '2026-11',
  );
  const aged = buildMohallaAgeing(withUnaged, ['Bani', 'Chungi']);
  const bani = aged.rows.find((row) => row.key === 'BANI');
  assert.equal(bani.bandsTotal, 170000);
  assert.equal(bani.unaged, 40000);
  assert.equal(bani.total, 210000);
  assert.equal(bani.bandsTotal + bani.unaged, bani.total);
  assert.equal(aged.businessTotal, 240000);
  assert.equal(aged.sumsMatch, true);
  assert.equal(aged.bandsMatch, true);
});

test('blank mohalla dues group under Unassigned, never dropped', () => {
  const blank = buildReceivablesAgeing(
    [{ customerId: 'C9', customerName: 'Noor', mohalla: '', billMonth: '2026-11', amount: 70000 }],
    '2026-11',
  );
  const noted = buildMohallaAgeing(blank, []);
  assert.equal(noted.rows.length, 1);
  assert.equal(noted.rows[0].label, 'Unassigned');
  assert.equal(noted.rows[0].total, 70000);
  assert.equal(noted.sumsMatch, true);
});

test('invalid view yields an invalid, empty summary', () => {
  const bad = buildMohallaAgeing(buildReceivablesAgeing(entries, 'bad-month'), ['Bani']);
  assert.equal(bad.valid, false);
  assert.equal(bad.rows.length, 0);
  assert.equal(bad.businessTotal, 0);
  assert.equal(buildMohallaAgeing(null, ['Bani']).valid, false);
  assert.equal(mohallaAgeingSummaryText(bad), '');
  assert.equal(mohallaAgeingHtml(bad), '');
  assert.equal(mohallaAgeingCsv(bad), '');
});

test('rows sort by mohalla label A-Z', () => {
  assert.deepEqual(summary.rows.map((row) => row.label), ['Bani', 'Chungi', 'Saddar']);
});

test('summary and row text state the figures plainly', () => {
  assert.match(mohallaAgeingSummaryText(summary), /3 mohallas, 2 with dues; 1 mohalla with no dues/);
  // Sharafat 14: display is unchanged in shape — 200000 cents still
  // prints "Rs. 2,000"; only the unit behind the figure changed.
  assert.match(mohallaAgeingSummaryText(summary), /Rs\. 2,000/);
  const bani = summary.rows.find((row) => row.key === 'BANI');
  assert.match(mohallaAgeingRowText(bani), /Bani: Rs\. 1,700 outstanding/);
  assert.match(mohallaAgeingRowText(bani), /Current Rs\. 1,000/);
  assert.match(mohallaAgeingRowText(bani), /3\+ months Rs\. 200/);
});

test('inputs are never mutated', () => {
  const viewBefore = JSON.stringify(view);
  const knownBefore = JSON.stringify(['Bani', 'Chungi', 'Saddar']);
  buildMohallaAgeing(view, ['Bani', 'Chungi', 'Saddar']);
  assert.equal(JSON.stringify(view), viewBefore);
  assert.equal(JSON.stringify(['Bani', 'Chungi', 'Saddar']), knownBefore);
});

test('html escapes labels and shows the no-dues note', () => {
  const tricky = buildMohallaAgeing(
    buildReceivablesAgeing(
      [{ customerId: 'C5', customerName: 'A<b', mohalla: 'X<Y', billMonth: '2026-11', amount: 10000 }],
      '2026-11',
    ),
    ['Safe'],
  );
  const html = mohallaAgeingHtml(tricky);
  assert.match(html, /X&lt;Y/);
  assert.doesNotMatch(html, /X<Y/);
  assert.match(html, /Safe<\/td>.*No dues\./s);
  assert.match(html, /Business total/);
  assert.match(mohallaAgeingHtml(summary), /Saddar<\/td>.*No dues\./s);
});

test('csv and filename', () => {
  const csv = mohallaAgeingCsv(summary);
  assert.match(csv, /^mohalla,current,1 month,2 months,3\+ months,bill month unreadable,total,bills,note\n/);
  // Sharafat 14 (parent decision 2026-11-13): the CSV writes exact
  // decimal rupees — "1000.00", never integer cents "100000". The
  // bills column is a count, not money, so it stays a plain integer.
  assert.match(csv, /Bani,1000\.00,500\.00,0\.00,200\.00,0\.00,1700\.00,3,\n/);
  assert.match(csv, /Saddar,0\.00,0\.00,0\.00,0\.00,0\.00,0\.00,0,No dues\.\n/);
  assert.match(csv, /Business total,,,,,,2000\.00,,\n?$/);
  assert.equal(mohallaAgeingFilename(summary), 'mohalla-ageing-2026-11.csv');
  assert.equal(mohallaAgeingFilename(null), 'mohalla-ageing-unknown.csv');
});

test('module is pure and import-free', () => {
  assert.doesNotMatch(moduleSrc, /^import /m);
  assert.doesNotMatch(moduleSrc, /localStorage|document\.|window\./);
});

test('panel wiring: app.js renders the note from the same plan 7 view', () => {
  assert.match(appJs, /from '\.\/mohalla-ageing\.js'/);
  assert.match(appJs, /buildMohallaAgeing/);
  assert.match(appJs, /mohallaAgeingHtml/);
  assert.match(appJs, /mohallaAgeingExportBtn/);
  assert.match(appJs, /renderMohallaAgeing/);
});

test('panel wiring: index.html carries the mohalla ageing panel', () => {
  assert.match(indexHtml, /id="mohallaAgeingPanel"/);
  assert.match(indexHtml, /id="mohallaAgeingHeading"/);
  assert.match(indexHtml, /id="mohallaAgeingBody"/);
  assert.match(indexHtml, /id="mohallaAgeingExportBtn"/);
});

test('panel wiring: app.js adds no standalone OLT word (deployment guard)', () => {
  // The full guard test lives in deployment.test.js; here we only check
  // the wiring block added for this plan never uses the word.
  const start = appJs.indexOf('Plan 213');
  assert.ok(start > -1);
  const block = appJs.slice(start, start + 4000);
  assert.doesNotMatch(block, /\bOLT\b/);
});
