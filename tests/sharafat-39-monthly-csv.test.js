// Sharafat 39: the monthly CSV export carries exactly the rows on screen
// (status × search × area, sorted by the current sort) — and the Name /
// Mohalla / Phone columns are filled, not empty. Every fixture here is
// synthetic; no real customer names or phone numbers (phones are the
// pattern-fake 0301234567x family only).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildMonthlyReport } from '../core.js';
import {
  generateCsvContent,
  monthlyReportCsvFilename,
  monthlyReportCsvNote,
  monthlyReportCsvRows,
  sortMonthlyReportRows,
} from '../form-validation.js';
import { canonicalMohalla } from '../phase3.js';

// 2026-11-15 12:00 PKT: current month 2026-11, previous 2026-10.
const REF = new Date(Date.UTC(2026, 10, 15, 7));
const MONTH = '2026-11';
const HEADERS = [
  { key: 'customerNumber', label: 'Customer #' },
  { key: 'name', label: 'Customer Name' },
  { key: 'mohalla', label: 'Mohalla' },
  { key: 'phone', label: 'Phone' },
  { key: 'billAmount', label: 'Bill Due (PKR)' },
  { key: 'amountReceived', label: 'Paid (PKR)' },
  { key: 'balanceDue', label: 'Balance (PKR)' },
  { key: 'status', label: 'Status' },
];
const bill = (overrides) => ({ payments: [], ...overrides });
const customer = (id, fields, bills) => ({ id, customerNumber: id, name: `Customer ${id}`, archived: false, ...fields, bills });
const csvLines = (csv) => csv.replace(/^\uFEFF/, '').split('\r\n');

// November fixture: c1 Kishti pending (nothing paid), c2 Kishti partial Cash
// 400, c3 Barrian paid Cash 1000, c4 Kishti partial with a CROSS-MONTH
// JazzCash 500 (dated December, on the November bill), c5 Barrian pending
// with only a VOIDED Cash 700, c6 Kishti with no November bill (not-set).
// c1 carries the primary phone, c2 only the legacy customerPhone alias,
// c3–c6 carry no phone at all.
function monthlyFixture() {
  return {
    customers: [
      customer('c1', { mohalla: 'Kishti', phone: '03012345678' }, [
        bill({ month: MONTH, dueAmount: 1000, dueDate: '2026-11-05' }),
      ]),
      customer('c2', { mohalla: 'Kishti', customerPhone: '03012345679' }, [
        bill({ month: MONTH, dueAmount: 2000, dueDate: '2026-11-05', payments: [{ date: '2026-11-06', amount: 400, method: 'Cash' }] }),
      ]),
      customer('c3', { mohalla: 'Barrian' }, [
        bill({ month: MONTH, dueAmount: 1000, dueDate: '2026-11-05', payments: [{ date: '2026-11-07', amount: 1000, method: 'Cash' }] }),
      ]),
      customer('c4', { mohalla: 'Kishti' }, [
        bill({ month: MONTH, dueAmount: 3000, dueDate: '2026-11-05', payments: [{ date: '2026-12-02', amount: 500, method: 'JazzCash' }] }),
      ]),
      customer('c5', { mohalla: 'Barrian' }, [
        bill({ month: MONTH, dueAmount: 1000, dueDate: '2026-11-05', payments: [{ date: '2026-11-08', amount: 700, method: 'Cash', voided: true }] }),
      ]),
      customer('c6', { mohalla: 'Kishti' }, []),
    ],
  };
}

// The screen-rows pipeline, mirroring getMonthlyReportScreenRows in app.js:
// build → area drill-down → sort. The wiring pin below locks the app side
// to the same helper, so this mirror cannot drift silently.
function screenRows(state, { statusFilter, area, sortBy }) {
  const rows = buildMonthlyReport(state, { month: MONTH, statusFilter, customerQuery: '' }, REF);
  const areaKey = area ? canonicalMohalla(area)?.key : null;
  const filtered = areaKey ? rows.filter(row => (canonicalMohalla(row.area)?.key ?? 'unassigned') === areaKey) : rows;
  return { rows: sortMonthlyReportRows(filtered, sortBy), totalRows: rows.length };
}

const noteRowFor = (note) => ({ customerNumber: note, name: '', mohalla: '', phone: '', billAmount: '', amountReceived: '', balanceDue: '', status: '' });

test('area-filtered export equals the screen rows: same customers, same order (balance-desc)', () => {
  const state = monthlyFixture();
  // The drill-down sets status 'outstanding' (pending + partial) and the
  // area filter: Kishti rows are c4 (2500), c2 (1600), c1 (1000).
  const { rows, totalRows } = screenRows(state, { statusFilter: 'outstanding', area: 'Kishti', sortBy: 'balance-desc' });
  assert.deepEqual(rows.map(row => row.customerNumber), ['c4', 'c2', 'c1']);
  assert.equal(totalRows, 4); // c1, c2, c4, c5 outstanding before the area filter
  const note = monthlyReportCsvNote({ rowCount: rows.length, totalRows, monthLabel: 'November 2026', statusLabel: 'Pending + Partial', areaLabel: 'Kishti' });
  const csv = generateCsvContent(HEADERS, [noteRowFor(note), ...monthlyReportCsvRows(rows, state.customers)]);
  const lines = csvLines(csv);
  assert.equal(lines[0], 'Customer #,Customer Name,Mohalla,Phone,Bill Due (PKR),Paid (PKR),Balance (PKR),Status');
  assert.ok(lines[1].startsWith('Note: Filtered view: showing 3 of 4 rows'));
  assert.deepEqual(lines.slice(2).map(line => line.split(',')[0]), ['c4', 'c2', 'c1']);
  assert.ok(lines[2].includes('Customer c4,Kishti,'));
  assert.ok(lines[3].includes('Customer c2,Kishti,'));
  assert.ok(lines[4].includes('Customer c1,Kishti,'));
});

test('sort applied: name-asc order in the file matches the screen order', () => {
  const state = monthlyFixture();
  const { rows } = screenRows(state, { statusFilter: 'all', area: 'Kishti', sortBy: 'name-asc' });
  assert.deepEqual(rows.map(row => row.customerNumber), ['c1', 'c2', 'c4', 'c6']);
  const csv = generateCsvContent(HEADERS, monthlyReportCsvRows(rows, state.customers));
  const lines = csvLines(csv);
  assert.deepEqual(lines.slice(1).map(line => line.split(',')[1]), ['Customer c1', 'Customer c2', 'Customer c4', 'Customer c6']);
});

test('unfiltered export fills Name/Mohalla/Phone columns (mapping, not empty)', () => {
  const state = monthlyFixture();
  const { rows } = screenRows(state, { statusFilter: 'all', area: null, sortBy: 'number-asc' });
  const mapped = monthlyReportCsvRows(rows, state.customers);
  assert.equal(mapped.length, 6);
  // No mapped row has a blank name or mohalla — before Sharafat 39 these
  // three columns exported empty (a fixture row came out as
  // `1,,,,3000,2000,1000,partial`).
  for (const row of mapped) {
    assert.notEqual(row.name, '');
    assert.notEqual(row.mohalla, '');
  }
  const byId = new Map(mapped.map(row => [row.customerNumber, row]));
  assert.equal(byId.get('c1').phone, '03012345678'); // primary phone
  assert.equal(byId.get('c2').phone, '03012345679'); // legacy customerPhone alias
  assert.equal(byId.get('c3').phone, ''); // no phone on record
  assert.equal(byId.get('c5').phone, '');
  assert.equal(monthlyReportCsvFilename(MONTH, false), 'monthly-report-2026-11.csv');
});

test('missing customer never crashes the mapping (phone falls back to empty)', () => {
  const mapped = monthlyReportCsvRows([
    { customerId: 'ghost', customerNumber: 'g1', customerName: 'Ghost', area: 'Kishti', billAmount: 100, amountReceived: 0, balanceDue: 100, status: 'pending' },
  ], monthlyFixture().customers);
  assert.equal(mapped.length, 1);
  assert.equal(mapped[0].phone, '');
  assert.equal(mapped[0].name, 'Ghost');
  assert.deepEqual(monthlyReportCsvRows(null), []);
  assert.deepEqual(monthlyReportCsvRows(undefined, undefined), []);
});

test('filtered filename + note text appear only when the area filter is active', () => {
  assert.equal(monthlyReportCsvFilename(MONTH, true), 'monthly-report-2026-11_filtered.csv');
  assert.equal(monthlyReportCsvFilename(MONTH, false), 'monthly-report-2026-11.csv');
  assert.equal(monthlyReportCsvFilename(MONTH), 'monthly-report-2026-11.csv');
  assert.equal(
    monthlyReportCsvNote({ rowCount: 3, totalRows: 4, monthLabel: 'November 2026', statusLabel: 'Pending + Partial', areaLabel: 'Kishti' }),
    'Note: Filtered view: showing 3 of 4 rows · month November 2026 · status Pending + Partial · area Kishti; the CSV rows cover only the visible report entries.'
  );
  // The note row carries all 8 header keys (first = note, rest '') so
  // generateCsvContent never misaligns it — same shape as the register's.
  const note = monthlyReportCsvNote({ rowCount: 3, totalRows: 4, monthLabel: 'November 2026', statusLabel: 'Pending + Partial', areaLabel: 'Kishti' });
  const csv = generateCsvContent(HEADERS, [noteRowFor(note)]);
  const lines = csvLines(csv);
  assert.equal(lines.length, 2);
  assert.equal(lines[1].split(',').length, 8);
  assert.ok(lines[1].startsWith('Note: Filtered view: showing 3 of 4 rows'));
  assert.ok(lines[1].endsWith(',,,,,,,'));
});

test('empty filtered set exports headers (+ note row) and zero data rows', () => {
  const state = monthlyFixture();
  const { rows, totalRows } = screenRows(state, { statusFilter: 'outstanding', area: 'Charyaa', sortBy: 'number-asc' });
  assert.deepEqual(rows, []);
  assert.equal(totalRows, 4);
  const note = monthlyReportCsvNote({ rowCount: 0, totalRows, monthLabel: 'November 2026', statusLabel: 'Pending + Partial', areaLabel: 'Charyaa' });
  const csv = generateCsvContent(HEADERS, [noteRowFor(note), ...monthlyReportCsvRows(rows, state.customers)]);
  const lines = csvLines(csv);
  assert.equal(lines.length, 2); // header + note, no data rows
  assert.ok(lines[1].startsWith('Note: Filtered view: showing 0 of 4 rows'));
  const plain = generateCsvContent(HEADERS, monthlyReportCsvRows([], state.customers));
  assert.equal(csvLines(plain).length, 1); // header only, no note without a filter
});

test('voided-only payment is excluded from the file Paid/Balance (row figures, not re-derived)', () => {
  const state = monthlyFixture();
  const { rows } = screenRows(state, { statusFilter: 'all', area: null, sortBy: 'number-asc' });
  const mapped = monthlyReportCsvRows(rows, state.customers);
  const c5 = mapped.find(row => row.customerNumber === 'c5');
  // c5 paid Cash 700 but voided it: Paid 0, Balance 1000 — the export must
  // use the row's own figures, never re-sum the payments itself.
  assert.equal(c5.amountReceived, 0);
  assert.equal(c5.balanceDue, 1000);
  const csv = generateCsvContent(HEADERS, mapped);
  const line = csvLines(csv).find(candidate => candidate.startsWith('c5,'));
  assert.equal(line, 'c5,Customer c5,Barrian,,1000,0,1000,pending');
});

test('cross-month payment counts in the export (bill-based rows)', () => {
  const state = monthlyFixture();
  const { rows } = screenRows(state, { statusFilter: 'all', area: null, sortBy: 'number-asc' });
  const mapped = monthlyReportCsvRows(rows, state.customers);
  const c4 = mapped.find(row => row.customerNumber === 'c4');
  // December-dated JazzCash 500 sits on the November bill: it counts in
  // November's Paid (500) and Balance (2500), like the summary bar.
  assert.equal(c4.amountReceived, 500);
  assert.equal(c4.balanceDue, 2500);
  const csv = generateCsvContent(HEADERS, mapped);
  const line = csvLines(csv).find(candidate => candidate.startsWith('c4,'));
  assert.equal(line, 'c4,Customer c4,Kishti,,3000,500,2500,partial');
});

test('wiring: render + export share getMonthlyReportScreenRows; stale import dropped', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  // Exactly three mentions: the definition, the render call, the export call.
  assert.equal(app.match(/getMonthlyReportScreenRows/g).length, 3);
  // The builder is called exactly twice in app.js — once inside the helper
  // (the single report path) and once in Sharafat 45's empty-state probe,
  // which reuses the same builder with includeArchived: true to decide
  // whether the 0-row result is caused by the toggle. The probe renders no
  // rows and is not a second report path; a third call would fail this pin.
  assert.equal(app.match(/buildMonthlyReport\(/g).length, 2);
  // The export handler maps + names the file through the new helpers…
  assert.match(app, /monthlyReportCsvRows\(rows, state\.customers/);
  assert.match(app, /monthlyReportCsvFilename\(month, Boolean\(reportAreaFilter\)\)/);
  // …and the old whole-month helper is gone from app.js entirely: Sharafat
  // 38 replaced its only call site, so the import was dead (its contract
  // still lives in core.js + the self-test, untouched here).
  assert.equal(app.match(/calculateMethodCollectionTotals/g)?.length ?? 0, 0);
});
