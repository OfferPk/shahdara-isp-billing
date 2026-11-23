// profile-billing-tab-m3.test.js — Profile '1. Billing' Tab M3 refactor
// (Specs P + Q + R, 2026-11-22).
//
// Ported from the read-only prep repro
// (~/workspace/.profile-billing-tab-prep-scratch/repro-profile-billing-tab.mjs),
// with two corrections to the prep's own checks:
//  - C7: the prep asserted appSrc includes the literal
//    'prof_clv_future_basis_nn' — impossible, the key is built by a
//    template literal (app.js:8328). The corrected check asserts the
//    template prefix 'prof_clv_future_basis_'. The prep also asserted
//    appSrc never contains 'escapeHtml(futureBasis)</dd>' — also
//    unachievable: D4 keeps the "Not estimated: …" line in the same
//    tile's basis dd when there is no estimate. The corrected check
//    pins the concise subtitle shape + the note's removal instead.
//  - C11: the prep asserted the GENERIC '.profile-detail-section
//    summary' rule gets 'flex-direction: column' — that would restack
//    all 7 profile sections. The fix scopes the stack to
//    [data-profile-section="financial"] only; the corrected check
//    asserts the scoped selector.
//
// C checks assert the FIXED state (they FAIL on base, PASS after the fix).
// S checks assert structure that must SURVIVE the fix.
// B checks are baseline guards (must PASS on base AND after the fix).
//
// Fixture figures are generic (PKR 1,000 etc. from the spec text itself).
// No customer name, phone, TID or figure comes from any user screenshot.
// NOT pinning: this file carries no suite-total pin and no parity literal.

import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, '..');

let duesMod;
let balanceMod;
let statementMod;
let slipMod;
let creditMod;
let monthsMod;
let appSrc = '';
let stylesSrc = '';
let indexSrc = '';
let duesSrc = '';
let statementSrc = '';

before(async () => {
  duesMod = await import(pathToFileURL(join(root, 'dues-breakdown-by-month.js')).href);
  balanceMod = await import(pathToFileURL(join(root, 'balance-reply.js')).href);
  statementMod = await import(pathToFileURL(join(root, 'statement-draft.js')).href);
  slipMod = await import(pathToFileURL(join(root, 'payment-slip.js')).href);
  creditMod = await import(pathToFileURL(join(root, 'credit-balance.js')).href);
  monthsMod = await import(pathToFileURL(join(root, 'core.js')).href);
  appSrc = readFileSync(join(root, 'app.js'), 'utf8');
  stylesSrc = readFileSync(join(root, 'styles.css'), 'utf8');
  indexSrc = readFileSync(join(root, 'index.html'), 'utf8');
  duesSrc = readFileSync(join(root, 'dues-breakdown-by-month.js'), 'utf8');
  statementSrc = readFileSync(join(root, 'statement-draft.js'), 'utf8');
});

// Fixture: one customer with three priced months, Sep settled, Oct settled,
// Nov open (PKR 1,000 billed, 0 paid). Generic figures only.
function fixtureCustomer() {
  return {
    id: 'c1',
    name: 'Test Customer',
    bills: [
      { month: '2026-09', dueAmount: 1000 },
      { month: '2026-10', dueAmount: 1000 },
      { month: '2026-11', dueAmount: 1000 },
    ],
  };
}

function fixtureAllocations() {
  const byMonth = {
    '2026-09': { billAmountCents: 100000, balanceDueCents: 0 },
    '2026-10': { billAmountCents: 100000, balanceDueCents: 0 },
    '2026-11': { billAmountCents: 100000, balanceDueCents: 100000 },
  };
  return { forMonth: (_id, month) => byMonth[month] ?? null };
}

// ---- C1: Dues by month renders as compact 1-line rows --------------------
// Fixed state: one <li> per month with the month on the left and a single
// status pill on the right ('Settled' or 'PKR 1,000 Due') — no separate
// Billed/Paid/Still-owed lines inside the row.
test('C1 dues-by-month rows are compact one-liners', () => {
  const html = duesMod.duesBreakdownSectionHtml(
    fixtureCustomer(), fixtureAllocations(), 0, {}, (v) => `PKR ${v}`,
  );
  const rows = [...html.matchAll(/<li>(.*?)<\/li>/gs)].map((m) => m[1]);
  assert.equal(rows.length, 3);
  for (const row of rows) {
    assert.doesNotMatch(row, /Billed/);
    assert.doesNotMatch(row, /Still owed/);
    assert.match(row, /Settled|Due/);
  }
});

// ---- C2/C3: Balance reply 'Roman Urdu' is Roman Urdu, not English --------
test('C2 balance reply roman + zero balance is Roman Urdu', () => {
  const reply = balanceMod.buildBalanceReply({
    customerId: 'c1', customerName: 'Test Customer', outstanding: 0,
    dueDate: '2026-11-05', lastPayment: null, openDisputes: [], variant: 'roman',
  });
  assert.match(reply.text, /Aap ka koi baqaya baqi nahi hai\./);
  assert.doesNotMatch(reply.text, /You have no amount due/);
});

test('C3 balance reply roman + due balance is Roman Urdu', () => {
  const reply = balanceMod.buildBalanceReply({
    customerId: 'c1', customerName: 'Test Customer', outstanding: 1000,
    dueDate: '2026-11-05',
    lastPayment: { amount: 1000, date: '2026-10-19' },
    openDisputes: [], variant: 'roman',
  });
  assert.match(reply.text, /baqaya/i);
  assert.doesNotMatch(reply.text, /Your current balance is/);
});

// ---- C4: Statement draft 'roman' is Roman Urdu, not English -------------
test('C4 statement draft roman variant is Roman Urdu', () => {
  const out = statementMod.buildStatementDraftText({
    customerName: 'Test Customer', month: '2026-11', openingBalance: 0,
    charges: 1000, paymentsReceived: 1000, closingBalance: 0,
    hasBill: true, paymentCount: 1,
  }, 'roman');
  assert.doesNotMatch(out.text, /Monthly statement for/);
  assert.doesNotMatch(out.text, /Opening balance:/);
});

// ---- C5: Payment slip variant labels match their output ------------------
// Fixed state: the variant the profile calls 'Urdu script' emits Urdu
// script, and the variant it calls 'Roman Urdu' emits Roman Urdu.
test('C5 payment slip urdu variant emits Urdu script', () => {
  const slip = slipMod.buildPaymentSlip({
    customerId: 'c1', customerName: 'Test Customer',
    payments: [{ date: '2026-10-05', amount: 1000, channel: 'JazzCash' }],
    balance: 1000, variant: 'urdu',
  });
  const text = slipMod.buildPaymentSlipText(slip);
  assert.match(text, /[\u0600-\u06FF]/);
});

// ---- C6: Credit balance hides when zero ----------------------------------
// Fixed state: the profile renders NO credit section when the remaining
// credit is zero (the caller hides it; the module keeps serving the
// analytics callers unchanged).
test('C6 zero credit renders no credit section', () => {
  const line = appSrc.split('\n').find((l) => l.includes('const creditBalanceSectionHtml'));
  assert.ok(line, 'credit section assignment exists');
  assert.match(line, /remainingCents > 0|remaining > 0/);
});

// ---- C7: CLV future value is one concise subtitle ------------------------
// Fixed state: the estimate tile carries one short subtitle
// ('Estimate · PKR 1,500/mo avg × 12' shape) and NEITHER the long green
// basis line NOR the separate blue disclaimer paragraph survives.
// CORRECTION (see file header): the prep asserted the literal
// 'prof_clv_future_basis_nn' — the key is built by a template literal,
// so the prefix is asserted instead. The prep's 'no
// escapeHtml(futureBasis)</dd>' check is dropped: D4 keeps the
// "Not estimated: …" line in that same dd when there is no estimate,
// so the corrected check pins the subtitle shape + the note's removal.
test('C7 CLV estimate has a single concise subtitle', () => {
  assert.ok(appSrc.includes('prof_clv_future_basis_'), 'future-basis key still wired');
  assert.ok(!appSrc.includes("t('prof_clv_note')"), 'prof_clv_note paragraph removed');
  assert.match(appSrc, /Estimate · /);
  assert.match(appSrc, /formatPKR\(lifetime\.averageMonthlyRevenue\)\)\}\/mo avg × 12/);
  assert.match(appSrc, /lifetime\.estimatedFutureValue === null/);
});

// ---- C8: Wada chips are one horizontal scrollable row --------------------
test('C8 wada chip row scrolls horizontally, no wrap orphan', () => {
  const rule = stylesSrc.match(/\.waada-chip-row\s*\{[^}]*\}/);
  assert.ok(rule, '.waada-chip-row rule exists');
  assert.match(rule[0], /overflow-x:\s*auto/);
  assert.match(rule[0], /flex-wrap:\s*nowrap/);
});

// ---- C9: Receipts grid keeps 2 summary cards, rest collapsed -------------
test('C9 receipts section keeps only Outstanding + Total Paid visible', () => {
  // Fixed state: the receipts grid renders exactly two summary articles
  // by default and the other 9 behaviour cards sit inside one collapsed
  // <details> ('Payment Behavior & Stats').
  assert.match(appSrc, /Payment Behavior &amp; Stats|Payment Behavior & Stats/);
  assert.match(appSrc, /<details[^>]*>[\s\S]{0,200}Payment Behavior/);
});

// ---- C10: Monthly statement drops the middle pill + field pills ----------
test('C10 statement section has no middle summary pill or field pills', () => {
  // Fixed state: statementDraftHtml no longer emits the summary <p> nor
  // the .statement-draft-fields <ul> (the WhatsApp preview below shows
  // the same figures).
  assert.doesNotMatch(statementSrc, /statementDraftSummaryText\(statement, labels\)/);
  assert.doesNotMatch(statementSrc, /statement-draft-fields/);
  assert.match(statementSrc, /statement-draft-text/);
});

// ---- C11: Financial Details header stacks title over summary -------------
// CORRECTION (see file header): the prep asserted the GENERIC
// '.profile-detail-section summary' rule gets 'flex-direction: column'
// — that would restack all 7 profile sections. The fix scopes the
// stack to [data-profile-section="financial"] only.
test('C11 financial summary sits on its own line under the title', () => {
  const rule = stylesSrc.match(/\.profile-detail-section\[data-profile-section="financial"\] summary\s*\{[^}]*\}/);
  assert.ok(rule, 'scoped financial summary rule exists');
  assert.match(rule[0], /flex-wrap:\s*wrap/);
  const h3Rule = stylesSrc.match(/\.profile-detail-section\[data-profile-section="financial"\] summary h3\s*\{[^}]*\}/);
  assert.ok(h3Rule, 'scoped financial title rule exists');
  assert.match(h3Rule[0], /flex:\s*1 1 100%/);
});

// ---- C12: SERVICE money group is a key-value card, not oval pills --------
test('C12 money group rows are not 999px oval pills', () => {
  const rule = stylesSrc.match(/\.profile-info-group--money \.profile-readonly-field\s*\{[^}]*\}/);
  assert.ok(rule, 'money group rule exists');
  assert.doesNotMatch(rule[0], /border-radius:\s*999px/);
});

// ---- C13: Billing-cycle due-day input is a standard rounded input --------
test('C13 billing-cycle input is rounded and inline with save', () => {
  assert.match(appSrc, /id="billingCycleDueDay"[^>]*class="[^"]*rounded-xl/);
});

// ---- C14: Section explainers live behind a 20px (i) icon ----------------
test('C14 billing-cycle explainer is behind an info icon, not always visible', () => {
  const line = appSrc.split('\n').find((l) => l.includes('const billingCycleSectionHtml'));
  assert.ok(line, 'billing-cycle section exists');
  assert.match(line, /helpButtonMarkup\(/);
  assert.doesNotMatch(line, /<p>\$\{t\('prv_bc_explainer'\)\}<\/p>/);
});

// ---- C15: Wada form hides when totalDues === 0 ---------------------------
test('C15 wada form is hidden when total dues are zero', () => {
  assert.match(appSrc, /totalDues === 0|duesBreakdownFigures\.total === 0/);
});

// ---- C16: Next Month Projected is a 1-line footer under Dues ------------
test('C16 next-month projection is a one-line footer, not a section', () => {
  assert.doesNotMatch(appSrc, /nextBillProjectionSectionHtml\(nextBillProjection/);
  assert.match(duesSrc, /Projected/);
});

// ---- S checks: structure that must survive -------------------------------
test('S1 dues rows reconcile to the profile total', () => {
  const out = duesMod.duesBreakdownByMonth(fixtureCustomer(), fixtureAllocations(), 0);
  assert.equal(out.totalStillOwedCents, 100000);
  assert.equal(out.profileTotalCents, 100000);
  assert.equal(out.rows.filter((r) => r.settled).length, 2);
});

test('S2 all seven wada chips survive', () => {
  for (const key of ['plus2', 'plus5', 'fifth', 'tenth', '29th', '30th', '31st']) {
    assert.ok(appSrc.includes(`data-wada-quick-chip="${key}"`), `chip ${key}`);
  }
});

test('S3 balance reply urdu-script branch stays Urdu script', () => {
  const reply = balanceMod.buildBalanceReply({
    customerId: 'c1', customerName: 'Test Customer', outstanding: 0,
    dueDate: '2026-11-05', lastPayment: null, openDisputes: [], variant: 'urdu',
  });
  assert.match(reply.text, /کوئی رقم واجب الادا نہیں ہے/);
});

test('S4 statement draft urdu-script branch stays Urdu script', () => {
  const out = statementMod.buildStatementDraftText({
    customerName: 'Test Customer', month: '2026-11', openingBalance: 0,
    charges: 1000, paymentsReceived: 1000, closingBalance: 0,
    hasBill: true, paymentCount: 1,
  }, 'urdu');
  assert.match(out.text, /ماہانہ اسٹیٹمنٹ/);
});

test('S5 history window is the current month plus 23', () => {
  assert.equal(monthsMod.MONTH_LIMIT, 24);
  assert.equal(monthsMod.monthsForHistory(new Date('2026-11-22T00:00:00Z')).length, 24);
});

test('S6 financial section still moves under the Billing tab', () => {
  assert.match(appSrc, /PROFILE_SECTION_TAB = \{ financial: 'billing' \}/);
  assert.match(appSrc, /panel\.append\(section\)/);
});

test('S7 tab number spans are gone (Task K removed them)', () => {
  // Rebase (2026-11-23, P/Q/R onto bff3e5ed): K #1598 landed first and
  // removed the 1·/2·/3·/4· number spans from the profile tab bar.
  // This check was written pre-K ('spans exist for Task K to remove')
  // and is re-pinned to the K-era reality — the spans must be gone,
  // the four tab buttons keep their labels (plan519 + profile-info-
  // redesign + profile-tabs-baqaya pin the same absence).
  assert.ok(!indexSrc.includes('profile-tab-number'));
  assert.match(indexSrc, /id="profileTabBilling"[^>]*><span class="profile-tab-label"/);
  assert.match(indexSrc, /id="profileTabBaqaya"[^>]*><span class="profile-tab-label"/);
});

test('S8 receipts summary still renders total + tenure', () => {
  assert.match(appSrc, /prof_receipts_total/);
  assert.match(appSrc, /prof_receipts_tenure/);
});

test('S9 credit summary text is unchanged for a nonzero balance', () => {
  const balance = creditMod.creditBalanceForCustomer(
    [{ id: 'cr1', customerId: 'c1', source: 'overpayment', sourcePaymentId: 'p1', amountCents: 50000, date: '2026-11-01' }],
    [], 'c1',
  );
  assert.equal(balance.remainingCents, 50000);
  assert.match(creditMod.creditSummaryText(balance), /500/);
});

// ---- B checks: baseline guards -------------------------------------------
test('B1 empty customer shows the dues none-line, never a crash', () => {
  const out = duesMod.duesBreakdownByMonth({ id: 'c9', bills: [] }, fixtureAllocations(), 0);
  assert.equal(out.hasRows, false);
  assert.equal(out.profileTotalCents, 0);
});

test('B2 balance reply refuses a missing outstanding figure', () => {
  assert.equal(balanceMod.buildBalanceReply({
    customerId: 'c1', outstanding: null, variant: 'roman',
  }), null);
});
