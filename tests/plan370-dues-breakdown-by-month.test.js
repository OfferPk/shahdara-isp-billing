import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { duesBreakdownByMonth, duesBreakdownSectionHtml } from '../dues-breakdown-by-month.js';
import { calculatePaymentAllocations } from '../core.js';
import { totalOutstandingFigures } from '../manual-baqaya.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'dues-breakdown-by-month.js'), 'utf8');
const testSrc = readFileSync(join(dir, 'plan370-dues-breakdown-by-month.test.js'), 'utf8');
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');
const langSrc = readFileSync(join(dir, '..', 'nav-language.js'), 'utf8');

// Generic fixtures only — clearly made-up names, never a real customer.
const TEXTS = {
  heading: 'Dues by month',
  intro: 'What is owed for each month.',
  billed: 'Billed',
  paid: 'Paid',
  stillOwed: 'Still owed',
  settled: 'Settled',
  notPriced: 'Bill not priced yet',
  additional: 'Additional amount',
  total: 'Total still owed',
  none: 'No bills recorded yet.',
};

const formatRs = (value) => `Rs ${Number(value).toFixed(2)}`;

// A stub allocation result shaped like the real one: one summary per
// month, keyed by customer id + month.
function stubAllocations(summaries) {
  return {
    forMonth: (customerId, month) => summaries[`${customerId}|${month}`] ?? null,
  };
}

function pricedSummary(billAmountCents, balanceDueCents) {
  return { billAmountCents, balanceDueCents };
}

test('Plan 370: one priced month, partially paid — billed, paid, still owed', () => {
  const customer = { id: 'CUST-1', bills: [{ month: '2026-10' }] };
  const allocations = stubAllocations({ 'CUST-1|2026-10': pricedSummary(300000, 100000) });
  const view = duesBreakdownByMonth(customer, allocations, 0);
  assert.equal(view.rows.length, 1);
  const row = view.rows[0];
  assert.equal(row.month, '2026-10');
  assert.equal(row.billedCents, 300000);
  assert.equal(row.paidCents, 200000);
  assert.equal(row.stillOwedCents, 100000);
  assert.equal(row.billed, 3000);
  assert.equal(row.paid, 2000);
  assert.equal(row.stillOwed, 1000);
  assert.equal(row.priced, true);
  assert.equal(row.settled, false);
  assert.equal(view.totalStillOwedCents, 100000);
  assert.equal(view.profileTotalCents, 100000);
});

test('Plan 370: a month fully paid shows as settled', () => {
  const customer = { id: 'CUST-1', bills: [{ month: '2026-09' }] };
  const allocations = stubAllocations({ 'CUST-1|2026-09': pricedSummary(300000, 0) });
  const view = duesBreakdownByMonth(customer, allocations, 0);
  assert.equal(view.rows[0].settled, true);
  assert.equal(view.rows[0].paidCents, 300000);
  assert.equal(view.rows[0].stillOwedCents, 0);
  assert.equal(view.allSettled, true);
  assert.equal(view.totalStillOwedCents, 0);
});

test('Plan 370: an unpriced month is not priced, never a due, never settled', () => {
  const customer = { id: 'CUST-1', bills: [{ month: '2026-11' }] };
  const allocations = stubAllocations({ 'CUST-1|2026-11': { billAmountCents: null, balanceDueCents: null } });
  const view = duesBreakdownByMonth(customer, allocations, 0);
  assert.equal(view.rows[0].priced, false);
  assert.equal(view.rows[0].billedCents, null);
  assert.equal(view.rows[0].paidCents, null);
  assert.equal(view.rows[0].stillOwedCents, 0);
  assert.equal(view.rows[0].settled, false);
  assert.equal(view.allSettled, false);
  assert.equal(view.totalStillOwedCents, 0);
});

test('Plan 370: rows come out oldest month first whatever the bill order', () => {
  const customer = {
    id: 'CUST-1',
    bills: [{ month: '2026-11' }, { month: '2026-09' }, { month: '2026-10' }],
  };
  const allocations = stubAllocations({
    'CUST-1|2026-09': pricedSummary(300000, 0),
    'CUST-1|2026-10': pricedSummary(300000, 200000),
    'CUST-1|2026-11': pricedSummary(300000, 300000),
  });
  const view = duesBreakdownByMonth(customer, allocations, 0);
  assert.deepEqual(view.rows.map((row) => row.month), ['2026-09', '2026-10', '2026-11']);
  assert.equal(view.totalStillOwedCents, 500000);
});

test('Plan 370: two records for the same month produce one row, never counted twice', () => {
  const customer = {
    id: 'CUST-1',
    bills: [{ month: '2026-10' }, { month: '2026-10' }],
  };
  const allocations = stubAllocations({ 'CUST-1|2026-10': pricedSummary(300000, 100000) });
  const view = duesBreakdownByMonth(customer, allocations, 0);
  assert.equal(view.rows.length, 1);
  assert.equal(view.rows[0].billedCents, 300000);
  assert.equal(view.totalStillOwedCents, 100000);
});

test('Plan 370: a bill with no usable month is left out, never guessed', () => {
  const customer = {
    id: 'CUST-1',
    bills: [{ month: '' }, { month: '2026-13' }, { month: 'Nov 2026' }, { month: '2026-10' }, {}],
  };
  const allocations = stubAllocations({ 'CUST-1|2026-10': pricedSummary(300000, 100000) });
  const view = duesBreakdownByMonth(customer, allocations, 0);
  assert.deepEqual(view.rows.map((row) => row.month), ['2026-10']);
});

test('Plan 370: billed minus paid equals still owed on every priced row', () => {
  const customer = {
    id: 'CUST-1',
    bills: [{ month: '2026-09' }, { month: '2026-10' }, { month: '2026-11' }],
  };
  const allocations = stubAllocations({
    'CUST-1|2026-09': pricedSummary(300000, 0),
    'CUST-1|2026-10': pricedSummary(250000, 40000),
    'CUST-1|2026-11': { billAmountCents: null, balanceDueCents: null },
  });
  const view = duesBreakdownByMonth(customer, allocations, 0);
  for (const row of view.rows) {
    if (!row.priced) continue;
    assert.equal(row.billedCents - row.paidCents, row.stillOwedCents, `row ${row.month} does not reconcile`);
  }
  assert.equal(view.totalStillOwedCents, 40000);
});

test('Plan 370: the manual additional amount is its own figure, never folded into a month', () => {
  const customer = { id: 'CUST-1', bills: [{ month: '2026-10' }] };
  const allocations = stubAllocations({ 'CUST-1|2026-10': pricedSummary(300000, 100000) });
  const view = duesBreakdownByMonth(customer, allocations, 50000);
  assert.equal(view.totalStillOwedCents, 100000);
  assert.equal(view.manualBaqayaCents, 50000);
  assert.equal(view.manualBaqaya, 500);
  assert.equal(view.profileTotalCents, 150000);
  assert.equal(view.profileTotal, 1500);
});

test('Plan 370: a customer with no bills has no rows and zero dues', () => {
  const view = duesBreakdownByMonth({ id: 'CUST-1', bills: [] }, stubAllocations({}), 0);
  assert.deepEqual(view.rows, []);
  assert.equal(view.hasRows, false);
  assert.equal(view.allSettled, false);
  assert.equal(view.totalStillOwedCents, 0);
  assert.equal(view.profileTotalCents, 0);
  const noCustomer = duesBreakdownByMonth(null, stubAllocations({}), 0);
  assert.deepEqual(noCustomer.rows, []);
});

test('Plan 370: allSettled needs every row settled — an unpriced row blocks it', () => {
  const customer = {
    id: 'CUST-1',
    bills: [{ month: '2026-09' }, { month: '2026-10' }],
  };
  const allocations = stubAllocations({
    'CUST-1|2026-09': pricedSummary(300000, 0),
    'CUST-1|2026-10': { billAmountCents: null, balanceDueCents: null },
  });
  const view = duesBreakdownByMonth(customer, allocations, 0);
  assert.equal(view.rows[0].settled, true);
  assert.equal(view.allSettled, false);
});

test('Plan 370: inputs are never mutated', () => {
  const customer = { id: 'CUST-1', bills: [{ month: '2026-11' }, { month: '2026-09' }] };
  const summaries = {
    'CUST-1|2026-09': pricedSummary(300000, 0),
    'CUST-1|2026-11': pricedSummary(300000, 300000),
  };
  const before = JSON.stringify({ customer, summaries });
  duesBreakdownByMonth(customer, stubAllocations(summaries), 0);
  assert.equal(JSON.stringify({ customer, summaries }), before);
});

test('Plan 370: a missing allocation result leaves every row unpriced, never throws', () => {
  const customer = { id: 'CUST-1', bills: [{ month: '2026-10' }] };
  const view = duesBreakdownByMonth(customer, null, 0);
  assert.equal(view.rows[0].priced, false);
  assert.equal(view.rows[0].stillOwedCents, 0);
  const noForMonth = duesBreakdownByMonth(customer, {}, 0);
  assert.equal(noForMonth.rows[0].priced, false);
});

test('Plan 370: an unusable manual amount counts as zero', () => {
  const customer = { id: 'CUST-1', bills: [{ month: '2026-10' }] };
  const allocations = stubAllocations({ 'CUST-1|2026-10': pricedSummary(300000, 100000) });
  assert.equal(duesBreakdownByMonth(customer, allocations, -500).manualBaqayaCents, 0);
  assert.equal(duesBreakdownByMonth(customer, allocations, 'five hundred').manualBaqayaCents, 0);
  assert.equal(duesBreakdownByMonth(customer, allocations, Number.NaN).manualBaqayaCents, 0);
  assert.equal(duesBreakdownByMonth(customer, allocations).manualBaqayaCents, 0);
});

test('Plan 370: the per-month still-owed figures sum exactly to the profile total on the real engine', () => {
  const customer = {
    id: 'CUST-1',
    name: 'Customer One',
    customerNumber: '1',
    bills: [
      { id: 'BILL-1', month: '2026-09', dueAmount: 3000, status: 'paid', payments: [{ id: 'PAY-1', date: '2026-09-05', amount: 3000, method: 'Cash' }] },
      { id: 'BILL-2', month: '2026-10', dueAmount: 3000, status: 'pending', payments: [{ id: 'PAY-2', date: '2026-10-06', amount: 1000, method: 'Cash' }] },
      { id: 'BILL-3', month: '2026-11', dueAmount: 3000, status: 'pending', payments: [] },
    ],
  };
  const allocations = calculatePaymentAllocations({ customers: [customer] });
  const figures = totalOutstandingFigures(customer, allocations);
  const view = duesBreakdownByMonth(customer, allocations, figures.manualBaqayaCents);
  assert.deepEqual(view.rows.map((row) => row.month), ['2026-09', '2026-10', '2026-11']);
  assert.equal(view.rows[0].settled, true);
  assert.equal(view.rows[1].stillOwedCents, 200000);
  assert.equal(view.rows[2].stillOwedCents, 300000);
  assert.equal(view.totalStillOwedCents, figures.billDuesCents);
  assert.equal(view.profileTotalCents, figures.totalCents);
  assert.equal(view.profileTotal, figures.total);
});

test('Plan 370: the total still reconciles when a manual additional amount is on the record', () => {
  const customer = {
    id: 'CUST-1',
    name: 'Customer One',
    customerNumber: '1',
    manualBaqaya: [{ id: 'MBQ-1', amount: 500, date: '2026-11-01' }],
    bills: [
      { id: 'BILL-1', month: '2026-10', dueAmount: 3000, status: 'pending', payments: [{ id: 'PAY-1', date: '2026-10-06', amount: 1000, method: 'Cash' }] },
    ],
  };
  const allocations = calculatePaymentAllocations({ customers: [customer] });
  const figures = totalOutstandingFigures(customer, allocations);
  assert.equal(figures.manualBaqayaCents, 50000);
  const view = duesBreakdownByMonth(customer, allocations, figures.manualBaqayaCents);
  assert.equal(view.totalStillOwedCents, 200000);
  assert.equal(view.totalStillOwedCents, figures.billDuesCents);
  assert.equal(view.profileTotalCents, figures.totalCents);
  assert.equal(view.profileTotalCents, 250000);
});

test('Plan 370: section renders one row per month with billed, paid and still owed', () => {
  const customer = {
    id: 'CUST-1',
    bills: [{ month: '2026-09' }, { month: '2026-10' }],
  };
  const allocations = stubAllocations({
    'CUST-1|2026-09': pricedSummary(300000, 0),
    'CUST-1|2026-10': pricedSummary(300000, 100000),
  });
  const html = duesBreakdownSectionHtml(customer, allocations, 0, TEXTS, formatRs);
  assert.ok(html.includes('class="profile-dues-breakdown"'));
  assert.ok(html.includes('id="dmbList"'));
  assert.ok(html.includes('2026-09'));
  assert.ok(html.includes('2026-10'));
  assert.ok(html.includes('Billed Rs 3000.00'));
  assert.ok(html.includes('Paid Rs 3000.00'));
  assert.ok(html.includes('Still owed Rs 1000.00'));
  assert.ok(html.includes('<span class="dmb-settled">Settled</span>'));
  assert.ok(html.includes('Total still owed Rs 1000.00'));
  assert.ok(!html.includes('Additional amount'));
});

test('Plan 370: section shows the not-priced line and the additional amount line', () => {
  const customer = {
    id: 'CUST-1',
    bills: [{ month: '2026-10' }, { month: '2026-11' }],
  };
  const allocations = stubAllocations({
    'CUST-1|2026-10': pricedSummary(300000, 100000),
    'CUST-1|2026-11': { billAmountCents: null, balanceDueCents: null },
  });
  const html = duesBreakdownSectionHtml(customer, allocations, 50000, TEXTS, formatRs);
  assert.ok(html.includes('<span class="dmb-not-priced">Bill not priced yet</span>'));
  assert.ok(html.includes('Additional amount Rs 500.00'));
  assert.ok(html.includes('Total still owed Rs 1500.00'));
});

test('Plan 370: section with no bills reads the none line and a zero total', () => {
  const html = duesBreakdownSectionHtml({ id: 'CUST-1', bills: [] }, stubAllocations({}), 0, TEXTS, formatRs);
  assert.ok(html.includes('<p class="dmb-none">No bills recorded yet.</p>'));
  assert.ok(html.includes('Total still owed Rs 0.00'));
  assert.ok(!html.includes('dmbList'));
});

test('Plan 370: section escapes caller labels and falls back without a formatter', () => {
  const customer = { id: 'CUST-1', bills: [{ month: '2026-10' }] };
  const allocations = stubAllocations({ 'CUST-1|2026-10': pricedSummary(300000, 100000) });
  const hostile = { ...TEXTS, heading: '<b>Dues</b>', intro: 'A & B' };
  const html = duesBreakdownSectionHtml(customer, allocations, 0, hostile, formatRs);
  assert.ok(html.includes('&lt;b&gt;Dues&lt;/b&gt;'));
  assert.ok(!html.includes('<b>Dues</b>'));
  assert.ok(html.includes('A &amp; B'));
  const fallback = duesBreakdownSectionHtml(customer, allocations, 0, TEXTS, null);
  assert.ok(fallback.includes('PKR 1000'));
  const defaults = duesBreakdownSectionHtml(customer, allocations, 0, {}, formatRs);
  assert.ok(defaults.includes('Dues by month'));
  assert.ok(defaults.includes('Total still owed'));
});

test('Plan 370: the module is pure — no storage, clock, network, import or OLT', () => {
  assert.ok(!/document\./.test(moduleSrc), 'module reads the document');
  assert.ok(!/localStorage/.test(moduleSrc), 'module touches storage');
  assert.ok(!/new Date\(/.test(moduleSrc), 'module reads the clock');
  assert.ok(!/Date\.now\(/.test(moduleSrc), 'module reads the clock');
  assert.ok(!/fetch\(/.test(moduleSrc), 'module fetches');
  assert.ok(!/window\./.test(moduleSrc), 'module touches window');
  assert.ok(!/^import /m.test(moduleSrc), 'module imports');
  assert.ok(!/from '\.\//.test(moduleSrc), 'module imports a sibling');
  assert.ok(!/\bOLT\b/.test(moduleSrc), 'module names OLT');
});

test('Plan 370: the module never names a fenced module file literally', () => {
  const fenced = [
    ['combined-', 'dues', '.js'],
    ['dashboard-', 'dues-aging', '.js'],
    ['balance-', 'reply', '.js'],
    ['revenue-', 'stream-breakdown', '.js'],
    ['monthly-', 'kpi-sheet', '.js'],
    ['profile-', 'header-strip', '.js'],
    ['manual-', 'baqaya', '.js'],
  ];
  for (const parts of fenced) {
    const name = parts.join('');
    assert.ok(!moduleSrc.includes(name), `module names fenced file ${name}`);
  }
  // The test itself names the same files only in fragments, except the
  // manual additional-amount module, which the test imports as the
  // reconciliation oracle (the profile's own total) — the module
  // itself never names it, and the import is the oracle, not a fence
  // read: the module takes the figure as a number from its caller.
  for (const parts of fenced.slice(0, 6)) {
    const name = parts.join('');
    assert.ok(!testSrc.includes(name), `test names fenced file ${name}`);
  }
});

test('Plan 370: wiring — import, section after the strip, before the household link', () => {
  assert.ok(appSrc.includes("from './dues-breakdown-by-month.js'"));
  assert.ok(appSrc.includes('duesBreakdownSectionHtml'));
  assert.ok(appSrc.includes('duesBreakdownSectionMarkup'));
  assert.ok(appSrc.includes('calculatePaymentAllocations(state)'));
  assert.ok(appSrc.includes('totalOutstandingFigures(customer, duesBreakdownAllocations)'));
  const stripAt = appSrc.indexOf('${profileHeaderStripSectionHtml}');
  const financialAt = appSrc.indexOf('${profileSectionFinancialHtml}', stripAt);
  assert.ok(stripAt !== -1 && financialAt !== -1 && financialAt > stripAt, 'Financial section sits after the header strip');
  // Polish #28 Phase A — the dues breakdown is second in the Financial
  // section (after the wada banner) and the household link is in the
  // Customer section, so sections now order household (S1) before dues
  // (S3) in the DOM; the strip sits above every section. The preserved
  // intent is dues near the top of Financial, strip above all sections.
  const financialBodyAt = appSrc.indexOf('const profileSectionFinancialBody = ');
  const financialBody = appSrc.slice(financialBodyAt, appSrc.indexOf('\n', financialBodyAt));
  const bannerAt = financialBody.indexOf('${wadaProfileBannerHtml(customer)}');
  const breakdownAt = financialBody.indexOf('${duesBreakdownSectionMarkup}');
  const moneyAt = financialBody.indexOf('${profileInfoGroupFragments.money}');
  assert.ok(bannerAt !== -1 && breakdownAt > bannerAt && moneyAt > breakdownAt,
    'dues breakdown sits in Financial after the wada banner and before the money fragment');
});

test('Plan 370: dues breakdown keys exist in both language tables', () => {
  const keys = [
    'prof_dmb_heading',
    'prof_dmb_intro',
    'prof_dmb_billed',
    'prof_dmb_paid',
    'prof_dmb_still_owed',
    'prof_dmb_settled',
    'prof_dmb_not_priced',
    'prof_dmb_additional',
    'prof_dmb_total',
    'prof_dmb_none',
  ];
  for (const key of keys) {
    const count = langSrc.split(key).length - 1;
    assert.equal(count, 2, `${key} must appear once in each language table, found ${count}`);
  }
});

test('Plan 370: styles reuse existing colours only — no new hex in dues breakdown rules', () => {
  assert.ok(stylesSrc.includes('.profile-dues-breakdown'));
  assert.ok(stylesSrc.includes('.dmb-list'));
  const rules = stylesSrc.match(/\.dmb-[^{]+\{[^}]*\}|\.profile-dues-breakdown[^{]*\{[^}]*\}/g) || [];
  assert.ok(rules.length > 0);
  const baseline = stylesSrc.replace(/\.dmb-[^{]+\{[^}]*\}|\.profile-dues-breakdown[^{]*\{[^}]*\}/g, '');
  const baselineHexes = new Set((baseline.match(/#[0-9a-fA-F]{3,8}/g) || []).map((hex) => hex.toLowerCase()));
  for (const rule of rules) {
    const hexes = rule.match(/#[0-9a-fA-F]{3,8}/g) || [];
    for (const hex of hexes) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex colour ${hex} in rule ${rule.slice(0, 60)}`);
    }
  }
});
