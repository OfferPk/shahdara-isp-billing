import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validPackageUptakeDate,
  normalizePackageUptakeRow,
  normalizePackageUptakeRows,
  packageUptakeInPeriod,
  packageUptakeFor,
  packageUptakesByMohalla,
  packageUptakeTotal,
  packageUptakePackages,
  packageUptakeMohallas,
  packageUptakeText,
  packageUptakeSummaryText,
  packageUptakeHtml,
  packageUptakesHtml,
  packageUptakeCsv,
  packageUptakeFilename,
} from '../package-uptake.js';

const north1 = { mohalla: 'Mohalla North', package: '5 Mbps', customer: 'Ayesha', date: '2026-11-02', moved: true };
const north2 = { mohalla: 'Mohalla North', package: '5 Mbps', customer: 'Bilal', date: '2026-11-05', moved: false };
const north3 = { mohalla: 'Mohalla North', package: '5 Mbps', customer: 'Chanda', date: '2026-11-09', moved: 'moved' };
const north4 = { mohalla: 'Mohalla North', package: '5 Mbps', customer: 'Danish', date: '2026-11-12', moved: 'offered' };
const northOld = { mohalla: 'Mohalla North', package: '5 Mbps', customer: 'Esha', date: '2026-10-28', moved: true };
const northOther = { mohalla: 'Mohalla North', package: '15 Mbps', customer: 'Farah', date: '2026-11-03', moved: true };
const south1 = { mohalla: 'Mohalla South', package: '5 Mbps', customer: 'Gul', date: '2026-11-03', moved: true };
const south2 = { mohalla: 'Mohalla South', package: '5 Mbps', customer: 'Hina', date: '2026-11-20', moved: false };
const badMoved = { mohalla: 'Mohalla South', package: '5 Mbps', customer: 'Irfan', date: '2026-11-21', moved: 'maybe' };
const fixture = [north1, north2, north3, north4, northOld, northOther, south1, south2, badMoved];

test('half-formed rows are refused, good rows pass, unknown fields drop', () => {
  assert.equal(normalizePackageUptakeRow(null), null);
  assert.equal(normalizePackageUptakeRow({ mohalla: '', package: '5 Mbps', customer: 'A', date: '2026-11-02', moved: true }), null);
  assert.equal(normalizePackageUptakeRow({ mohalla: 'M', package: '', customer: 'A', date: '2026-11-02', moved: true }), null);
  assert.equal(normalizePackageUptakeRow({ mohalla: 'M', package: '5 Mbps', customer: '', date: '2026-11-02', moved: true }), null);
  assert.equal(normalizePackageUptakeRow({ mohalla: 'M', package: '5 Mbps', customer: 'A', date: 'not-a-date', moved: true }), null);
  assert.equal(normalizePackageUptakeRow({ mohalla: 'M', package: '5 Mbps', customer: 'A', date: '2026-11-02', moved: 'maybe' }), null);
  assert.equal(normalizePackageUptakeRow({ mohalla: 'M', package: '5 Mbps', customer: 'A', date: '2026-11-02' }), null);
  assert.deepEqual(
    normalizePackageUptakeRow({ mohalla: '  Mohalla North ', package: ' 5 Mbps ', customer: ' Ayesha ', date: '2026-11-02', moved: true, bill: 'dropped' }),
    { mohalla: 'Mohalla North', package: '5 Mbps', customer: 'Ayesha', date: '2026-11-02', moved: true },
  );
  assert.equal(normalizePackageUptakeRow(north1).moved, true);
  assert.equal(normalizePackageUptakeRows(fixture).length, 8);
});

test('strict dates: 31-day months pass, bad dates fail, leap years work', () => {
  assert.equal(validPackageUptakeDate('2026-01-31'), true);
  assert.equal(validPackageUptakeDate('2026-08-31'), true);
  assert.equal(validPackageUptakeDate('2026-10-31'), true);
  assert.equal(validPackageUptakeDate('2026-12-31'), true);
  assert.equal(validPackageUptakeDate('2026-04-31'), false);
  assert.equal(validPackageUptakeDate('2026-02-29'), false);
  assert.equal(validPackageUptakeDate('2024-02-29'), true);
  assert.equal(validPackageUptakeDate('2026-11-32'), false);
  assert.equal(validPackageUptakeDate('2026-13-01'), false);
  assert.equal(validPackageUptakeDate('02-11-2026'), false);
});

test('moved spellings fold to true or false', () => {
  const base = { mohalla: 'M', package: '5 Mbps', customer: 'A', date: '2026-11-02' };
  assert.equal(normalizePackageUptakeRow({ ...base, moved: 'moved' }).moved, true);
  assert.equal(normalizePackageUptakeRow({ ...base, moved: 'YES' }).moved, true);
  assert.equal(normalizePackageUptakeRow({ ...base, moved: 'True' }).moved, true);
  assert.equal(normalizePackageUptakeRow({ ...base, moved: 1 }).moved, true);
  assert.equal(normalizePackageUptakeRow({ ...base, moved: 'offered' }).moved, false);
  assert.equal(normalizePackageUptakeRow({ ...base, moved: 'No' }).moved, false);
  assert.equal(normalizePackageUptakeRow({ ...base, moved: 'false' }).moved, false);
  assert.equal(normalizePackageUptakeRow({ ...base, moved: 0 }).moved, false);
  assert.equal(normalizePackageUptakeRow({ ...base, moved: '' }).moved, false);
});

test('inputs are never mutated', () => {
  const rows = [{ mohalla: ' M ', package: ' 5 Mbps ', customer: ' A ', date: '2026-11-02', moved: 'moved' }];
  const before = JSON.stringify(rows);
  normalizePackageUptakeRows(rows);
  packageUptakeFor(rows, '5 Mbps', 'M', '2026-11-01', '2026-11-30');
  packageUptakesByMohalla(rows, '5 Mbps', '2026-11-01', '2026-11-30');
  assert.equal(JSON.stringify(rows), before);
});

test('uptake counts per mohalla sum to the total package moves for that package', () => {
  const total = packageUptakeTotal(fixture, '5 Mbps', '2026-11-01', '2026-11-30');
  assert.deepEqual(total, {
    package: '5 Mbps', from: '2026-11-01', to: '2026-11-30',
    offered: 6, moved: 3, uptake: 3,
  });
  const byMohalla = packageUptakesByMohalla(fixture, '5 Mbps', '2026-11-01', '2026-11-30');
  assert.equal(byMohalla.reduce((sum, u) => sum + u.offered, 0), total.offered);
  assert.equal(byMohalla.reduce((sum, u) => sum + u.moved, 0), total.moved);
  assert.equal(byMohalla.reduce((sum, u) => sum + u.uptake, 0), total.uptake);
  assert.deepEqual(byMohalla.map((u) => [u.mohalla, u.offered, u.moved, u.uptake]), [
    ['Mohalla North', 4, 2, 2],
    ['Mohalla South', 2, 1, 1],
  ]);
  // The other package is counted separately: only its own rows count.
  const other = packageUptakeTotal(fixture, '15 Mbps', '2026-11-01', '2026-11-30');
  assert.deepEqual([other.offered, other.moved, other.uptake], [1, 1, 1]);
});

test('a mohalla with no uptake shows zero, not a blank', () => {
  const none = packageUptakeFor(fixture, '5 Mbps', 'Mohalla East', '2026-11-01', '2026-11-30');
  assert.deepEqual(none, {
    package: '5 Mbps', mohalla: 'Mohalla East', from: '2026-11-01', to: '2026-11-30',
    offered: 0, moved: 0, uptake: 0, hasUptake: false,
  });
  assert.equal(
    packageUptakeText(none),
    'No uptake recorded for Mohalla East — 5 Mbps — from 2026-11-01 to 2026-11-30: 0 offered, 0 moved.',
  );
  // Offered but nobody moved is still zero uptake, stated plainly.
  const offeredOnly = packageUptakeFor([
    { mohalla: 'M', package: '5 Mbps', customer: 'A', date: '2026-11-02', moved: false },
    { mohalla: 'M', package: '5 Mbps', customer: 'B', date: '2026-11-03', moved: 'offered' },
  ], '5 Mbps', 'M', '2026-11-01', '2026-11-30');
  assert.equal(offeredOnly.hasUptake, false);
  assert.equal(offeredOnly.offered, 2);
  assert.equal(
    packageUptakeText(offeredOnly),
    'M — 5 Mbps — from 2026-11-01 to 2026-11-30: 2 offered, 0 moved, uptake 0.',
  );
  assert.equal(packageUptakeFor(fixture, '', 'M', '2026-11-01', '2026-11-30'), null);
  assert.equal(packageUptakeFor(fixture, '5 Mbps', '', '2026-11-01', '2026-11-30'), null);
});

test('inclusive period filter and bad periods', () => {
  const inPeriod = packageUptakeInPeriod(fixture, '2026-11-01', '2026-11-30');
  assert.equal(inPeriod.length, 7);
  assert.equal(inPeriod.some((row) => row.customer === 'Esha'), false);
  assert.equal(inPeriod.some((row) => row.customer === 'Irfan'), false);
  assert.deepEqual(packageUptakeInPeriod(fixture, '2026-11-30', '2026-11-01'), []);
  assert.deepEqual(packageUptakeInPeriod(fixture, 'not-a-date', '2026-11-30'), []);
  assert.equal(packageUptakeFor(fixture, '5 Mbps', 'Mohalla North', '2026-11-30', '2026-11-01'), null);
  assert.deepEqual(packageUptakesByMohalla(fixture, '5 Mbps', '2026-11-30', '2026-11-01'), []);
  assert.equal(packageUptakeTotal(fixture, '5 Mbps', '2026-11-30', '2026-11-01'), null);
});

test('uptakes by mohalla are A-Z with first spelling kept, package match is case-insensitive', () => {
  const uptakes = packageUptakesByMohalla(fixture, '5 Mbps', '2026-11-01', '2026-11-30');
  assert.deepEqual(uptakes.map((u) => u.mohalla), ['Mohalla North', 'Mohalla South']);
  const lower = packageUptakeFor(fixture, '5 mbps', 'mohalla north', '2026-11-01', '2026-11-30');
  assert.equal(lower.offered, 4);
  assert.equal(lower.package, '5 Mbps');
  assert.equal(lower.mohalla, 'Mohalla North');
  assert.deepEqual(packageUptakePackages(fixture), ['15 Mbps', '5 Mbps']);
  assert.deepEqual(packageUptakeMohallas(fixture), ['Mohalla North', 'Mohalla South']);
  const mixed = packageUptakePackages([
    { mohalla: 'M', package: '5 mbps', customer: 'A', date: '2026-11-02', moved: true },
    { mohalla: 'M', package: '5 Mbps', customer: 'B', date: '2026-11-03', moved: false },
  ]);
  assert.deepEqual(mixed, ['5 mbps']);
});

test('uptake text states offered, moved, and uptake', () => {
  const uptake = packageUptakeFor(fixture, '5 Mbps', 'Mohalla North', '2026-11-01', '2026-11-30');
  assert.equal(
    packageUptakeText(uptake),
    'Mohalla North — 5 Mbps — from 2026-11-01 to 2026-11-30: 4 customers offered, 2 moved, uptake 2.',
  );
  assert.equal(packageUptakeText(null), 'Give a package, a mohalla, and a real period to see its uptake.');
});

test('summary text totals across mohallas', () => {
  assert.equal(
    packageUptakeSummaryText(fixture, '5 Mbps', '2026-11-01', '2026-11-30'),
    '2 mohallas, 6 offered, 3 moved, uptake 3 for 5 Mbps in the period.',
  );
  assert.equal(
    packageUptakeSummaryText(fixture, '5 Mbps', '2026-10-01', '2026-10-31'),
    '1 mohalla, 1 offered, 1 moved, uptake 1 for 5 Mbps in the period.',
  );
  assert.equal(
    packageUptakeSummaryText(fixture, '5 Mbps', '2026-12-01', '2026-12-31'),
    'No uptake recorded for 5 Mbps from 2026-12-01 to 2026-12-31.',
  );
  assert.equal(
    packageUptakeSummaryText(fixture, '5 Mbps', '2026-11-30', '2026-11-01'),
    'Give a real period to summarise package uptake.',
  );
  assert.equal(packageUptakeSummaryText(fixture, '', '2026-11-01', '2026-11-30'), 'Give a package to summarise its uptake.');
});

test('HTML escapes package and mohalla text', () => {
  const uptake = packageUptakeFor([
    { mohalla: 'M', package: '5 <Mbps>', customer: 'A', date: '2026-11-02', moved: true },
  ], '5 <Mbps>', 'M', '2026-11-01', '2026-11-30');
  const html = packageUptakeHtml(uptake);
  assert.equal(html.includes('<Mbps>'), false);
  assert.equal(html.includes('&lt;Mbps&gt;'), true);
  assert.equal(packageUptakesHtml([]), '<p>No package uptake to show for this period.</p>');
  assert.equal(packageUptakeHtml(null), '<p>Give a package, a mohalla, and a real period to see its uptake.</p>');
  assert.equal(packageUptakesHtml([uptake]).includes('1 offered'), true);
});

test('CSV and filename', () => {
  const uptakes = packageUptakesByMohalla(fixture, '5 Mbps', '2026-11-01', '2026-11-30');
  const csv = packageUptakeCsv(uptakes);
  assert.equal(csv.split('\n')[0], 'package,mohalla,from,to,offered,moved,uptake');
  assert.equal(csv.includes('5 Mbps,Mohalla North,2026-11-01,2026-11-30,4,2,2'), true);
  assert.equal(csv.includes('5 Mbps,Mohalla South,2026-11-01,2026-11-30,2,1,1'), true);
  assert.equal(packageUptakeFilename(), 'package-uptakes.csv');
  const quoted = packageUptakeCsv([{
    package: '5, "fast" Mbps', mohalla: 'M, "quoted"', from: '2026-11-01', to: '2026-11-30',
    offered: 1, moved: 1, uptake: 1,
  }]);
  assert.equal(quoted.includes('"5, ""fast"" Mbps"'), true);
  assert.equal(quoted.includes('"M, ""quoted"""'), true);
});

test('purity fence: no storage, clock, network, or DOM access', () => {
  const source = readFileSync(new URL('../package-uptake.js', import.meta.url), 'utf8');
  assert.equal(source.includes('import '), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the announcement draft is untouched', () => {
  const source = readFileSync(new URL('../package-uptake.js', import.meta.url), 'utf8');
  assert.equal(source.includes('announcement-draft'), false, 'module must not reference the announcement draft module');
  assert.equal(existsSync(new URL('../announcement-draft.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'puHeading', 'puSummary', 'puExportBtn',
    'puPackage', 'puMohalla', 'puPeriodFrom', 'puPeriodTo', 'puRows', 'puShowBtn',
    'puUptakeBody', 'puAllBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the package uptake panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './package-uptake.js'"), true);
  assert.equal(source.includes('renderPackageUptake()'), true);
  assert.equal(source.includes('packageUptakeFor'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
