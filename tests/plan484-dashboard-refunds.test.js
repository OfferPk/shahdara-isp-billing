import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeRefundList } from '../refund-records.js';
import {
  calculateRefundsThisMonth,
  refundsCountText,
  renderDashboardRefunds
} from '../dashboard-refunds.js';
import { TRANSLATIONS } from '../nav-language.js';

// The refunds for the month, read independently of the module
// under test: every valid refund record whose date falls in the
// month, summed in integer cents. A refund is ledger evidence
// of money that already left the shop, so a refund given to a
// customer who is archived now still counts, and a refund
// naming a customer no longer on record still counts — the
// record itself is the authority, never a guessed amount.
function ledgerRefundsThisMonth(refunds, month) {
  return normalizeRefundList(refunds)
    .filter((refund) => refund.refundDate.slice(0, 7) === month)
    .reduce(
      (acc, refund) => ({ cents: acc.cents + refund.amountCents, count: acc.count + 1 }),
      { cents: 0, count: 0 }
    );
}

function buildFixture() {
  const refunds = [
    // A: 2000 refunded 2026-11-02 — counts.
    { id: 'rf-a', customerId: 'cust-a', sourceKind: 'credit', sourceId: 'cred-a', sourceAmountCents: 200000, amountCents: 200000, reason: 'Overpayment returned on exit', method: 'cash', refundDate: '2026-11-02' },
    // B: paisa-exact 1500.50 refunded 2026-11-05 — counts.
    { id: 'rf-b', customerId: 'cust-b', sourceKind: 'overpayment', sourceId: 'pay-b', sourceAmountCents: 200000, amountCents: 150050, reason: 'Overpayment returned', method: 'bank_transfer', refundDate: '2026-11-05' },
    // C: 400 refunded 2026-11-06 to a customer who is archived
    // now — still counts: the money already left the shop.
    { id: 'rf-c', customerId: 'cust-archived', sourceKind: 'credit', sourceId: 'cred-c', sourceAmountCents: 40000, amountCents: 40000, reason: 'Overpayment returned on exit', method: 'cash', refundDate: '2026-11-06' },
    // D: 900 refunded 2026-11-07 naming a customer no longer on
    // record — still counts: the record is the authority.
    { id: 'rf-d', customerId: 'customer-missing', sourceKind: 'overpayment', sourceId: 'pay-d', sourceAmountCents: 90000, amountCents: 90000, reason: 'Overpayment returned', method: 'mobile_wallet', refundDate: '2026-11-07' },
    // E: 700 refunded 2026-10-28 — last month, never counts.
    { id: 'rf-e', customerId: 'cust-a', sourceKind: 'credit', sourceId: 'cred-e', sourceAmountCents: 70000, amountCents: 70000, reason: 'Overpayment returned', method: 'cash', refundDate: '2026-10-28' },
    // F: 300 refunded 2026-12-01 — next month, never counts.
    { id: 'rf-f', customerId: 'cust-a', sourceKind: 'credit', sourceId: 'cred-f', sourceAmountCents: 30000, amountCents: 30000, reason: 'Overpayment returned', method: 'cash', refundDate: '2026-12-01' },
    // G: impossible date 2026-11-31 — half-formed, refused
    // outright and never lands in the total.
    { id: 'rf-g', customerId: 'cust-a', sourceKind: 'credit', sourceId: 'cred-g', sourceAmountCents: 50000, amountCents: 50000, reason: 'Overpayment returned', method: 'cash', refundDate: '2026-11-31' },
    // H: zero amount — refused outright.
    { id: 'rf-h', customerId: 'cust-a', sourceKind: 'credit', sourceId: 'cred-h', sourceAmountCents: 50000, amountCents: 0, reason: 'Overpayment returned', method: 'cash', refundDate: '2026-11-03' },
    // I: refund above its source amount — refused outright.
    { id: 'rf-i', customerId: 'cust-a', sourceKind: 'credit', sourceId: 'cred-i', sourceAmountCents: 200000, amountCents: 250000, reason: 'Overpayment returned', method: 'cash', refundDate: '2026-11-04' }
  ];
  // 2026-11-08 12:00 PKT — the dashboard's own day in November.
  return { refunds, referenceDate: new Date('2026-11-08T07:00:00Z') };
}

test('refunds this month: the count and total match the refund records for this month', () => {
  const { refunds, referenceDate } = buildFixture();
  const summary = calculateRefundsThisMonth(refunds, referenceDate);
  // 2000 + 1500.50 + 400 + 900 = 4800.50, over 4 refunds.
  assert.equal(summary.month, '2026-11');
  assert.equal(summary.amountCents, 480050);
  assert.equal(summary.count, 4);
  assert.deepEqual(ledgerRefundsThisMonth(refunds, '2026-11'), { cents: 480050, count: 4 });
});

test('refunds this month: refunds from other months never count', () => {
  const { refunds, referenceDate } = buildFixture();
  const onlyOtherMonths = {
    refunds: refunds.filter((refund) => refund.id === 'rf-e' || refund.id === 'rf-f')
  };
  assert.deepEqual(
    calculateRefundsThisMonth(onlyOtherMonths.refunds, referenceDate),
    { month: '2026-11', amountCents: 0, count: 0 },
    'the October 700 and the December 300 never land in November'
  );
});

test('refunds this month: half-formed records never count', () => {
  const { refunds, referenceDate } = buildFixture();
  const onlyHalfFormed = {
    refunds: refunds.filter((refund) => ['rf-g', 'rf-h', 'rf-i'].includes(refund.id))
  };
  assert.deepEqual(
    calculateRefundsThisMonth(onlyHalfFormed.refunds, referenceDate),
    { month: '2026-11', amountCents: 0, count: 0 },
    'an impossible date, a zero amount, and a refund above its source are refused outright'
  );
});

test('refunds this month: an archived customer refund still counts — the money already left the shop', () => {
  const { refunds, referenceDate } = buildFixture();
  const onlyArchived = {
    refunds: refunds.filter((refund) => refund.id === 'rf-c')
  };
  assert.deepEqual(
    calculateRefundsThisMonth(onlyArchived.refunds, referenceDate),
    { month: '2026-11', amountCents: 40000, count: 1 },
    'the archived 400 still counts in November'
  );
});

test('refunds this month: a refund naming no customer on record still counts — the record is the authority', () => {
  const { refunds, referenceDate } = buildFixture();
  const onlyMissing = {
    refunds: refunds.filter((refund) => refund.id === 'rf-d')
  };
  assert.deepEqual(
    calculateRefundsThisMonth(onlyMissing.refunds, referenceDate),
    { month: '2026-11', amountCents: 90000, count: 1 },
    'the 900 naming no customer on record still counts in November'
  );
});

test('refunds this month: a month with no refunds shows zero, not a blank', () => {
  const summary = calculateRefundsThisMonth([], new Date('2026-11-08T07:00:00Z'));
  assert.deepEqual(summary, { month: '2026-11', amountCents: 0, count: 0 });
  const els = {};
  const doc = {
    getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false })
  };
  renderDashboardRefunds(doc, summary);
  assert.equal(els.rfdRefundTotal.textContent, 'PKR 0');
  assert.equal(els.rfdRefundLine.textContent, '0 refunds given');
  assert.equal(els.rfdRefundEmpty.hidden, false, 'empty state shows');
});

test('refunds this month render: PKR figures, line, and empty state land in the view', () => {
  const { refunds, referenceDate } = buildFixture();
  const summary = calculateRefundsThisMonth(refunds, referenceDate);
  const els = {};
  const doc = {
    getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false })
  };
  renderDashboardRefunds(doc, summary);
  assert.equal(els.rfdRefundTotal.textContent, 'PKR 4,800.50');
  assert.equal(els.rfdRefundLine.textContent, '4 refunds given');
  assert.equal(els.rfdRefundEmpty.hidden, true, 'empty state hides while refunds were given');
});

test('refunds this month: the singular count line reads one refund', () => {
  assert.equal(refundsCountText({ month: '2026-11', amountCents: 200000, count: 1 }), '1 refund given');
  assert.equal(refundsCountText({ month: '2026-11', amountCents: 0, count: 0 }), '0 refunds given');
});

test('refunds this month: calculating and rendering never mutate the refund records', () => {
  const { refunds, referenceDate } = buildFixture();
  const before = JSON.stringify(refunds);
  const summary = calculateRefundsThisMonth(refunds, referenceDate);
  refundsCountText(summary);
  const els = {};
  renderDashboardRefunds({ getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false }) }, summary);
  assert.equal(JSON.stringify(refunds), before);
});

test('refunds this month wiring: the strip sits on the billing dashboard after the credit-balances total, and the dashboard renders it', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(page.includes('id="refundsSection"'), 'refunds section exists');
  assert.ok(page.indexOf('id="refundsSection"') > page.indexOf('id="creditBalancesSection"'), 'strip follows the credit-balances total');
  assert.ok(page.indexOf('id="refundsSection"') < page.indexOf('id="collectionForecastSection"'), 'strip sits before the forecast section');
  assert.ok(page.includes('id="rfdRefundTotal"'), 'refund total element exists');
  assert.ok(page.includes('id="rfdRefundLine"'), 'count line element exists');
  assert.ok(page.includes('id="rfdRefundEmpty"'), 'empty state element exists');
  assert.ok(page.includes('data-i18n="dash_refunds_title"'), 'strip title is translated');
  assert.ok(page.includes('data-i18n="dash_refunds_sub"'), 'strip subtitle is translated');
  assert.ok(page.includes('Refunds this month'), 'strip title reads Refunds this month');

  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './dashboard-refunds.js?v=1.11.0'"), 'dashboard imports the refunds module at the pinned version');
  assert.ok(app.includes('renderDashboardRefunds(document, calculateRefundsThisMonth(loadRefunds(), referenceDate))'), 'renderDashboard fills the strip from the saved refund records');
});

test('i18n: every dash_refunds_ key used exists in English and Urdu, with Urdu script in the Urdu value', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const module = readFileSync(new URL('../dashboard-refunds.js', import.meta.url), 'utf8');
  const used = new Set();
  for (const match of page.matchAll(/data-i18n="(dash_refunds_[a-z_]+)"/g)) used.add(match[1]);
  // The count keys sit inside t() calls in the module, not directly
  // after t(' — so the module scan takes every quoted key.
  for (const match of module.matchAll(/'(dash_refunds_[a-z_]+)'/g)) used.add(match[1]);
  assert.ok(used.size >= 5, `expected at least 5 refunds keys, found ${[...used].join(', ')}`);
  for (const key of used) {
    assert.ok(typeof TRANSLATIONS.en[key] === 'string' && TRANSLATIONS.en[key].length > 0, `missing English key ${key}`);
    assert.ok(typeof TRANSLATIONS.ur[key] === 'string' && TRANSLATIONS.ur[key].length > 0, `missing Urdu key ${key}`);
    assert.ok(/[\u0600-\u06FF]/.test(TRANSLATIONS.ur[key]), `Urdu value of ${key} carries no Urdu script`);
  }
});

test('the new module names no fenced module file in its header and reads no storage, clock, or page', () => {
  const module = readFileSync(new URL('../dashboard-refunds.js', import.meta.url), 'utf8');
  const header = module.slice(0, module.indexOf('*/'));
  assert.equal(header.includes('.js'), false, 'header names no module file');
  assert.equal(module.includes('full-history-list.js'), false);
  assert.equal(module.includes('localStorage'), false);
  assert.equal(module.includes('document'), false);
  assert.equal(/\bwindow\s*[.([]/.test(module), false, 'module touches the window global');
  // Plan 248: the clock check is `new Date(` / `Date.now(` — a bare
  // `Date(` also matches a pure function call, not a clock read.
  assert.equal(module.includes('new Date('), false);
  assert.equal(module.includes('Date.now'), false);
  // The header is a /* */ block, never // line comments.
  assert.ok(module.startsWith('/*'), 'header is a block comment');
  // PKR only — no other currency symbol or code in the module source
  // (a dollar followed by a digit would be money; `${` template
  // placeholders are not).
  assert.equal(/\$\d|€|£|USD|EUR|GBP/.test(module), false);
});
