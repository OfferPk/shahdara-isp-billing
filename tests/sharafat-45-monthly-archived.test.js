// Sharafat 45: the monthly report excludes archived customers from its
// rows, count and totals by default — with a toggle (builder option
// includeArchived) to bring them back. Every fixture here is synthetic;
// no real customer names or phone numbers (this fixture needs no phones).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildMonthlyReport, calculateMethodTotalsForRows } from '../core.js';
import { monthlyReportCsvRows, sortMonthlyReportRows } from '../form-validation.js';
import { canonicalMohalla } from '../phase3.js';

// 2026-10-29 12:00 PKT: the fixture month 2026-10 is the previous month.
const REF = new Date(Date.UTC(2026, 9, 29, 7));
const MONTH = '2026-10';
const bill = (overrides) => ({ payments: [], ...overrides });
const customer = (id, fields, bills) => ({ id, customerNumber: id, name: `Customer ${id}`, archived: false, ...fields, bills });

// One live customer (3000 billed, 1000 Cash received, Charyaa) + one
// archived customer (3000 billed, 3000 Cash received, Gangall) on 2026-10.
// The archived customer's cash is real money already received — the
// exclusion is about the LIVE book, not about pretending it never arrived.
function fixture() {
  return {
    customers: [
      customer('c1', { mohalla: 'Charyaa' }, [
        bill({ month: MONTH, dueAmount: 3000, dueDate: '2026-10-05', payments: [{ date: '2026-10-15', amount: 1000, method: 'Cash' }] }),
      ]),
      customer('c2', { mohalla: 'Gangall', archived: true }, [
        bill({ month: MONTH, dueAmount: 3000, dueDate: '2026-10-05', payments: [{ date: '2026-10-15', amount: 3000, method: 'Cash' }] }),
      ]),
    ],
  };
}

const totals = (rows) => ({
  count: rows.length,
  billed: rows.reduce((s, r) => s + (r.billAmount || 0), 0),
  collected: rows.reduce((s, r) => s + (r.amountReceived || 0), 0),
  balance: rows.reduce((s, r) => s + (r.balanceDue || 0), 0),
});

// The screen-rows pipeline, mirroring getMonthlyReportScreenRows in app.js:
// build → area drill-down → sort. The wiring pin below locks the app side
// to the same helper, so this mirror cannot drift silently.
function screenRows(state, { statusFilter, area, sortBy, includeArchived = false }) {
  const rows = buildMonthlyReport(state, { month: MONTH, statusFilter, customerQuery: '', includeArchived }, REF);
  const areaKey = area ? canonicalMohalla(area)?.key : null;
  const filtered = areaKey ? rows.filter(row => (canonicalMohalla(row.area)?.key ?? 'unassigned') === areaKey) : rows;
  return { rows: sortMonthlyReportRows(filtered, sortBy), totalRows: rows.length };
}

test('acceptance: archived customers are excluded from rows, count and totals by default', () => {
  const state = fixture();
  const rows = buildMonthlyReport(state, { month: MONTH }, REF);
  assert.deepEqual(totals(rows), { count: 1, billed: 3000, collected: 1000, balance: 2000 });
  assert.deepEqual(rows.map(row => row.customerNumber), ['c1']);
  assert.equal(rows[0].archived, false);
});

test('toggle ON (includeArchived: true) returns both rows and keeps the archived flag', () => {
  const state = fixture();
  const rows = buildMonthlyReport(state, { month: MONTH, includeArchived: true }, REF);
  assert.deepEqual(totals(rows), { count: 2, billed: 6000, collected: 4000, balance: 2000 });
  const archived = rows.find(row => row.customerNumber === 'c2');
  assert.equal(archived.archived, true); // the tag's data survives the toggle
});

test('method chips and the CSV agree with the toggle: both describe the same rows', () => {
  const state = fixture();
  const off = buildMonthlyReport(state, { month: MONTH }, REF);
  assert.equal(calculateMethodTotalsForRows(off, state).Cash, 1000);
  assert.equal(calculateMethodTotalsForRows(off, state).Cash, totals(off).collected);
  assert.deepEqual(monthlyReportCsvRows(off, state.customers).map(row => row.customerNumber), ['c1']);
  const on = buildMonthlyReport(state, { month: MONTH, includeArchived: true }, REF);
  assert.equal(calculateMethodTotalsForRows(on, state).Cash, 4000);
  assert.equal(calculateMethodTotalsForRows(on, state).Cash, totals(on).collected);
  assert.deepEqual(monthlyReportCsvRows(on, state.customers).map(row => row.customerNumber), ['c1', 'c2']);
});

test('area drill-down: an archived-only area shows 0 rows with the toggle off, the row with it on', () => {
  const state = fixture();
  // Gangall holds only the archived customer; Charyaa holds the live one.
  // The mohalla cards include archived customers (Sharafat 40), so the
  // drill-down into Gangall is exactly the 0-row interaction: the empty
  // state names the archived hint instead of staying silent (pinned below).
  const off = screenRows(state, { statusFilter: 'all', area: 'Gangall', sortBy: 'number-asc' });
  assert.deepEqual(off.rows, []);
  assert.equal(off.totalRows, 1); // pre-drill-down total is the live book
  const on = screenRows(state, { statusFilter: 'all', area: 'Gangall', sortBy: 'number-asc', includeArchived: true });
  assert.deepEqual(on.rows.map(row => row.customerNumber), ['c2']);
  const liveArea = screenRows(state, { statusFilter: 'all', area: 'Charyaa', sortBy: 'number-asc' });
  assert.deepEqual(liveArea.rows.map(row => row.customerNumber), ['c1']);
});

test('status filter interplay: the exclusion is orthogonal to status', () => {
  const state = fixture();
  // The archived customer is PAID (3000/3000); the live one is PARTIAL.
  const paidOff = buildMonthlyReport(state, { month: MONTH, statusFilter: 'paid' }, REF);
  assert.deepEqual(paidOff.map(row => row.customerNumber), []);
  const paidOn = buildMonthlyReport(state, { month: MONTH, statusFilter: 'paid', includeArchived: true }, REF);
  assert.deepEqual(paidOn.map(row => row.customerNumber), ['c2']);
  const partialOff = buildMonthlyReport(state, { month: MONTH, statusFilter: 'partial' }, REF);
  assert.deepEqual(partialOff.map(row => row.customerNumber), ['c1']);
});

test('wiring: the toggle reaches the builder, the empty state names the hint, and the keys exist', () => {
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const languageSource = readFileSync(new URL('../nav-language.js', import.meta.url), 'utf8');
  // getMonthlyReportScreenRows passes the toggle into the builder.
  assert.ok(appSource.includes('includeArchived: includeArchivedInReport'));
  // The checkbox flips the module state and re-renders; the render syncs
  // the checkbox back, the same way the pills' aria-pressed is synced.
  assert.ok(appSource.includes("$('#reportIncludeArchived')?.addEventListener('change'"));
  assert.ok(appSource.includes('archivedToggle.checked = includeArchivedInReport'));
  // The empty-state probe only runs on the empty path and names the hint.
  assert.ok(appSource.includes("buildMonthlyReport(state, { month, statusFilter: selectedReportFilter, customerQuery: probeQuery, includeArchived: true })"));
  assert.ok(appSource.includes("t('bill_empty_archived_hint')"));
  // The checkbox sits beside the status pills and reuses bill_row_archived.
  assert.ok(indexHtml.includes('id="reportIncludeArchived"'));
  assert.ok(indexHtml.includes('data-i18n="bill_row_archived"'));
  // The hint key pair exists in both dicts (EN + UR).
  assert.equal(languageSource.split('bill_empty_archived_hint').length - 1, 2);
});
