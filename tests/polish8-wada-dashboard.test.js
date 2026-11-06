import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  WADA_DASHBOARD_POINTS_KEPT,
  WADA_DASHBOARD_POINTS_BROKEN,
  WADA_DASHBOARD_TRUSTED_POINTS,
  WADA_DASHBOARD_SLICES,
  normalizeWadaDashboardList,
  wadaDashboardPointsForCounts,
  wadaDashboardChanceForCounts,
  wadaDashboardTotals,
  wadaDashboardPie,
  wadaDashboardCustomerStats,
  wadaDashboardCustomers,
  wadaDashboardSearchRows,
  wadaDashboardSummaryText,
  wadaDashboardCustomerText,
  wadaDashboardHtml,
  wadaDashboardCsv,
  wadaDashboardFilename,
} from '../wada-dashboard.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'wada-dashboard.js'), 'utf8');

function wada(id, customer, status, promisedDate = '2026-11-01') {
  return { id, customer, promisedDate, status };
}

const CUSTOMERS = [
  { id: 'CUST-1', name: 'Customer One' },
  { id: 'CUST-2', name: 'Customer Two' },
  { id: 'CUST-3', name: 'Customer Three' },
];

const MIXED = [
  wada('WD-1', 'CUST-1', 'kept'),
  wada('WD-2', 'CUST-1', 'keptLate'),
  wada('WD-3', 'CUST-1', 'broken'),
  wada('WD-4', 'CUST-1', 'pending'),
  wada('WD-5', 'CUST-2', 'kept'),
  wada('WD-6', 'CUST-2', 'kept'),
  wada('WD-7', 'cust-1', 'broken'),
];

test('totals: empty list reads as no wadas at all', () => {
  const totals = wadaDashboardTotals([]);
  assert.equal(totals.customers, 0);
  assert.equal(totals.total, 0);
  assert.equal(totals.kept, 0);
  assert.equal(totals.keptLate, 0);
  assert.equal(totals.broken, 0);
  assert.equal(totals.pending, 0);
  assert.equal(totals.keptShare, 0);
  assert.equal(totals.brokenShare, 0);
  assert.equal(totals.keptPercent, 0);
  assert.equal(totals.brokenPercent, 0);
});

test('totals: mixed list counts outcomes and distinct customers', () => {
  const totals = wadaDashboardTotals(MIXED);
  assert.equal(totals.total, 7);
  assert.equal(totals.customers, 2);
  assert.equal(totals.kept, 3);
  assert.equal(totals.keptLate, 1);
  assert.equal(totals.broken, 2);
  assert.equal(totals.pending, 1);
});

test('totals: customer keys match case-insensitively', () => {
  const totals = wadaDashboardTotals([
    wada('WD-1', 'CUST-1', 'kept'),
    wada('WD-2', 'cust-1', 'kept'),
    wada('WD-3', 'Cust-1', 'broken'),
  ]);
  assert.equal(totals.customers, 1);
  assert.equal(totals.total, 3);
});

test('totals: duplicate ids count once, unknown outcomes and bad records are left out', () => {
  const totals = wadaDashboardTotals([
    wada('WD-1', 'CUST-1', 'kept'),
    wada('WD-1', 'CUST-1', 'broken'),
    wada('WD-2', 'CUST-1', 'fulfilled'),
    wada('WD-3', 'CUST-1', 'kept', '2026-02-30'),
    wada('WD-4', '', 'kept'),
    wada('WD-5', 'CUST-2', 'broken'),
  ]);
  assert.equal(totals.total, 2);
  assert.equal(totals.kept, 1);
  assert.equal(totals.broken, 1);
  assert.equal(totals.customers, 2);
});

test('totals: kept and broken percents use the reconciled shares', () => {
  const totals = wadaDashboardTotals(MIXED);
  assert.equal(totals.keptShare, 43);
  assert.equal(totals.keptLateShare, 14);
  assert.equal(totals.brokenShare, 29);
  assert.equal(totals.pendingShare, 14);
  assert.equal(totals.keptShare + totals.keptLateShare + totals.brokenShare + totals.pendingShare, 100);
  assert.equal(totals.keptPercent, 57);
  assert.equal(totals.brokenPercent, 29);
});

test('totals: inputs are never mutated', () => {
  const list = [wada('WD-1', 'CUST-1', 'kept'), wada('WD-2', 'CUST-1', 'broken')];
  const before = JSON.stringify(list);
  wadaDashboardTotals(list);
  wadaDashboardCustomers(list, CUSTOMERS);
  assert.equal(JSON.stringify(list), before);
});

test('pie: slices come in fixed order with labels and colours', () => {
  const pie = wadaDashboardPie(MIXED);
  assert.deepEqual(pie.map((slice) => slice.key), ['kept', 'keptLate', 'broken', 'pending']);
  assert.deepEqual(pie.map((slice) => slice.label), ['Kept on time', 'Kept late', 'Broken', 'Still open']);
  assert.deepEqual(pie.map((slice) => slice.count), [3, 1, 2, 1]);
  assert.deepEqual(WADA_DASHBOARD_SLICES.map((slice) => slice.color), ['#16a34a', '#d97706', '#dc2626', '#94a3b8']);
});

test('pie: shares always add to 100, even for thirds', () => {
  const pie = wadaDashboardPie([
    wada('WD-1', 'CUST-1', 'kept'),
    wada('WD-2', 'CUST-1', 'keptLate'),
    wada('WD-3', 'CUST-1', 'broken'),
  ]);
  assert.deepEqual(pie.map((slice) => slice.share), [34, 33, 33, 0]);
  assert.equal(pie.reduce((sum, slice) => sum + slice.share, 0), 100);
});

test('pie: a single outcome takes the whole pie', () => {
  const pie = wadaDashboardPie([wada('WD-1', 'CUST-1', 'pending')]);
  assert.deepEqual(pie.map((slice) => slice.share), [0, 0, 0, 100]);
});

test('pie: empty list gives all-zero slices', () => {
  const pie = wadaDashboardPie([]);
  assert.deepEqual(pie.map((slice) => slice.share), [0, 0, 0, 0]);
  assert.deepEqual(pie.map((slice) => slice.count), [0, 0, 0, 0]);
});

test('points: kept on time and kept late are +5, broken is -5, open is nothing', () => {
  assert.equal(WADA_DASHBOARD_POINTS_KEPT, 5);
  assert.equal(WADA_DASHBOARD_POINTS_BROKEN, -5);
  assert.equal(wadaDashboardPointsForCounts({ kept: 1, keptLate: 0, broken: 0 }), 5);
  assert.equal(wadaDashboardPointsForCounts({ kept: 0, keptLate: 1, broken: 0 }), 5);
  assert.equal(wadaDashboardPointsForCounts({ kept: 0, keptLate: 0, broken: 1 }), -5);
  assert.equal(wadaDashboardPointsForCounts({ kept: 0, keptLate: 0, broken: 0, pending: 3 }), 0);
  assert.equal(wadaDashboardPointsForCounts({ kept: 1, keptLate: 1, broken: 1 }), 5);
});

test('points: twenty net kept wadas reach the 100-point trusted mark', () => {
  assert.equal(WADA_DASHBOARD_TRUSTED_POINTS, 100);
  const kept = Array.from({ length: 20 }, (_, i) => wada(`WD-${i + 1}`, 'CUST-1', 'kept'));
  const stats = wadaDashboardCustomerStats(kept, 'CUST-1');
  assert.equal(stats.points, 100);
  assert.equal(stats.trusted, true);
});

test('points: 95 points is not trusted', () => {
  const kept = Array.from({ length: 19 }, (_, i) => wada(`WD-${i + 1}`, 'CUST-1', 'kept'));
  const stats = wadaDashboardCustomerStats(kept, 'CUST-1');
  assert.equal(stats.points, 95);
  assert.equal(stats.trusted, false);
});

test('points: broken wadas can pull points below zero', () => {
  const stats = wadaDashboardCustomerStats([
    wada('WD-1', 'CUST-1', 'broken'),
    wada('WD-2', 'CUST-1', 'broken'),
    wada('WD-3', 'CUST-1', 'broken'),
  ], 'CUST-1');
  assert.equal(stats.points, -15);
  assert.equal(stats.trusted, false);
  assert.equal(stats.chancePercent, 0);
});

test('chance: kept over closed wadas, as a whole percent', () => {
  assert.equal(wadaDashboardChanceForCounts({ kept: 3, keptLate: 0, broken: 1 }), 75);
  assert.equal(wadaDashboardChanceForCounts({ kept: 1, keptLate: 1, broken: 1 }), 67);
  assert.equal(wadaDashboardChanceForCounts({ kept: 2, keptLate: 0, broken: 0 }), 100);
  assert.equal(wadaDashboardChanceForCounts({ kept: 0, keptLate: 0, broken: 2 }), 0);
});

test('chance: no closed wada means no history and no chance', () => {
  assert.equal(wadaDashboardChanceForCounts({ kept: 0, keptLate: 0, broken: 0, pending: 2 }), null);
  assert.equal(wadaDashboardChanceForCounts({ kept: 0, keptLate: 0, broken: 0 }), null);
});

test('customer stats: counts, points, trust, and chance for one customer', () => {
  const stats = wadaDashboardCustomerStats(MIXED, 'CUST-1');
  assert.equal(stats.kept, 1);
  assert.equal(stats.keptLate, 1);
  assert.equal(stats.broken, 2);
  assert.equal(stats.pending, 1);
  assert.equal(stats.total, 5);
  assert.equal(stats.points, 0);
  assert.equal(stats.trusted, false);
  assert.equal(stats.chancePercent, 50);
});

test('customer stats: unknown customer reads as no wadas', () => {
  const stats = wadaDashboardCustomerStats(MIXED, 'CUST-9');
  assert.equal(stats.total, 0);
  assert.equal(stats.points, 0);
  assert.equal(stats.trusted, false);
  assert.equal(stats.chancePercent, null);
});

test('customers: rows sort by points first, then name', () => {
  const rows = wadaDashboardCustomers([
    wada('WD-1', 'CUST-1', 'kept'),
    wada('WD-2', 'CUST-1', 'kept'),
    wada('WD-3', 'CUST-2', 'kept'),
    wada('WD-4', 'CUST-2', 'broken'),
    wada('WD-5', 'CUST-3', 'kept'),
    wada('WD-6', 'CUST-3', 'kept'),
    wada('WD-7', 'CUST-3', 'kept'),
    wada('WD-8', 'CUST-3', 'kept'),
    wada('WD-9', 'CUST-3', 'kept'),
  ], CUSTOMERS);
  assert.deepEqual(rows.map((row) => row.name), ['Customer Three', 'Customer One', 'Customer Two']);
  assert.deepEqual(rows.map((row) => row.points), [25, 10, 0]);
});

test('customers: display name comes from the caller list, key when missing', () => {
  const rows = wadaDashboardCustomers([
    wada('WD-1', 'CUST-1', 'kept'),
    wada('WD-2', 'CUST-9', 'kept'),
  ], CUSTOMERS);
  assert.equal(rows.find((row) => row.customer === 'CUST-1').name, 'Customer One');
  assert.equal(rows.find((row) => row.customer === 'CUST-9').name, 'CUST-9');
});

test('search: name substring, case-insensitive, blank returns all', () => {
  const rows = wadaDashboardCustomers(MIXED, CUSTOMERS);
  assert.equal(wadaDashboardSearchRows(rows, '').length, 2);
  assert.equal(wadaDashboardSearchRows(rows, '  ').length, 2);
  assert.deepEqual(wadaDashboardSearchRows(rows, 'one').map((row) => row.name), ['Customer One']);
  assert.deepEqual(wadaDashboardSearchRows(rows, 'TWO').map((row) => row.name), ['Customer Two']);
  assert.deepEqual(wadaDashboardSearchRows(rows, 'zzz'), []);
});

test('search: recorded key matches too', () => {
  const rows = wadaDashboardCustomers(MIXED, CUSTOMERS);
  assert.equal(wadaDashboardSearchRows(rows, 'cust-2').length, 1);
  assert.equal(wadaDashboardSearchRows(rows, 'cust-2')[0].name, 'Customer Two');
});

test('summary: empty and mixed totals in plain words', () => {
  assert.equal(wadaDashboardSummaryText(wadaDashboardTotals([])), 'No wadas recorded yet.');
  assert.equal(
    wadaDashboardSummaryText(wadaDashboardTotals(MIXED)),
    '2 customers made 7 wadas: 3 kept on time, 1 kept late, 2 broken, 1 still open. Kept: 57% · Broken: 29%.'
  );
});

test('customer text: trusted, chance, and no-history lines', () => {
  const kept = Array.from({ length: 20 }, (_, i) => wada(`WD-${i + 1}`, 'CUST-1', 'kept'));
  assert.equal(
    wadaDashboardCustomerText({ ...wadaDashboardCustomerStats(kept, 'CUST-1'), name: 'Customer One' }),
    'Customer One — 20 kept on time · 0 kept late · 0 broken · 0 still open. Points: 100. Trusted — keeps wadas.'
  );
  assert.equal(
    wadaDashboardCustomerText({ ...wadaDashboardCustomerStats(MIXED, 'CUST-1'), name: 'Customer One' }),
    'Customer One — 1 kept on time · 1 kept late · 2 broken · 1 still open. Points: 0. 50% chance to keep a wada, from history.'
  );
  assert.equal(
    wadaDashboardCustomerText({ ...wadaDashboardCustomerStats([wada('WD-1', 'CUST-1', 'pending')], 'CUST-1'), name: 'Customer One' }),
    'Customer One — 0 kept on time · 0 kept late · 0 broken · 1 still open. Points: 0. No closed wadas yet — no history to rate.'
  );
});

test('html: totals, pie gradient, legend, and status chips', () => {
  const totals = wadaDashboardTotals(MIXED);
  const rows = wadaDashboardCustomers(MIXED, CUSTOMERS);
  const html = wadaDashboardHtml(totals, rows);
  assert.ok(html.includes('2 customers made 7 wadas'), 'totals line present');
  assert.ok(html.includes('conic-gradient('), 'pie chart present');
  assert.ok(html.includes('Kept on time — 3 (43%)'), 'legend kept present');
  assert.ok(html.includes('Broken — 2 (29%)'), 'legend broken present');
  assert.ok(html.includes('Customer One'), 'customer row present');
  assert.ok(html.includes('50% chance to keep a wada'), 'red chance chip present');
  assert.ok(html.includes('#b91c1c'), 'red chip colour present');
});

test('html: trusted customer shows a green Trusted chip', () => {
  const kept = Array.from({ length: 20 }, (_, i) => wada(`WD-${i + 1}`, 'CUST-1', 'kept'));
  const html = wadaDashboardHtml(wadaDashboardTotals(kept), wadaDashboardCustomers(kept, CUSTOMERS));
  assert.ok(html.includes('Trusted'), 'Trusted chip present');
  assert.ok(html.includes('#15803d'), 'green chip colour present');
});

test('html: no rows shows the no-match line, empty totals show the empty pie line', () => {
  const html = wadaDashboardHtml(wadaDashboardTotals(MIXED), []);
  assert.ok(html.includes('No customers match this search.'), 'no-match line present');
  const emptyHtml = wadaDashboardHtml(wadaDashboardTotals([]), []);
  assert.ok(emptyHtml.includes('No wadas recorded yet'), 'empty totals line present');
  assert.ok(emptyHtml.includes('No wadas recorded yet — the pie chart appears once a wada is recorded.'), 'empty pie line present');
});

test('html: customer names are escaped', () => {
  const rows = wadaDashboardCustomers(
    [wada('WD-1', 'CUST-1', 'kept')],
    [{ id: 'CUST-1', name: '<script>alert(1)</script>' }]
  );
  const html = wadaDashboardHtml(wadaDashboardTotals([wada('WD-1', 'CUST-1', 'kept')]), rows);
  assert.ok(html.includes('&lt;script&gt;'), 'name escaped');
  assert.ok(!html.includes('<script>alert'), 'raw script tag absent');
});

test('csv: header and one row per customer', () => {
  const rows = wadaDashboardCustomers(MIXED, CUSTOMERS);
  const csv = wadaDashboardCsv(rows);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'customer,name,kept_on_time,kept_late,broken,still_open,total,points,trusted,chance_percent');
  assert.equal(lines.length, 3);
  assert.ok(lines[1].startsWith('CUST-2,Customer Two,2,0,0,0,2,10,no,100'), 'first row is the best-points customer');
  assert.ok(lines[2].startsWith('CUST-1,Customer One,1,1,2,1,5,0,no,50'), 'second row follows');
  assert.equal(wadaDashboardFilename(), 'wada-dashboard.csv');
});

test('fences: the module never names the neighbouring promise modules', () => {
  assert.ok(!moduleSrc.includes('waada-queue'), 'must not name the single-live-promise module');
  assert.ok(!moduleSrc.includes('collection-promise'), 'must not name the amount-required history module');
  assert.ok(!moduleSrc.includes('promise-tracker'), 'must not name the service-promise tracker');
  assert.ok(!moduleSrc.includes('promise-delivery-check'), 'must not name the service-promise delivery check');
  assert.ok(!moduleSrc.includes('wada-record.js'), 'must not name the data-source file');
});

test('purity: no storage, clock, network, page, or standalone OLT use', () => {
  assert.ok(!moduleSrc.includes('document.'), 'no document access');
  assert.ok(!moduleSrc.includes('localStorage'), 'no localStorage');
  assert.ok(!moduleSrc.includes('new Date('), 'no new Date(');
  assert.ok(!moduleSrc.includes('Date.now('), 'no Date.now(');
  assert.ok(!moduleSrc.includes('fetch('), 'no fetch');
  assert.ok(!moduleSrc.includes('window.'), 'no window');
  assert.ok(!moduleSrc.includes('import '), 'no imports');
  assert.ok(!/\bOLT\b/.test(moduleSrc), 'no standalone OLT word');
});

test('wiring: app.js imports the module and renders the dashboard', () => {
  assert.ok(appJs.includes("from './wada-dashboard.js'"), 'app.js imports the module');
  assert.ok(appJs.includes('renderWadaDashboard()'), 'app.js calls the render function');
  assert.ok(appJs.includes('loadWadaRecords()'), 'app.js reads the wada store for the dashboard');
});

test('wiring: index.html carries the dashboard panel', () => {
  assert.ok(indexHtml.includes('id="wdbHeading"'), 'panel heading present');
  assert.ok(indexHtml.includes('id="wdbSummary"'), 'summary present');
  assert.ok(indexHtml.includes('id="wdbSearch"'), 'search input present');
  assert.ok(indexHtml.includes('id="wdbSearchBtn"'), 'search button present');
  assert.ok(indexHtml.includes('id="wdbExportBtn"'), 'export button present');
  assert.ok(indexHtml.includes('id="wdbBody"'), 'dashboard body present');
});
