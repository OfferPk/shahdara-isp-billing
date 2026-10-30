/**
 * multi-month-matrix.test.js — SISP-70 [P2]: 3 / 6 / 12-Month
 * Historical Financial & Subscriber Growth Matrix.
 *
 * Spec criterion (read-latest.txt, SISP-70): "Selecting 2026-08 to
 * 2026-10 aggregates each month's collections, expenses, net profit,
 * and net subscriber growth with zero horizontal overflow at 390px"
 * (the ≤700px card layout is what removes the overflow — the wiring
 * test pins that the cards exist and the table hides on phones).
 *
 * Pins:
 *  - the spec scenario exactly (Aug–Oct 2026): per-month billed and
 *    collected from the allocation engine, expenses and net profit
 *    from the P&L engine (cash-received basis, stated openly),
 *    downtime hours from the SISP-16 engine, and subscriber movement
 *    (new / churned / net growth / active) from join + archive stamps;
 *  - the two money lenses stay distinct and each agrees with its own
 *    source screen: collected = settled share of the month's bills,
 *    profit = cash received in the month − expenses;
 *  - a voided receipt never collects (engine excludes it);
 *  - churn honesty: an un-archived customer (stamp cleared by core)
 *    counts as churn in NO month; a legacy archive with no stamp
 *    counts in no month's churn and no month's active total; an
 *    undatable customer is surfaced as undatedCustomers, never placed;
 *  - ranges are exactly 3 / 6 / 12 (anything else falls back to 3),
 *    months ascending, a bad end month falls back to the PKT month;
 *  - empty / malformed inputs return zeros, never throw;
 *  - the pure HTML render emits a desktop table and one labelled card
 *    per month from the same rows;
 *  - i18n: every mmx_* key exists in BOTH dictionaries with the same
 *    placeholder shape, and every mmx_* key the module/markup asks t()
 *    or data-i18n for actually exists (mechanical audit);
 *  - wiring: section markup, app.js controller wiring, token-only
 *    CSS, and build-graph reachability (perf budget #219).
 * Synthetic data only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildMultiMonthMatrix,
  renderMultiMonthMatrixHtml,
  normalizeMatrixRange
} from '../multi-month-comparison.js';
import { calculatePnlAnalytics } from '../dashboard-pnl.js';
import { buildMonthlyDowntimeAnalytics } from '../downtime-analytics.js';
import { collectRuntimeFiles } from '../build.mjs';
import { TRANSLATIONS } from '../nav-language.js';

let seq = 0;
const nid = prefix => `${prefix}${String(++seq).padStart(4, '0')}`;
const pay = (date, amount, extra = {}) => ({ id: nid('p'), date, amount, method: 'Cash', ...extra });
const bill = (month, dueAmount, payments = [], extra = {}) => ({ month, dueAmount, payments, ...extra });
const cust = (name, bills, extra = {}) => ({ id: nid('c'), customerNumber: seq, name, bills, ...extra });

// Midday UTC == 17:00 PKT the same day, so PKT day/month are stable.
const OCT_20 = new Date(Date.UTC(2026, 9, 20, 12));

function specState() {
  return {
    customers: [
      cust('Alpha', [
        bill('2026-08', 1000, [pay('2026-08-05', 1000)]),
        bill('2026-09', 1000, [pay('2026-09-10', 500)]),
        bill('2026-10', 1000)
      ], { addedOn: '2026-07-15' }),
      cust('Beta', [
        bill('2026-08', 2000, [pay('2026-08-20', 2000)]),
        bill('2026-09', 2000, [pay('2026-09-08', 2000)]),
        bill('2026-10', 2000, [pay('2026-10-06', 2000)])
      ], { addedOn: '2026-08-03' }),
      cust('Gamma', [
        bill('2026-09', 1500),
        bill('2026-10', 1500)
      ], { addedOn: '2026-09-12', archived: true, archivedAt: '2026-10-18T09:30' }),
      cust('Delta', [
        bill('2026-10', 3000, [pay('2026-10-09', 3000)])
      ], { addedOn: '2026-10-02' })
    ],
    expenses: [
      { id: 'e1', date: '2026-08-10', amount: 5000, category: 'Bandwidth' },
      { id: 'e2', date: '2026-09-05', amount: 4000, category: 'Electricity' },
      { id: 'e3', date: '2026-10-11', amount: 6500, category: 'Bandwidth' }
    ]
  };
}

function specComplaints() {
  return [
    { customerId: 'c-alpha', customerName: 'Alpha', reportedAt: '2026-08-14T10:00', issueCategory: 'Fiber Cut', downtimeHours: 6 },
    { customerId: 'c-alpha', customerName: 'Alpha', reportedAt: '2026-09-03T09:00', issueCategory: 'Fiber Cut', downtimeHours: 4 },
    { customerId: 'c-beta', customerName: 'Beta', reportedAt: '2026-09-21T09:00', issueCategory: 'Power Outage', downtimeHours: 2.5 },
    { customerId: 'AREA_OUTAGE', customerName: 'Area outage', reportedAt: '2026-10-07T08:00', issueCategory: 'Fiber Cut', downtimeHours: 10 },
    { customerId: 'c-delta', customerName: 'Delta', reportedAt: '2026-10-19T08:00', issueCategory: 'ONT Fault', downtimeHours: 3 }
  ];
}

test('spec criterion: 2026-08 → 2026-10 aggregates collections, expenses, profit and subscriber growth per month', () => {
  const matrix = buildMultiMonthMatrix(specState(), specComplaints(), {
    endMonth: '2026-10', rangeMonths: 3, referenceDate: OCT_20
  });
  assert.equal(matrix.endMonth, '2026-10');
  assert.equal(matrix.rangeMonths, 3);
  assert.deepEqual(matrix.months.map(r => r.month), ['2026-08', '2026-09', '2026-10']);
  const [aug, sep, oct] = matrix.months;

  // August: Alpha (joined Jul) + Beta (joined Aug); both bills settled.
  assert.equal(aug.activeSubscribers, 2);
  assert.equal(aug.newConnections, 1);
  assert.equal(aug.churned, 0);
  assert.equal(aug.netGrowth, 1);
  assert.equal(aug.billedCents, 300000);
  assert.equal(aug.collectedCents, 300000);
  assert.equal(aug.collectionPercent, 100);
  assert.equal(aug.expensesCents, 500000);
  assert.equal(aug.netProfitCents, -200000, 'P&L: 3,000 cash received − 5,000 expenses');
  assert.equal(aug.downtimeHours, 6);

  // September: Gamma joins; Alpha half-pays; Gamma pays nothing.
  assert.equal(sep.activeSubscribers, 3);
  assert.equal(sep.newConnections, 1);
  assert.equal(sep.churned, 0);
  assert.equal(sep.netGrowth, 1);
  assert.equal(sep.billedCents, 450000);
  assert.equal(sep.collectedCents, 250000);
  assert.equal(sep.collectionPercent, 55.6);
  assert.equal(sep.expensesCents, 400000);
  assert.equal(sep.netProfitCents, -150000, 'P&L: 2,500 cash received − 4,000 expenses');
  assert.equal(sep.downtimeHours, 6.5);

  // October: Delta joins, Gamma churns (archived 2026-10-18).
  assert.equal(oct.activeSubscribers, 3, 'Alpha + Beta + Delta; Gamma churned out');
  assert.equal(oct.newConnections, 1);
  assert.equal(oct.churned, 1);
  assert.equal(oct.netGrowth, 0);
  assert.equal(oct.billedCents, 750000, 'archived Gamma’s priced October bill still bills, house basis');
  assert.equal(oct.collectedCents, 500000);
  assert.equal(oct.collectionPercent, 66.7);
  assert.equal(oct.expensesCents, 650000);
  assert.equal(oct.netProfitCents, -150000, 'P&L: 5,000 cash received − 6,500 expenses');
  assert.equal(oct.downtimeHours, 13, 'area outage 10 h + customer 3 h, the SISP-16 total');

  // Net subscriber growth across the window: 2 → 3 active (+1 net).
  assert.equal(oct.activeSubscribers - aug.activeSubscribers, 1);
  assert.equal(matrix.months.reduce((s, r) => s + r.netGrowth, 0), 2, 'net growth sums to +2 across the window (3 joined, 1 churned)');
});

test('every figure agrees with its own source engine for the same inputs', () => {
  const state = specState();
  const complaints = specComplaints();
  const matrix = buildMultiMonthMatrix(state, complaints, {
    endMonth: '2026-10', rangeMonths: 3, referenceDate: OCT_20
  });
  const pnl = calculatePnlAnalytics(state, { selectedMonth: '2026-10', windowMonths: 12, referenceDate: OCT_20 });
  for (const row of matrix.months) {
    const pnlRow = pnl.monthlyData.find(m => m.month === row.month);
    assert.equal(row.expensesCents, Math.round(pnlRow.expenses * 100), `${row.month} expenses == P&L screen`);
    assert.equal(row.netProfitCents, Math.round(pnlRow.netProfit * 100), `${row.month} profit == P&L screen`);
    const downtime = buildMonthlyDowntimeAnalytics(complaints, row.month);
    assert.equal(row.downtimeHours, downtime.totalDowntime, `${row.month} downtime == SISP-16 screen`);
  }
});

test('a voided receipt never collects, and an unpriced bill bills nothing', () => {
  const state = {
    customers: [cust('Void User', [
      bill('2026-10', 10000, [pay('2026-10-05', 6000), pay('2026-10-06', 4000, { voided: true })]),
      bill('2026-09', null)
    ], { addedOn: '2026-09-01' })],
    expenses: []
  };
  const matrix = buildMultiMonthMatrix(state, [], { endMonth: '2026-10', rangeMonths: 3, referenceDate: OCT_20 });
  const oct = matrix.months[2];
  assert.equal(oct.billedCents, 1000000);
  assert.equal(oct.collectedCents, 600000, 'only the live receipt settles');
  assert.equal(oct.collectionPercent, 60);
  const sep = matrix.months[1];
  assert.equal(sep.billedCents, 0);
  assert.equal(sep.collectionPercent, null, 'no billed amount → no honest percentage');
});

test('churn honesty: un-archived and undated archives are never placed by guesswork', () => {
  const state = {
    customers: [
      // Archived in August, later restored: core cleared the stamp.
      cust('Restored', [bill('2026-08', 1000)], { addedOn: '2026-08-01', archived: false, archivedAt: null }),
      // Legacy archive with no stamp at all.
      cust('Legacy Archived', [], { addedOn: '2026-06-01', archived: true, archivedAt: null }),
      // No derivable join month anywhere.
      cust('Undated', [], {})
    ],
    expenses: []
  };
  const matrix = buildMultiMonthMatrix(state, [], { endMonth: '2026-10', rangeMonths: 3, referenceDate: OCT_20 });
  assert.equal(matrix.undatedCustomers, 1);
  for (const row of matrix.months) {
    assert.equal(row.churned, 0, `${row.month}: no provable churn`);
  }
  const aug = matrix.months[0];
  assert.equal(aug.newConnections, 1, 'only Restored provably joined in August');
  assert.equal(aug.activeSubscribers, 1, 'legacy archive proves no active month');
});

test('ranges are exactly 3 / 6 / 12, ascending, ending at the chosen month', () => {
  const state = specState();
  for (const range of [3, 6, 12]) {
    const matrix = buildMultiMonthMatrix(state, [], { endMonth: '2026-10', rangeMonths: range, referenceDate: OCT_20 });
    assert.equal(matrix.months.length, range);
    assert.equal(matrix.months[range - 1].month, '2026-10');
    const keys = matrix.months.map(r => r.month);
    assert.deepEqual(keys, [...keys].sort(), 'ascending order');
  }
  const six = buildMultiMonthMatrix(state, [], { endMonth: '2026-10', rangeMonths: 6, referenceDate: OCT_20 });
  assert.equal(six.months[0].month, '2026-05');
  assert.equal(normalizeMatrixRange(4), 3);
  assert.equal(normalizeMatrixRange('6'), 6);
  assert.equal(normalizeMatrixRange(undefined), 3);
  const fallback = buildMultiMonthMatrix(state, [], { endMonth: 'not-a-month', rangeMonths: 3, referenceDate: OCT_20 });
  assert.equal(fallback.endMonth, '2026-10', 'bad end month falls back to the reference PKT month');
});

test('empty and malformed inputs return zeros, never throw', () => {
  const empty = buildMultiMonthMatrix({}, null, { endMonth: '2026-10', rangeMonths: 3, referenceDate: OCT_20 });
  assert.equal(empty.months.length, 3);
  for (const row of empty.months) {
    assert.equal(row.billedCents, 0);
    assert.equal(row.collectedCents, 0);
    assert.equal(row.collectionPercent, null);
    assert.equal(row.activeSubscribers, 0);
    assert.equal(row.downtimeHours, 0);
  }
  assert.doesNotThrow(() => buildMultiMonthMatrix(undefined, undefined));
  assert.doesNotThrow(() => buildMultiMonthMatrix({ customers: [null, { bills: 'x' }] }, 'junk'));
});

test('render: desktop table and one labelled card per month, same figures', () => {
  const matrix = buildMultiMonthMatrix(specState(), specComplaints(), {
    endMonth: '2026-10', rangeMonths: 3, referenceDate: OCT_20
  });
  const { tableHtml, cardsHtml } = renderMultiMonthMatrixHtml(matrix, 'en');
  assert.ok(tableHtml.includes('<thead>') && tableHtml.includes('<tbody>'));
  assert.equal((tableHtml.match(/<tr>/g) || []).length, 4, 'header + 3 month rows');
  assert.equal((cardsHtml.match(/mmx-card-item/g) || []).length, 3, 'one card per month');
  for (const html of [tableHtml, cardsHtml]) {
    assert.ok(html.includes('2026-10'), 'month key stays visible (Latin digits rule)');
    assert.ok(html.includes('PKR 7,500'), 'October billed fully visible');
    assert.ok(html.includes('PKR 5,000'), 'October collected fully visible');
    assert.ok(html.includes('66.7%'), 'October collection %');
    assert.ok(html.includes('13 h'), 'October downtime');
  }
});

test('i18n: every mmx_* key exists in both dictionaries with the same shape', () => {
  const enKeys = Object.keys(TRANSLATIONS.en).filter(k => k.startsWith('mmx_')).sort();
  const urKeys = Object.keys(TRANSLATIONS.ur).filter(k => k.startsWith('mmx_')).sort();
  assert.ok(enKeys.length >= 18, `expected the SISP-70 keys, got ${enKeys.length}`);
  assert.deepEqual(urKeys, enKeys);
  for (const key of enKeys) {
    const placeholders = value => [...String(value).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
    assert.deepEqual(placeholders(TRANSLATIONS.ur[key]), placeholders(TRANSLATIONS.en[key]), `${key} placeholders differ`);
  }
});

test('i18n mechanical audit: every mmx_* key used by the module and markup exists', () => {
  const moduleSrc = readFileSync(new URL('../multi-month-comparison.js', import.meta.url), 'utf8');
  const used = new Set([...moduleSrc.matchAll(/t\('(mmx_[a-z0-9_]+)'/g)].map(m => m[1]));
  const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const section = index.slice(index.indexOf('multiMonthMatrixSection'), index.indexOf('mohallaDashboardSection'));
  for (const m of section.matchAll(/data-i18n="(mmx_[a-z0-9_]+)"/g)) used.add(m[1]);
  assert.ok(used.size >= 18, `module + markup should reference the matrix keys, got ${used.size}`);
  for (const key of used) {
    assert.ok(TRANSLATIONS.en[key], `missing en key ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `missing ur key ${key}`);
  }
});

test('wiring: dashboard section, controller wiring, token-only styles, build-graph reachability', async () => {
  const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['multiMonthMatrixSection', 'multiMonthRangeSelect', 'multiMonthEndSelect', 'multiMonthMatrixTable', 'multiMonthMatrixCards', 'multiMonthMatrixEmpty']) {
    assert.ok(index.includes(`id="${id}"`), `index.html carries #${id}`);
  }
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './multi-month-comparison.js'"), 'app.js imports the matrix module');
  assert.ok(app.includes('setupMultiMonthMatrix(() => state'), 'app.js wires the controller');
  assert.ok(app.includes('multiMonthMatrixController.refresh()'), 'dashboard render refreshes the matrix');

  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const block = css.slice(css.indexOf('SISP-70'), css.indexOf('SISP-55'));
  assert.ok(block.includes('.mmx-table'), 'matrix table styles shipped');
  assert.ok(block.includes('@media (max-width: 700px)'), 'phone breakpoint shipped');
  assert.ok(block.includes('.mmx-table-wrap { display: none; }'), 'table hides on phones — cards carry the 390px layout');
  assert.ok(block.includes('.mmx-cards { display: grid;'), 'cards show on phones');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'SISP-70 styles use theme tokens only, no hex');

  const { files, missing } = await collectRuntimeFiles(new URL('..', import.meta.url).pathname);
  assert.deepEqual(missing, []);
  assert.ok(files.includes('multi-month-comparison.js'), 'matrix module is in the runtime graph');
});
