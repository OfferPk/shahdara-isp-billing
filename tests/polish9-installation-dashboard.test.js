import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  INSTALLATION_FEE_PIE_COLORS,
  normalizeInstallationFeeList,
  installationFeeRows,
  installationFeeTotals,
  installationFeeGroups,
  installationFeePie,
  installationFeeSummaryText,
  installationFeeRowText,
  installationFeeHtml,
  installationFeeCsv,
  installationFeeFilename,
} from '../installation-dashboard.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'installation-dashboard.js'), 'utf8');

// Generic fixtures only — never real customer names or amounts
// from the user's own data (the polish #5 rule).
const CUSTOMERS = [
  { id: 'CUST-1', name: 'Customer One', connectionFee: 20000 },
  { id: 'CUST-2', name: 'Customer Two', connectionFee: 15000 },
  { id: 'CUST-3', name: 'Customer Three', connectionFee: 10000 },
];

const WITH_MISSING = [
  { id: 'CUST-1', name: 'Customer One', connectionFee: 20000 },
  { id: 'CUST-2', name: 'Customer Two', connectionFee: null },
  { id: 'CUST-3', name: 'Customer Three' },
  { id: 'CUST-4', name: 'Customer Four', connectionFee: 5000 },
];

test('normalize: empty and non-array input read as no customers', () => {
  assert.deepEqual(normalizeInstallationFeeList([]), []);
  assert.deepEqual(normalizeInstallationFeeList(null), []);
  assert.deepEqual(normalizeInstallationFeeList('not a list'), []);
});

test('normalize: one row per customer with id, name, and recorded fee', () => {
  const rows = normalizeInstallationFeeList(CUSTOMERS);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], { id: 'CUST-1', name: 'Customer One', fee: 20000 });
  assert.deepEqual(rows[2], { id: 'CUST-3', name: 'Customer Three', fee: 10000 });
});

test('normalize: missing fee reads as null, never as zero', () => {
  const rows = normalizeInstallationFeeList(WITH_MISSING);
  assert.equal(rows[1].fee, null);
  assert.equal(rows[2].fee, null);
  assert.equal(rows[3].fee, 5000);
});

test('normalize: empty string, unknown text, and negative fees read as no fee recorded', () => {
  const rows = normalizeInstallationFeeList([
    { id: 'CUST-1', name: 'Customer One', connectionFee: '' },
    { id: 'CUST-2', name: 'Customer Two', connectionFee: 'not a fee' },
    { id: 'CUST-3', name: 'Customer Three', connectionFee: -500 },
  ]);
  assert.equal(rows[0].fee, null);
  assert.equal(rows[1].fee, null);
  assert.equal(rows[2].fee, null);
});

test('normalize: a recorded zero fee is a real fee, not a missing one', () => {
  const rows = normalizeInstallationFeeList([
    { id: 'CUST-1', name: 'Customer One', connectionFee: 0 },
  ]);
  assert.equal(rows[0].fee, 0);
  const totals = installationFeeTotals(rows);
  assert.equal(totals.withFee, 1);
  assert.equal(totals.withoutFee, 0);
  const groups = installationFeeGroups(rows);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].fee, 0);
  assert.equal(groups[0].share, 100);
});

test('normalize: numeric-string fees are read as numbers', () => {
  const rows = normalizeInstallationFeeList([
    { id: 'CUST-1', name: 'Customer One', connectionFee: '20000' },
  ]);
  assert.equal(rows[0].fee, 20000);
});

test('normalize: nameless entries and non-objects are left out', () => {
  const rows = normalizeInstallationFeeList([
    { id: 'CUST-1', name: '', connectionFee: 20000 },
    { id: 'CUST-2', connectionFee: 15000 },
    null,
    'not a customer',
    { id: 'CUST-3', name: 'Customer Three', connectionFee: 10000 },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'Customer Three');
});

test('normalize: inputs are never mutated', () => {
  const input = [{ id: 'CUST-1', name: 'Customer One', connectionFee: 20000 }];
  const snapshot = JSON.stringify(input);
  normalizeInstallationFeeList(input);
  installationFeeRows(input);
  assert.equal(JSON.stringify(input), snapshot);
});

test('rows: biggest fee first, then name order, no-fee customers last', () => {
  const rows = installationFeeRows([
    { id: 'CUST-1', name: 'Zed Customer', connectionFee: 5000 },
    { id: 'CUST-2', name: 'Amy Customer', connectionFee: 20000 },
    { id: 'CUST-3', name: 'Bob Customer', connectionFee: 20000 },
    { id: 'CUST-4', name: 'Ann Customer', connectionFee: null },
    { id: 'CUST-5', name: 'Zed No Fee', connectionFee: null },
  ]);
  assert.deepEqual(rows.map((row) => row.name), [
    'Amy Customer',
    'Bob Customer',
    'Zed Customer',
    'Ann Customer',
    'Zed No Fee',
  ]);
});

test('totals: empty list reads as zero customers and zero fees', () => {
  const totals = installationFeeTotals([]);
  assert.equal(totals.totalCustomers, 0);
  assert.equal(totals.withFee, 0);
  assert.equal(totals.withoutFee, 0);
  assert.equal(totals.totalFees, 0);
});

test('totals: the user-example shape — 3 customers, Rs 45,000 collected', () => {
  const totals = installationFeeTotals(normalizeInstallationFeeList(CUSTOMERS));
  assert.equal(totals.totalCustomers, 3);
  assert.equal(totals.withFee, 3);
  assert.equal(totals.withoutFee, 0);
  assert.equal(totals.totalFees, 45000);
});

test('totals: customers without a fee do not add to the collection', () => {
  const totals = installationFeeTotals(normalizeInstallationFeeList(WITH_MISSING));
  assert.equal(totals.totalCustomers, 4);
  assert.equal(totals.withFee, 2);
  assert.equal(totals.withoutFee, 2);
  assert.equal(totals.totalFees, 25000);
});

test('groups: one group per distinct fee, biggest fee first', () => {
  const groups = installationFeeGroups(normalizeInstallationFeeList([
    { id: 'CUST-1', name: 'Customer One', connectionFee: 5000 },
    { id: 'CUST-2', name: 'Customer Two', connectionFee: 20000 },
    { id: 'CUST-3', name: 'Customer Three', connectionFee: 5000 },
    { id: 'CUST-4', name: 'Customer Four', connectionFee: 15000 },
  ]));
  assert.deepEqual(groups.map((group) => group.fee), [20000, 15000, 5000]);
  assert.deepEqual(groups.map((group) => group.count), [1, 1, 2]);
});

test('groups: shares always add to 100 of the customers with a recorded fee', () => {
  const groups = installationFeeGroups(normalizeInstallationFeeList(CUSTOMERS));
  assert.deepEqual(groups.map((group) => group.share), [34, 33, 33]);
  assert.equal(groups.reduce((sum, group) => sum + group.share, 0), 100);
  const uneven = installationFeeGroups(normalizeInstallationFeeList([
    { id: 'CUST-1', name: 'A', connectionFee: 20000 },
    { id: 'CUST-2', name: 'B', connectionFee: 20000 },
    { id: 'CUST-3', name: 'C', connectionFee: 20000 },
    { id: 'CUST-4', name: 'D', connectionFee: 15000 },
    { id: 'CUST-5', name: 'E', connectionFee: 15000 },
    { id: 'CUST-6', name: 'F', connectionFee: 10000 },
    { id: 'CUST-7', name: 'G', connectionFee: 5000 },
  ]));
  assert.deepEqual(uneven.map((group) => group.share), [43, 29, 14, 14]);
  assert.equal(uneven.reduce((sum, group) => sum + group.share, 0), 100);
});

test('groups: no groups when no fee is recorded, one group at 100% for a single fee', () => {
  assert.deepEqual(installationFeeGroups(normalizeInstallationFeeList(WITH_MISSING.slice(1, 3))), []);
  const single = installationFeeGroups(normalizeInstallationFeeList([
    { id: 'CUST-1', name: 'A', connectionFee: 20000 },
    { id: 'CUST-2', name: 'B', connectionFee: 20000 },
  ]));
  assert.equal(single.length, 1);
  assert.equal(single[0].share, 100);
});

test('groups: customers with no fee recorded are never a group', () => {
  const groups = installationFeeGroups(normalizeInstallationFeeList(WITH_MISSING));
  assert.deepEqual(groups.map((group) => group.fee), [20000, 5000]);
  assert.equal(groups.reduce((sum, group) => sum + group.count, 0), 2);
});

test('pie: slices carry labels, colours, counts, and reconciled shares', () => {
  const slices = installationFeePie(normalizeInstallationFeeList(CUSTOMERS));
  assert.equal(slices.length, 3);
  assert.equal(slices[0].label, 'Rs 20,000');
  assert.equal(slices[0].color, INSTALLATION_FEE_PIE_COLORS[0]);
  assert.equal(slices[0].count, 1);
  assert.equal(slices[0].share, 34);
  assert.equal(slices[2].label, 'Rs 10,000');
  assert.deepEqual(installationFeePie([]), []);
});

test('summary: empty totals read as no customers yet', () => {
  assert.equal(installationFeeSummaryText(installationFeeTotals([])), 'No customers recorded yet.');
});

test('summary: totals line names customers and the PKR collection', () => {
  const text = installationFeeSummaryText(installationFeeTotals(normalizeInstallationFeeList(CUSTOMERS)));
  assert.ok(text.includes('3 customers'), 'customer count present');
  assert.ok(text.includes('Rs 45,000'), 'PKR collection present');
  assert.ok(text.includes('3 customers with a fee recorded'), 'fee-recorded count present');
});

test('summary: customers without a fee are counted in plain words', () => {
  const text = installationFeeSummaryText(installationFeeTotals(normalizeInstallationFeeList(WITH_MISSING)));
  assert.ok(text.includes('4 customers'), 'customer count present');
  assert.ok(text.includes('Rs 25,000'), 'PKR collection present');
  assert.ok(text.includes('2 with no fee recorded'), 'missing-fee count present');
});

test('row text: fee row and no-fee row read in plain words', () => {
  assert.equal(installationFeeRowText({ name: 'Customer One', fee: 20000 }), 'Customer One — Rs 20,000.');
  assert.equal(installationFeeRowText({ name: 'Customer Two', fee: null }), 'Customer Two — no fee recorded.');
});

test('html: totals, pie gradient, legend, and per-customer rows', () => {
  const rows = installationFeeRows(CUSTOMERS);
  const html = installationFeeHtml(installationFeeTotals(rows), rows);
  assert.ok(html.includes('3 customers, Rs 45,000 collected'), 'totals line present');
  assert.ok(html.includes('conic-gradient('), 'pie chart present');
  assert.ok(html.includes('Rs 20,000 — 1 (34%)'), 'legend first slice present');
  assert.ok(html.includes('Rs 10,000 — 1 (33%)'), 'legend last slice present');
  assert.ok(html.includes('Customer One'), 'customer row present');
  assert.ok(html.includes('Rs 15,000'), 'fee row present');
});

test('html: a customer with no fee recorded shows the red no-fee line', () => {
  const rows = installationFeeRows(WITH_MISSING);
  const html = installationFeeHtml(installationFeeTotals(rows), rows);
  assert.ok(html.includes('Customer Two'), 'no-fee customer row present');
  assert.ok(html.includes('no fee recorded'), 'no-fee line present');
  assert.ok(html.includes('#b91c1c'), 'red no-fee colour present');
  assert.ok(html.includes('Rs 20,000 — 1 (50%)'), 'pie covers only fee-recorded customers');
});

test('html: empty totals show the empty pie line, no rows show the no-list line', () => {
  const emptyHtml = installationFeeHtml(installationFeeTotals([]), []);
  assert.ok(emptyHtml.includes('No customers recorded yet'), 'empty totals line present');
  assert.ok(emptyHtml.includes('No installation fees recorded yet'), 'empty pie line present');
  const noRowsHtml = installationFeeHtml(installationFeeTotals(normalizeInstallationFeeList(CUSTOMERS)), []);
  assert.ok(noRowsHtml.includes('No customers match this list.'), 'no-list line present');
});

test('html: customer names are escaped', () => {
  const rows = installationFeeRows([{ id: 'CUST-1', name: '<script>alert(1)</script>', connectionFee: 20000 }]);
  const html = installationFeeHtml(installationFeeTotals(rows), rows);
  assert.ok(html.includes('&lt;script&gt;'), 'name escaped');
  assert.ok(!html.includes('<script>alert'), 'raw script tag absent');
});

test('html: money is PKR only, never another currency', () => {
  const rows = installationFeeRows(CUSTOMERS);
  const html = installationFeeHtml(installationFeeTotals(rows), rows);
  assert.ok(html.includes('Rs 45,000'), 'PKR total present');
  assert.ok(!html.includes('$'), 'no dollar sign');
  assert.ok(!html.includes('USD'), 'no USD code');
  assert.ok(!html.includes('EUR'), 'no EUR code');
});

test('csv: header and one row per customer, fee recorded flag', () => {
  const rows = installationFeeRows(WITH_MISSING);
  const csv = installationFeeCsv(rows);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'customer_id,name,installation_fee_pkr,fee_recorded');
  assert.equal(lines.length, 5);
  assert.ok(lines[1].startsWith('CUST-1,Customer One,20000,yes'), 'first row is the biggest fee');
  assert.ok(lines[3].startsWith('CUST-3,Customer Three,,no'), 'no-fee rows follow in name order');
  assert.ok(lines[4].startsWith('CUST-2,Customer Two,,no'), 'last no-fee row');
  assert.equal(installationFeeFilename(), 'installation-dashboard.csv');
});

test('fences: the module never names the neighbouring installation files literally', () => {
  assert.ok(!moduleSrc.includes('install-tracker'), 'must not name the install request tracker');
  assert.ok(!moduleSrc.includes('installation-cost'), 'must not name the installation cost module');
  assert.ok(!moduleSrc.includes('pending-installations'), 'must not name the pending queue module');
  assert.ok(!moduleSrc.includes('installation-completion-gate'), 'must not name the completion gate module');
  assert.ok(!moduleSrc.includes('installment-plan'), 'must not name the bill instalment module');
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
  assert.ok(appJs.includes("from './installation-dashboard.js'"), 'app.js imports the module');
  assert.ok(appJs.includes('renderInstallationDashboard()'), 'app.js calls the render function');
  assert.ok(appJs.includes('state.customers'), 'app.js reads the customer list for the dashboard');
});

test('wiring: index.html carries the dashboard panel', () => {
  assert.ok(indexHtml.includes('id="idaHeading"'), 'panel heading present');
  assert.ok(indexHtml.includes('id="idaSummary"'), 'summary present');
  assert.ok(indexHtml.includes('id="idaExportBtn"'), 'export button present');
  assert.ok(indexHtml.includes('id="idaBody"'), 'dashboard body present');
});
