/**
 * roster-quick-filters.test.js — SISP-136: Main Customer Roster 1-Tap
 * Financial & Status Filter Pills.
 *
 * Spec tests pinned here (synthetic data only):
 *   1. Predicate accuracy — a fixture roster exercising every pill,
 *      including the edge members: a partial payer is NOT in Unpaid, a
 *      waiver/offset-settled customer IS in Paid, 1-month arrears is
 *      NOT in 2+ Months Arrears, broken and cleared waadas are NOT in
 *      Active Waada, a FREE customer appears ONLY in All Active, and an
 *      archived customer appears in NO pill.
 *   2. Per-pill PKR totals equal the engine figures (hand-computed from
 *      the fixtures and cross-checked against calculatePaymentAllocations).
 *   3. Combined filtering — pill ∩ Area filter ∩ field search intersect
 *      correctly (the composition the roster render performs).
 * Plus: live recompute (a new payment moves the pills), input purity,
 * i18n parity for every key the feature uses, and the app.js /
 * index.html / components.css wiring.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculatePaymentAllocations } from '../core.js';
import { filterCustomersByArea } from '../form-validation.js';
import { filterCustomersBySearchField } from '../customer-search-filter.js';
import { createInstallmentPlan } from '../installment-plan.js';
import { TRANSLATIONS } from '../nav-language.js';
import {
  ROSTER_PILL_DEFS,
  ROSTER_PILL_IDS,
  normalizeRosterPill,
  buildRosterPillSummary,
  rosterPillMemberIds,
  applyRosterPillFilter
} from '../roster-quick-filters.js';

const MONTH = '2026-10';
const TODAY = '2026-10-29';

const payment = (id, date, amount, extra = {}) => ({ id, date, amount, method: 'Cash', ...extra });
const bill = (month, dueAmount, payments = [], extra = {}) => ({ id: `bill-${month}`, month, dueAmount, status: 'pending', payments, ...extra });
const customer = (id, customerNumber, name, bills = [], extra = {}) => ({
  id, customerNumber, name, archived: false, bills, installmentPlans: [], ...extra
});

/**
 * The fixture roster. Every customer is a "Test ..." synthetic record.
 * Bills are Rs 3,000 unless noted; the roster month is 2026-10.
 */
function fixtureState() {
  return {
    customers: [
      // Paid in full with cash this month.
      customer('c-paid', 1, 'Test Paid', [bill(MONTH, 3000, [payment('p-paid', '2026-10-05', 3000)])], { mohalla: 'BARRIAN' }),
      // Nothing paid toward this month's priced bill.
      customer('c-unpaid', 2, 'Test Unpaid', [bill(MONTH, 3000)], { mohalla: 'BARRIAN' }),
      // Partial payer: paid something, still owes — NOT "unpaid".
      customer('c-partial', 3, 'Test Partial', [bill(MONTH, 3000, [payment('p-partial', '2026-10-06', 1000)])]),
      // Two distinct months with a balance due.
      customer('c-arrears', 4, 'Test Arrears', [bill('2026-09', 3000), bill(MONTH, 3000)], { mohalla: 'BARRIAN', phone: '0341 1111111' }),
      // Only ONE month in arrears (September); October is paid.
      customer('c-one-month', 5, 'Test One Month', [bill('2026-09', 3000), bill(MONTH, 3000, [payment('p-one-month', '2026-10-07', 3000)])]),
      // Live waada: promise recorded, money still owed, date ahead.
      customer('c-waada', 6, 'Test Waada', [bill(MONTH, 3000)], { mohalla: 'PALALIYAA', promiseDate: '2026-11-05', promiseAmount: 3000, promiseNote: '' }),
      // Broken waada: promise date has passed with money still owed.
      customer('c-waada-broken', 7, 'Test Waada Broken', [bill(MONTH, 3000)], { promiseDate: '2026-10-10', promiseAmount: 3000, promiseNote: '' }),
      // Cleared waada: promise still stored, but nothing is owed any more.
      customer('c-waada-cleared', 8, 'Test Waada Cleared', [bill(MONTH, 3000, [payment('p-cleared', '2026-10-08', 3000)])], { promiseDate: '2026-11-05', promiseAmount: 3000, promiseNote: '' }),
      // Overpaid: bill settled and Rs 1,500 of engine credit remains.
      customer('c-credit', 9, 'Test Credit', [bill(MONTH, 3000, [payment('p-credit', '2026-10-09', 4500)])]),
      // Billing paused for the roster month (SISP-8 window form).
      customer('c-paused', 10, 'Test Paused', [], { paused: true, pauseStartDate: '2026-10-01', autoResumeDate: '2026-11-01', pauseSkippedMonths: [] }),
      // Active kist plan, nothing billed/paid yet: Rs 3,000 remaining.
      customer('c-kist', 11, 'Test Kist', [], { installmentPlans: [createInstallmentPlan({ itemTitle: 'Test Router', totalAmount: 3000, totalMonths: 3 })] }),
      // Completed kist plan: nothing remains.
      customer('c-kist-done', 12, 'Test Kist Done', [], {
        installmentPlans: [{ id: 'plan-done', itemTitle: 'Test ONU', totalAmount: 3000, downPayment: 0, monthlyKist: 1000, totalMonths: 3, monthsBilled: 3, monthsPaid: 3, startDate: null, status: 'completed' }]
      }),
      // FREE connection: no bills ever — All Active only.
      customer('c-free', 13, 'Test Free', [], { isFreeConnection: true }),
      // Settled without cash: the SISP-50 deposit-offset stamp waived the
      // whole bill inside the engine, so the balance is 0 with no payment.
      customer('c-waiver', 14, 'Test Waiver', [bill(MONTH, 3000, [], { depositOffsetAmount: 3000 })]),
      // Archived with dues: belongs to no pill at all.
      customer('c-archived', 15, 'Test Archived', [bill(MONTH, 3000)], { archived: true })
    ]
  };
}

function summaryOf(state) {
  return buildRosterPillSummary(state.customers, calculatePaymentAllocations(state), { month: MONTH, todayStr: TODAY });
}

const ids = (set) => [...set].sort();

test('pill definitions cover exactly the eight spec pills in order', () => {
  assert.deepEqual(ROSTER_PILL_IDS, ['all', 'unpaid', 'arrears', 'waada', 'paid', 'credit', 'paused', 'kist']);
  assert.deepEqual(ROSTER_PILL_DEFS.map((def) => def.id), ROSTER_PILL_IDS);
  assert.equal(normalizeRosterPill('UNPAID'), 'unpaid');
  assert.equal(normalizeRosterPill('bogus'), 'all');
  assert.equal(normalizeRosterPill(null), 'all');
  assert.equal(normalizeRosterPill(''), 'all');
});

test('predicate accuracy: every pill holds exactly its fixture members', () => {
  const summary = summaryOf(fixtureState());
  assert.deepEqual(ids(rosterPillMemberIds(summary, 'all')), [
    'c-arrears', 'c-credit', 'c-free', 'c-kist', 'c-kist-done', 'c-one-month',
    'c-paid', 'c-partial', 'c-paused', 'c-unpaid', 'c-waada', 'c-waada-broken',
    'c-waada-cleared', 'c-waiver'
  ]);
  assert.deepEqual(ids(rosterPillMemberIds(summary, 'unpaid')), ['c-arrears', 'c-unpaid', 'c-waada', 'c-waada-broken']);
  assert.deepEqual(ids(rosterPillMemberIds(summary, 'paid')), ['c-credit', 'c-one-month', 'c-paid', 'c-waada-cleared', 'c-waiver']);
  assert.deepEqual(ids(rosterPillMemberIds(summary, 'arrears')), ['c-arrears']);
  assert.deepEqual(ids(rosterPillMemberIds(summary, 'waada')), ['c-waada']);
  assert.deepEqual(ids(rosterPillMemberIds(summary, 'credit')), ['c-credit']);
  assert.deepEqual(ids(rosterPillMemberIds(summary, 'paused')), ['c-paused']);
  assert.deepEqual(ids(rosterPillMemberIds(summary, 'kist')), ['c-kist']);
});

test('edge members land exactly where the definitions put them', () => {
  const summary = summaryOf(fixtureState());
  const inPill = (pill, id) => rosterPillMemberIds(summary, pill).has(id);
  assert.equal(inPill('unpaid', 'c-partial'), false, 'partial payer is not unpaid');
  assert.equal(inPill('paid', 'c-partial'), false, 'partial payer is not paid');
  assert.equal(inPill('paid', 'c-waiver'), true, 'offset-settled bill counts as paid');
  assert.equal(inPill('arrears', 'c-one-month'), false, 'one due month is not 2+ arrears');
  assert.equal(inPill('waada', 'c-waada-broken'), false, 'broken waada is not active');
  assert.equal(inPill('waada', 'c-waada-cleared'), false, 'settled ledger clears the waada');
  assert.equal(inPill('kist', 'c-kist-done'), false, 'completed plan has no kist due');
  for (const pill of ROSTER_PILL_IDS) {
    if (pill !== 'all') assert.equal(inPill(pill, 'c-free'), false, `FREE customer stays out of ${pill}`);
    assert.equal(inPill(pill, 'c-archived'), false, `archived customer stays out of ${pill}`);
  }
});

test('per-pill PKR totals equal the engine figures', () => {
  const state = fixtureState();
  const allocations = calculatePaymentAllocations(state);
  const summary = buildRosterPillSummary(state.customers, allocations, { month: MONTH, todayStr: TODAY });
  // Hand-computed from the fixtures (all bills Rs 3,000):
  assert.equal(summary.pills.unpaid.count, 4);
  assert.equal(summary.pills.unpaid.totalCents, 4 * 300000);
  assert.equal(summary.pills.paid.count, 5);
  assert.equal(summary.pills.paid.totalCents, 5 * 300000);
  assert.equal(summary.pills.arrears.count, 1);
  assert.equal(summary.pills.arrears.totalCents, 600000, 'Sep 3,000 + Oct 3,000 outstanding');
  assert.equal(summary.pills.waada.count, 1);
  assert.equal(summary.pills.waada.totalCents, 300000, 'the recorded promiseAmount');
  assert.equal(summary.pills.credit.count, 1);
  assert.equal(summary.pills.credit.totalCents, 150000, 'Rs 4,500 paid on a Rs 3,000 bill');
  assert.equal(summary.pills.paused.count, 1);
  assert.equal(summary.pills.paused.totalCents, null, 'paused is count-only');
  assert.equal(summary.pills.all.totalCents, null, 'All Active is count-only');
  assert.equal(summary.pills.kist.count, 1);
  assert.equal(summary.pills.kist.totalCents, 300000, 'full plan remaining before any billing');
  // Cross-check against the engine's own per-month summaries:
  const engineUnpaid = ['c-arrears', 'c-unpaid', 'c-waada', 'c-waada-broken']
    .reduce((sum, id) => sum + allocations.forMonth(id, MONTH).balanceDueCents, 0);
  assert.equal(summary.pills.unpaid.totalCents, engineUnpaid);
  const engineCredit = [...allocations.byPaymentId.values()]
    .filter((ledger) => ledger.customerId === 'c-credit')
    .reduce((sum, ledger) => sum + ledger.unappliedCreditCents, 0);
  assert.equal(summary.pills.credit.totalCents, engineCredit);
});

test('combined filtering: pill ∩ area ∩ search intersect like the roster render', () => {
  const state = fixtureState();
  // Area first (the roster's canonicalMohalla filter): BARRIAN holds
  // c-paid, c-unpaid, c-arrears.
  const areaPool = filterCustomersByArea(state.customers, 'BARRIAN').filter((c) => !c.archived);
  assert.deepEqual(areaPool.map((c) => c.id), ['c-paid', 'c-unpaid', 'c-arrears']);
  const areaSummary = buildRosterPillSummary(areaPool, calculatePaymentAllocations(state), { month: MONTH, todayStr: TODAY });
  assert.equal(areaSummary.pills.all.count, 3, 'pill counts describe the area-filtered pool');
  assert.deepEqual(applyRosterPillFilter(areaPool, areaSummary, 'unpaid').map((c) => c.id), ['c-unpaid', 'c-arrears']);
  // Now intersect with a name search on top of the area pool.
  const searched = filterCustomersBySearchField(areaPool, 'name', 'arrears');
  assert.deepEqual(searched.map((c) => c.id), ['c-arrears']);
  const searchSummary = buildRosterPillSummary(searched, calculatePaymentAllocations(state), { month: MONTH, todayStr: TODAY });
  assert.deepEqual(applyRosterPillFilter(searched, searchSummary, 'unpaid').map((c) => c.id), ['c-arrears']);
  assert.deepEqual(applyRosterPillFilter(searched, searchSummary, 'paid'), [], 'the searched customer is not in Paid');
  // And a mobile field search finds the same customer by digits.
  const byMobile = filterCustomersBySearchField(state.customers, 'mobile', '0341111');
  assert.deepEqual(byMobile.map((c) => c.id), ['c-arrears']);
});

test('live recompute: recording a payment moves the customer between pills', () => {
  const before = summaryOf(fixtureState());
  assert.equal(before.pills.unpaid.count, 4);
  assert.equal(before.pills.paid.count, 5);
  const state = fixtureState();
  const unpaid = state.customers.find((c) => c.id === 'c-unpaid');
  unpaid.bills[0].payments.push(payment('p-late', '2026-10-29', 3000));
  const after = summaryOf(state);
  assert.equal(after.pills.unpaid.count, 3);
  assert.equal(after.pills.paid.count, 6);
  assert.ok(rosterPillMemberIds(after, 'paid').has('c-unpaid'));
});

test('paused also matches the recorded skipped-month form (SISP-8)', () => {
  const state = {
    customers: [customer('c-skip', 21, 'Test Skipped Month', [], { paused: false, pauseStartDate: null, autoResumeDate: null, pauseSkippedMonths: [MONTH] })]
  };
  const summary = buildRosterPillSummary(state.customers, calculatePaymentAllocations(state), { month: MONTH, todayStr: TODAY });
  assert.ok(rosterPillMemberIds(summary, 'paused').has('c-skip'));
});

test('the summary and filter never mutate their inputs', () => {
  const state = fixtureState();
  const snapshot = JSON.stringify(state.customers);
  const summary = summaryOf(state);
  applyRosterPillFilter(state.customers, summary, 'unpaid');
  assert.equal(JSON.stringify(state.customers), snapshot);
  const all = applyRosterPillFilter(state.customers, summary, 'all');
  assert.equal(all.length, state.customers.length, "'all' passes the list through untouched");
});

test('missing allocations yield an empty, well-formed summary', () => {
  const summary = buildRosterPillSummary(fixtureState().customers, null, { month: MONTH, todayStr: TODAY });
  for (const def of ROSTER_PILL_DEFS) assert.equal(summary.pills[def.id].count, 0);
});

test('wiring: pill bar mount, app.js render path and token-only CSS', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="rosterPillBar"'), 'pill bar mount exists above the roster list');
  assert.ok(html.includes('data-i18n-aria-label="cust_pill_bar_aria"'), 'bar aria label is keyed');
  assert.ok(html.indexOf('id="rosterPillBar"') < html.indexOf('id="customerList"'), 'bar sits above the customer list');
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './roster-quick-filters.js'"), 'app.js imports the module');
  assert.ok(app.includes('buildRosterPillSummary(active, healthAllocations'), 'summary runs on the roster allocations pass');
  assert.ok(app.includes('applyRosterPillFilter(active, rosterPillSummary, customerRosterPill)'), 'pill narrows the active roster');
  assert.ok(app.includes('data-roster-pill'), 'pill buttons are rendered and bound');
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const block = css.slice(css.indexOf('/* SISP-136'));
  assert.ok(block.includes('.roster-pill-bar'), 'pill bar styles exist');
  assert.ok(block.includes('overflow-x: auto'), 'bar scrolls horizontally on phones');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'SISP-136 CSS block is token-only (no hex)');
});

test('i18n audit: every key the feature uses exists in English and Urdu', () => {
  const keys = ['cust_pill_bar_aria', ...ROSTER_PILL_DEFS.map((def) => def.labelKey)];
  assert.equal(keys.length, 9);
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
    assert.notEqual(TRANSLATIONS.en[key], key, `en falls back to the raw key for ${key}`);
    assert.notEqual(TRANSLATIONS.ur[key], key, `ur falls back to the raw key for ${key}`);
  }
});
