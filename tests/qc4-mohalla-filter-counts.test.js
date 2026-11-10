// QC-4 — Powerful mohalla filter with per-mohalla pending counts:
// the picker mohalla control lists every mohalla with its pending
// count (and pending PKR), computed from the same pool the picker
// already builds. Counts must agree with the list the filter
// produces — never a separately-computed figure that can drift.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  quickCollectMohallaFilterMatches,
  filterQuickCollectByMohalla,
  quickCollectMohallaPendingCounts,
  quickCollectMohallaFilterCountOptionsHtml,
} from '../quick-collect-mohalla-filter.js';
import { saveBillMonth, addPayment } from '../core.js';
import { renderQuickCollectPickerHtml } from '../nav-quick-collect.js';

const moduleSrc = readFileSync(new URL('../quick-collect-mohalla-filter.js', import.meta.url), 'utf8');
const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
const stylesSrc = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const pageSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const now = new Date();
const month = new Date(now.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 7);
// Small canonical list for the unit tests (the real list has 15);
// spellings follow the Plan 446 fixture convention.
const MOHALLAS = ['BANII', 'GANGALL', 'KISHTII'];

// Picker-shaped entries in dues order, so any re-ordering is the
// counts' own doing, not the fixture's.
function pickerEntries() {
  return [
    { id: 'CUST-2', name: 'Zara Nine', customerNumber: 2, mohalla: 'BANII', area: 'BANII', totalDues: 2000 },
    { id: 'CUST-1', name: 'Ali One', customerNumber: 1, mohalla: 'BANII', area: 'BANII', totalDues: 3000 },
    { id: 'CUST-3', name: 'Bilal Two', customerNumber: 3, mohalla: 'GANGALL', area: 'GANGALL', totalDues: 1500 },
    { id: 'CUST-4', name: 'Danish Four', customerNumber: 4, area: 'GANGALL', totalDues: 1000 },
    { id: 'CUST-5', name: 'Amina Five', customerNumber: 5, totalDues: 500 },
    { id: 'CUST-6', name: 'Sara Six', customerNumber: 6, area: 'Unassigned', totalDues: 700 },
    { id: 'CUST-7', name: 'Omar Seven', customerNumber: 7, mohalla: 'NOWHERE', area: 'NOWHERE', totalDues: 900 },
  ];
}

// A billed state: two mohallas with dues, one settled customer, one
// legacy-area-only customer, one customer with no mohalla at all,
// and one recorded under the literal area 'Unassigned'.
function billedState() {
  const customer = (id, n, name, extra = {}) => ({
    id, customerNumber: n, name, phone: `0301234567${n}`, archived: false, bills: [], ...extra,
  });
  let s = {
    customers: [
      customer('a', 9, 'Zara Nine', { mohalla: 'BANII' }),
      customer('b', 1, 'Ali One', { mohalla: 'BANII' }),
      customer('c', 2, 'Bilal Two', { mohalla: 'GANGALL' }),
      customer('d', 3, 'Chanda Three', { mohalla: 'BANII' }),
      customer('e', 4, 'Danish Four', { area: 'GANGALL' }),
      customer('f', 5, 'Amina Five', {}),
      customer('g', 6, 'Sara Six', { area: 'Unassigned' }),
    ],
  };
  s = saveBillMonth(s, 'a', { month, dueAmount: 2000, status: 'pending' });
  s = saveBillMonth(s, 'b', { month, dueAmount: 3000, status: 'pending' });
  s = saveBillMonth(s, 'c', { month, dueAmount: 1500, status: 'pending' });
  s = saveBillMonth(s, 'd', { month, dueAmount: 1000, status: 'pending' });
  s = addPayment(s, 'd', month, { date: `${month}-01`, amount: 1000, method: 'Cash' });
  s = saveBillMonth(s, 'e', { month, dueAmount: 1000, status: 'pending' });
  s = saveBillMonth(s, 'f', { month, dueAmount: 500, status: 'pending' });
  s = saveBillMonth(s, 'g', { month, dueAmount: 700, status: 'pending' });
  return s;
}

function rowByKey(counts, key) {
  return counts.rows.find((row) => row.key === key);
}

// --- Counts: shape ---

test('counts: one row per canonical mohalla in list order, zeros included', () => {
  const counts = quickCollectMohallaPendingCounts(pickerEntries(), MOHALLAS);
  assert.deepEqual(counts.rows.map((row) => row.mohalla), ['BANII', 'GANGALL', 'KISHTII', 'Unassigned', 'NOWHERE']);
  assert.equal(rowByKey(counts, 'kishtii').count, 0);
  assert.equal(rowByKey(counts, 'kishtii').pendingPkr, 0);
  assert.equal(counts.totalCount, 7);
  assert.equal(counts.totalPendingPkr, 9600);
});

test('counts: each row counts its own mohalla and sums its pending PKR', () => {
  const counts = quickCollectMohallaPendingCounts(pickerEntries(), MOHALLAS);
  assert.equal(rowByKey(counts, 'banii').count, 2);
  assert.equal(rowByKey(counts, 'banii').pendingPkr, 5000);
  assert.equal(rowByKey(counts, 'gangall').count, 2);
  assert.equal(rowByKey(counts, 'gangall').pendingPkr, 2500);
  assert.equal(rowByKey(counts, 'unassigned').count, 2);
  assert.equal(rowByKey(counts, 'unassigned').pendingPkr, 1200);
  assert.equal(rowByKey(counts, 'nowhere').count, 1);
  assert.equal(rowByKey(counts, 'nowhere').pendingPkr, 900);
});

test('counts: the rows add up to the pool — every entry counted exactly once', () => {
  const entries = pickerEntries();
  const counts = quickCollectMohallaPendingCounts(entries, MOHALLAS);
  const rowTotal = counts.rows.reduce((sum, row) => sum + row.count, 0);
  const rowPkr = counts.rows.reduce((sum, row) => sum + row.pendingPkr, 0);
  assert.equal(rowTotal, counts.totalCount);
  assert.equal(rowTotal, entries.length);
  assert.equal(rowPkr, counts.totalPendingPkr);
});

test('counts: spelling variants fold into the canonical row, never a second row', () => {
  const entries = [
    { id: 'CUST-1', name: 'Ali One', customerNumber: 1, mohalla: 'Bani', totalDues: 1000 },
    { id: 'CUST-2', name: 'Zara Nine', customerNumber: 2, mohalla: 'Mohalla Bani', totalDues: 2000 },
    { id: 'CUST-3', name: 'Bilal Two', customerNumber: 3, mohalla: 'BANII', totalDues: 500 },
  ];
  const counts = quickCollectMohallaPendingCounts(entries, MOHALLAS);
  assert.equal(counts.rows.length, 3);
  assert.equal(rowByKey(counts, 'banii').count, 3);
  assert.equal(rowByKey(counts, 'banii').pendingPkr, 3500);
  assert.equal(counts.totalCount, 3);
});

test('counts: the legacy area field counts under that mohalla', () => {
  const entries = [
    { id: 'CUST-1', name: 'Ali One', customerNumber: 1, area: 'GANGALL', totalDues: 1000 },
  ];
  const counts = quickCollectMohallaPendingCounts(entries, MOHALLAS);
  assert.equal(rowByKey(counts, 'gangall').count, 1);
  assert.equal(rowByKey(counts, 'gangall').pendingPkr, 1000);
});

test('counts: no mohalla and a literal Unassigned area fold into one Unassigned row', () => {
  const entries = [
    { id: 'CUST-1', name: 'Ali One', customerNumber: 1, totalDues: 500 },
    { id: 'CUST-2', name: 'Sara Six', customerNumber: 2, area: 'Unassigned', totalDues: 700 },
  ];
  const counts = quickCollectMohallaPendingCounts(entries, MOHALLAS);
  assert.equal(rowByKey(counts, 'unassigned').count, 2);
  assert.equal(rowByKey(counts, 'unassigned').pendingPkr, 1200);
  assert.equal(rowByKey(counts, 'unassigned').mohalla, 'Unassigned');
});

test('counts: no Unassigned row when every entry has a mohalla', () => {
  const counts = quickCollectMohallaPendingCounts(
    [{ id: 'CUST-1', name: 'Ali One', customerNumber: 1, mohalla: 'BANII', totalDues: 1000 }],
    MOHALLAS,
  );
  assert.equal(rowByKey(counts, 'unassigned'), undefined);
  assert.deepEqual(counts.rows.map((row) => row.mohalla), ['BANII', 'GANGALL', 'KISHTII']);
});

test('counts: a non-canonical pool mohalla gets its own row, in name order after the rest', () => {
  const entries = [
    { id: 'CUST-1', name: 'Ali One', customerNumber: 1, mohalla: 'ZULU TOWN', totalDues: 100 },
    { id: 'CUST-2', name: 'Zara Nine', customerNumber: 2, mohalla: 'NOWHERE', totalDues: 200 },
    { id: 'CUST-3', name: 'Bilal Two', customerNumber: 3, mohalla: 'BANII', totalDues: 300 },
  ];
  const counts = quickCollectMohallaPendingCounts(entries, MOHALLAS);
  assert.deepEqual(counts.rows.map((row) => row.mohalla), ['BANII', 'GANGALL', 'KISHTII', 'NOWHERE', 'ZULU TOWN']);
});

test('counts: the selected mohalla is always listed, at 0 when it has nothing pending', () => {
  const counts = quickCollectMohallaPendingCounts(pickerEntries(), MOHALLAS, 'NOWHERE');
  assert.equal(rowByKey(counts, 'nowhere').count, 1);
  const absent = quickCollectMohallaPendingCounts(
    [{ id: 'CUST-1', name: 'Ali One', customerNumber: 1, mohalla: 'BANII', totalDues: 1000 }],
    MOHALLAS,
    'NOWHERE',
  );
  assert.equal(rowByKey(absent, 'nowhere').count, 0);
  assert.equal(rowByKey(absent, 'nowhere').pendingPkr, 0);
  assert.equal(absent.rows[absent.rows.length - 1].mohalla, 'NOWHERE');
});

test('counts: archived entries and entries without an id or name are skipped, like the filter', () => {
  const entries = [
    ...pickerEntries(),
    { id: 'CUST-8', name: 'Hidden Eight', customerNumber: 8, mohalla: 'BANII', totalDues: 9999, archived: true },
    { id: '', name: 'No Id', customerNumber: 9, mohalla: 'BANII', totalDues: 9999 },
    { id: 'CUST-10', name: '', customerNumber: 10, mohalla: 'BANII', totalDues: 9999 },
  ];
  const counts = quickCollectMohallaPendingCounts(entries, MOHALLAS);
  assert.equal(counts.totalCount, 7);
  assert.equal(rowByKey(counts, 'banii').count, 2);
});

test('counts: a missing, non-numeric or negative dues figure counts as PKR 0, never NaN', () => {
  const entries = [
    { id: 'CUST-1', name: 'Ali One', customerNumber: 1, mohalla: 'BANII' },
    { id: 'CUST-2', name: 'Zara Nine', customerNumber: 2, mohalla: 'BANII', totalDues: 'lots' },
    { id: 'CUST-3', name: 'Bilal Two', customerNumber: 3, mohalla: 'BANII', totalDues: -500 },
  ];
  const counts = quickCollectMohallaPendingCounts(entries, MOHALLAS);
  assert.equal(counts.totalCount, 3);
  assert.equal(rowByKey(counts, 'banii').count, 3);
  assert.equal(rowByKey(counts, 'banii').pendingPkr, 0);
  assert.equal(counts.totalPendingPkr, 0);
});

test('counts: the input list is never mutated and every row is a fresh object', () => {
  const entries = pickerEntries();
  const before = JSON.stringify(entries);
  const counts = quickCollectMohallaPendingCounts(entries, MOHALLAS);
  assert.equal(JSON.stringify(entries), before);
  const again = quickCollectMohallaPendingCounts(entries, MOHALLAS);
  assert.notEqual(counts.rows[0], again.rows[0]);
  assert.deepEqual(counts, again);
});

test('counts: an empty pool still lists every canonical mohalla at 0', () => {
  const counts = quickCollectMohallaPendingCounts([], MOHALLAS);
  assert.deepEqual(counts.rows.map((row) => row.mohalla), ['BANII', 'GANGALL', 'KISHTII']);
  assert.equal(counts.totalCount, 0);
  assert.equal(counts.totalPendingPkr, 0);
});

// --- Matches: Unassigned ---

test('matches: Unassigned matches entries with no mohalla and a literal Unassigned area', () => {
  assert.equal(quickCollectMohallaFilterMatches({ totalDues: 500 }, 'Unassigned'), true);
  assert.equal(quickCollectMohallaFilterMatches({ area: 'Unassigned' }, 'Unassigned'), true);
  assert.equal(quickCollectMohallaFilterMatches({ mohalla: '', area: '' }, 'Unassigned'), true);
  assert.equal(quickCollectMohallaFilterMatches({ mohalla: 'BANII' }, 'Unassigned'), false);
  assert.equal(quickCollectMohallaFilterMatches({ area: 'GANGALL' }, 'Unassigned'), false);
});

test('filter: Unassigned lists exactly the entries with no recorded mohalla', () => {
  const filtered = filterQuickCollectByMohalla(pickerEntries(), 'Unassigned');
  assert.deepEqual(filtered.map((e) => e.id), ['CUST-5', 'CUST-6']);
});

// --- Options HTML ---

test('options: All carries the pool total and PKR; rows carry count and PKR', () => {
  const html = quickCollectMohallaFilterCountOptionsHtml(
    quickCollectMohallaPendingCounts(pickerEntries(), MOHALLAS),
    '',
  );
  assert.match(html, /<option value="">All mohallas \(7 · PKR 9,600\)<\/option>/);
  assert.match(html, /<option value="BANII">BANII \(2 · PKR 5,000\)<\/option>/);
  assert.match(html, /<option value="GANGALL">GANGALL \(2 · PKR 2,500\)<\/option>/);
  assert.match(html, /<option value="Unassigned">Unassigned \(2 · PKR 1,200\)<\/option>/);
  assert.match(html, /<option value="NOWHERE">NOWHERE \(1 · PKR 900\)<\/option>/);
});

test('options: the PKR part is omitted when a row — or the whole pool — owes nothing', () => {
  const html = quickCollectMohallaFilterCountOptionsHtml(
    quickCollectMohallaPendingCounts(pickerEntries(), MOHALLAS),
    '',
  );
  assert.match(html, /<option value="KISHTII">KISHTII \(0\)<\/option>/);
  const empty = quickCollectMohallaFilterCountOptionsHtml(
    quickCollectMohallaPendingCounts([], MOHALLAS),
    '',
  );
  assert.match(empty, /<option value="">All mohallas \(0\)<\/option>/);
  assert.match(empty, /<option value="BANII">BANII \(0\)<\/option>/);
});

test('options: the selected row is marked by key, so a variant spelling still selects it', () => {
  const html = quickCollectMohallaFilterCountOptionsHtml(
    quickCollectMohallaPendingCounts(pickerEntries(), MOHALLAS),
    'bani',
  );
  assert.match(html, /<option value="BANII" selected>/);
  const unassigned = quickCollectMohallaFilterCountOptionsHtml(
    quickCollectMohallaPendingCounts(pickerEntries(), MOHALLAS),
    'Unassigned',
  );
  assert.match(unassigned, /<option value="Unassigned" selected>/);
});

test('options: values and labels are escaped before they reach the page', () => {
  const counts = quickCollectMohallaPendingCounts(
    [{ id: 'CUST-1', name: 'Ali One', customerNumber: 1, mohalla: 'A & B', totalDues: 100 }],
    MOHALLAS,
  );
  const html = quickCollectMohallaFilterCountOptionsHtml(counts, '');
  assert.match(html, /<option value="A &amp; B">A &amp; B \(1 · PKR 100\)<\/option>/);
  assert.doesNotMatch(html, /A & B/);
});

test('options: a missing counts object renders only the All option, never a crash', () => {
  assert.equal(
    quickCollectMohallaFilterCountOptionsHtml(null, ''),
    '<option value="">All mohallas (0)</option>',
  );
  assert.equal(
    quickCollectMohallaFilterCountOptionsHtml(undefined, ''),
    '<option value="">All mohallas (0)</option>',
  );
});

// --- Picker integration: counts agree with the list ---

test('picker: the counts rows agree with the customers the picker lists', () => {
  const view = renderQuickCollectPickerHtml(billedState(), '', 'all-dues');
  const sum = view.mohallaCounts.rows.reduce((total, row) => total + row.count, 0);
  assert.equal(sum, view.customers.length);
  assert.equal(view.mohallaCounts.totalCount, view.customers.length);
  for (const row of view.mohallaCounts.rows) {
    assert.equal(
      filterQuickCollectByMohalla(view.customers, row.mohalla).length,
      row.count,
      `row ${row.mohalla} must list exactly its counted customers`,
    );
  }
});

test('picker: selecting a mohalla lists exactly its counted customers, and only them', () => {
  const state = billedState();
  const counts = renderQuickCollectPickerHtml(state, '', 'all-dues').mohallaCounts;
  const banii = renderQuickCollectPickerHtml(state, '', 'all-dues', null, 'BANII');
  assert.equal(banii.customers.length, rowByKey(counts, 'banii').count);
  assert.equal(banii.customers.length, 2);
  for (const entry of banii.customers) {
    assert.equal(quickCollectMohallaFilterMatches(entry, 'BANII'), true);
  }
  const unassigned = renderQuickCollectPickerHtml(state, '', 'all-dues', null, 'Unassigned');
  assert.equal(unassigned.customers.length, rowByKey(counts, 'unassigned').count);
  assert.equal(unassigned.customers.length, 2);
});

test('picker: clearing the mohalla filter restores the full pool', () => {
  const state = billedState();
  const full = renderQuickCollectPickerHtml(state, '', 'all-dues');
  const filtered = renderQuickCollectPickerHtml(state, '', 'all-dues', null, 'BANII');
  assert.ok(filtered.customers.length < full.customers.length);
  const cleared = renderQuickCollectPickerHtml(state, '', 'all-dues', null, '');
  assert.deepEqual(cleared.customers.map((e) => e.id), full.customers.map((e) => e.id));
});

test('picker: counts follow the search query — they count the narrowed pool, not the ledger', () => {
  const state = billedState();
  const view = renderQuickCollectPickerHtml(state, 'zara', 'all-dues');
  assert.equal(view.mohallaCounts.totalCount, 1);
  assert.equal(rowByKey(view.mohallaCounts, 'banii').count, 1);
  assert.equal(rowByKey(view.mohallaCounts, 'gangall').count, 0);
  assert.equal(view.customers.length, 1);
  assert.equal(view.customers[0].name, 'Zara Nine');
});

test('picker: counts follow the bill-status pool — the Paid pool counts paid-up customers at PKR 0', () => {
  const state = billedState();
  const view = renderQuickCollectPickerHtml(state, '', 'paid');
  assert.equal(view.mohallaCounts.totalCount, 1);
  assert.equal(view.mohallaCounts.totalPendingPkr, 0);
  assert.equal(rowByKey(view.mohallaCounts, 'banii').count, 1);
  assert.equal(view.customers.length, 1);
  assert.equal(view.customers[0].name, 'Chanda Three');
});

test('picker: the sort order never changes the counts — oldest-first counts the same pool', () => {
  const state = billedState();
  const byDues = renderQuickCollectPickerHtml(state, '', 'all-dues', null, '', {});
  const byOldest = renderQuickCollectPickerHtml(state, '', 'all-dues', null, '', { sortOrder: 'oldest' });
  assert.deepEqual(byOldest.mohallaCounts, byDues.mohallaCounts);
});

test('picker: the mohalla counts are a fresh object on every render', () => {
  const state = billedState();
  const first = renderQuickCollectPickerHtml(state, '', 'all-dues');
  const second = renderQuickCollectPickerHtml(state, '', 'all-dues');
  assert.notEqual(first.mohallaCounts, second.mohallaCounts);
  assert.deepEqual(first.mohallaCounts, second.mohallaCounts);
});

// --- Wiring: the picker refreshes the select from the same pool ---

test('wiring: renderList rebuilds the mohalla select from the picker counts', () => {
  assert.match(wiringSrc, /mohallaFilterSelect\.innerHTML = quickCollectMohallaFilterCountOptionsHtml\(picked\.mohallaCounts, activeMohallaFilter\)/);
});

test('wiring: the change handler takes a non-canonical value as-is when it resolves to nothing', () => {
  assert.match(wiringSrc, /resolveQuickCollectMohallaFilter\(mohallaFilterSelect\.value, DEFAULT_MOHALLAS\)/);
  assert.match(wiringSrc, /quickCollectMohallaFilterKey\(mohallaFilterSelect\.value\) \? mohallaFilterSelect\.value : ''/);
});

test('wiring: the picker still has exactly one mohalla control — the counted select', () => {
  assert.equal((pageSrc.match(/id="mhfMohallaFilter"/g) || []).length, 1);
  assert.match(pageSrc, /<select id="mhfMohallaFilter"/);
});

test('wiring: no new store key, no new element id, no new hex for QC-4', () => {
  assert.doesNotMatch(moduleSrc, /localStorage/);
  assert.doesNotMatch(moduleSrc, /new Date\(|Date\.now\(/);
  assert.doesNotMatch(moduleSrc, /getElementById|querySelector/);
  assert.doesNotMatch(stylesSrc, /qc4-/);
  assert.doesNotMatch(pageSrc, /qc4-/);
  assert.doesNotMatch(pageSrc, /id="[^"]*qc4[^"]*"/);
});
