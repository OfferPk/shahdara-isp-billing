/**
 * sisp61-prepay-discount.test.js — SISP-61 remainder: Customer
 * Multi-Month Advance Prepay & Discount Engine.
 *
 * Spec pin: recording a 3-month prepay on a Rs. 3,000 package (gross
 * Rs. 9,000, discount Rs. 500, cash paid Rs. 8,500) credits Rs. 9,000
 * of advance coverage so the next 3 monthly cycles produce Rs. 0 net
 * due.
 *
 * The two truths under test:
 *  - CASH TRUTH: Rs. 8,500 is the only cash figure anywhere (payment
 *    amount, method totals, dashboard collected, doctor payments).
 *    The Rs. 9,000 gross never appears as cash collected.
 *  - COVERAGE TRUTH: the customer is credited the full Rs. 9,000 —
 *    the upfront discount converts into reserved advance credit in
 *    the allocation engine instead of being applied (and partly
 *    lost) against the bill the receipt is attached to.
 *
 * Also pinned: the 🟢 Prepaid Until badge derives from live coverage
 * (shrinks on a mid-prepay rate rise, disappears when exhausted), a
 * SISP-34 void reverses coverage AND discount together, FREE /
 * archived customers cannot prepay, the receipt prints gross /
 * discount / cash as separate lines, and every non-prepay payment
 * keeps the legacy discount behaviour byte-for-byte.
 * Synthetic data only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createInitialState, addCustomer, archiveCustomer, updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth, addPayment, validatePayment,
  correctPayment, calculatePaymentAllocations, derivedBillStatus,
  calculateMethodCollectionTotals, prepayTermsOf, persistState, readState
} from '../core.js';
import { recordAdvancePayment, advanceBalanceCents } from '../advance-payment.js';
import { recordPrepay, prepayQuote, prepaidUntilMonth, livePrepayRecords, PREPAY_DISCOUNT_REASON } from '../advance-prepay.js';
import { arrearsAndAdvance } from '../billing-cycle.js';
import { buildAdvanceDashboard } from '../advance-dashboard.js';
import { computeLedgerBalance } from '../qa-khata-doctor.js';
import { voidPayment } from '../payment-void-audit.js';
import { buildPaymentReceipt, generatePaymentReceiptHtml } from '../receipt.js';
import { buildPngReceiptModel } from '../png-receipt.js';
import { prepaidUntilBadgeHtml } from '../profile-ui.js';
import { TRANSLATIONS } from '../nav-language.js';

const OCT_29 = new Date(2026, 9, 29, 12);
const NOV_2 = new Date(2026, 10, 2, 12);
const DEC_2 = new Date(2026, 11, 2, 12);
const JAN_3 = new Date(2027, 0, 3, 12);
const FEB_2 = new Date(2027, 1, 2, 12);
const store = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };

/** One synthetic customer, PKR 3,000/month, October 2026 bill generated. */
function octoberState() {
  let state = createInitialState(['Prepay Tester']);
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: '3000' }, OCT_29);
  state = generateMonthlyBillsThroughCurrentMonth(state, OCT_29);
  return state;
}
/** October bill fully paid with one ordinary Rs. 3,000 cash payment. */
function octoberPaidState() {
  return addPayment(octoberState(), 'seed-001', '2026-10', { date: '2026-10-05', amount: '3000', method: 'Cash' }, OCT_29);
}
/** The spec pin recorded on 29 Oct: 3 months from November, Rs. 500 off. */
function pinState() {
  const { nextState, payment, quote } = recordPrepay(octoberPaidState(), 'seed-001', { months: 3, discount: 500, date: '2026-10-29', method: 'JazzCash' }, OCT_29);
  return { state: nextState, payment, quote };
}
const billOf = (state, month) => state.customers[0].bills.find(b => b.month === month);

test('spec pin: 3-month prepay — Rs. 8,500 cash credits Rs. 9,000 coverage, next 3 cycles Rs. 0 net due', () => {
  const { state, payment, quote } = pinState();
  // The quote: gross 9,000 = 3,000 × 3; cash = gross − discount.
  assert.deepEqual(
    { months: quote.months, startMonth: quote.startMonth, endMonth: quote.endMonth, rate: quote.rate, gross: quote.gross, discount: quote.discount, netPaid: quote.netPaid },
    { months: 3, startMonth: '2026-11', endMonth: '2027-01', rate: 3000, gross: 9000, discount: 500, netPaid: 8500 }
  );
  // ONE payment record: cash amount, labelled discount, audited terms.
  assert.equal(payment.amount, 8500);
  assert.equal(payment.discount, 500);
  assert.equal(payment.discountReason, PREPAY_DISCOUNT_REASON);
  assert.equal(payment.kind, 'advance');
  assert.equal(payment.targetMonth, '2026-11');
  assert.deepEqual(prepayTermsOf(payment), { months: 3, gross: 9000, rate: 3000, startMonth: '2026-11' });
  // COVERAGE: the full gross is held as advance credit.
  assert.equal(advanceBalanceCents(state, 'seed-001'), 900000);
  assert.equal(arrearsAndAdvance(state.customers[0], '2026-11').advanceCredit, 9000);
  // CASH: method totals for October count the ordinary 3,000 + 8,500 —
  // the 9,000 gross appears nowhere as cash.
  const totals = calculateMethodCollectionTotals(state, '2026-10');
  assert.equal(totals.JazzCash, 8500);
  assert.equal(totals.byMethod.JazzCash.amount, 8500);
  assert.equal(totals.Cash, 3000);
  assert.equal(totals.total, 11500);
  const dashboard = buildAdvanceDashboard(state, '2026-10');
  // The advance dashboard's collected figure is the prepay's CASH
  // (Rs. 8,500) — never the Rs. 9,000 gross; held is the coverage.
  assert.equal(dashboard.collectedThisMonthCents, 850000);
  assert.equal(dashboard.heldTotalCents, 900000);
  // Doctor agrees: balance 0, credit 9,000, cash 11,500, and the
  // discount counted ONCE (as coverage — discountsCents stays 0).
  const doctor = computeLedgerBalance(state.customers[0]);
  assert.equal(doctor.balanceCents, 0);
  assert.equal(doctor.creditCents, 900000);
  assert.equal(doctor.paymentsCents, 1150000);
  assert.equal(doctor.discountsCents, 0);

  // The next three monthly cycles each clear to Rs. 0 net due, paid.
  let grown = state;
  for (const [when, month] of [[NOV_2, '2026-11'], [DEC_2, '2026-12'], [JAN_3, '2027-01']]) {
    grown = generateMonthlyBillsThroughCurrentMonth(grown, when);
    const allocations = calculatePaymentAllocations(grown);
    const summary = allocations.forMonth('seed-001', month);
    assert.equal(summary.billAmountCents, 300000, `${month} billed at the package rate`);
    assert.equal(summary.balanceDueCents, 0, `${month} net due is Rs. 0`);
    assert.equal(derivedBillStatus(grown.customers[0], billOf(grown, month), allocations), 'paid', `${month} reads paid`);
  }
  assert.equal(advanceBalanceCents(grown, 'seed-001'), 0);
  assert.equal(computeLedgerBalance(grown.customers[0]).balanceCents, 0);
});

test('badge: 🟢 Prepaid Until tracks live coverage and disappears when exhausted', () => {
  const { state } = pinState();
  assert.equal(prepaidUntilMonth(state, 'seed-001', OCT_29), '2027-01');
  const html = prepaidUntilBadgeHtml(state, state.customers[0], OCT_29);
  assert.ok(html.includes('prepaid-until-badge'));
  assert.ok(html.includes('🟢'));
  assert.ok(html.includes('Jan 2027'));
  // Consumption does not shrink the badge while coverage still reaches
  // January — November's bill is paid BY the coverage.
  let grown = generateMonthlyBillsThroughCurrentMonth(state, NOV_2);
  assert.equal(prepaidUntilMonth(grown, 'seed-001', NOV_2), '2027-01');
  grown = generateMonthlyBillsThroughCurrentMonth(grown, JAN_3);
  assert.equal(prepaidUntilMonth(grown, 'seed-001', JAN_3), '2027-01');
  // February: coverage is exhausted — the badge is GONE, not stale.
  assert.equal(prepaidUntilMonth(grown, 'seed-001', FEB_2), null);
  assert.equal(prepaidUntilBadgeHtml(grown, grown.customers[0], FEB_2), '');
});

test('badge follows the CREDIT, not the promised months: a mid-prepay rate rise shrinks it', () => {
  const { state } = pinState();
  let grown = generateMonthlyBillsThroughCurrentMonth(state, NOV_2);
  assert.equal(prepaidUntilMonth(grown, 'seed-001', NOV_2), '2027-01');
  // Package rises to Rs. 4,000 from December (the November bill already
  // exists, so the schedule change takes effect next month).
  grown = updateCustomerProfile(grown, 'seed-001', { monthlySellingAmount: '4000' }, NOV_2);
  // Remaining credit is Rs. 6,000: December at 4,000 is covered,
  // January at 4,000 is not — the badge must say December, not January.
  assert.equal(prepaidUntilMonth(grown, 'seed-001', NOV_2), '2026-12');
  grown = generateMonthlyBillsThroughCurrentMonth(grown, DEC_2);
  const december = calculatePaymentAllocations(grown).forMonth('seed-001', '2026-12');
  assert.equal(december.billAmountCents, 400000);
  assert.equal(december.creditAppliedCents, 400000);
  assert.equal(december.balanceDueCents, 0);
  // Only Rs. 2,000 of credit remains, so January at the new rate is
  // exactly Rs. 2,000 short — coverage followed the money throughout.
  grown = generateMonthlyBillsThroughCurrentMonth(grown, JAN_3);
  const january = calculatePaymentAllocations(grown).forMonth('seed-001', '2027-01');
  assert.equal(january.creditAppliedCents, 200000);
  assert.equal(january.balanceDueCents, 200000);
});

test('arrears honesty: cash settles the current due first, so the badge reports what the credit really covers', () => {
  // October is UNPAID when the 3-month prepay is recorded: per the
  // house advance rule the receipt settles October first, leaving
  // Rs. 6,000 of coverage — November + December, not January.
  const { nextState, quote } = recordPrepay(octoberState(), 'seed-001', { months: 3, discount: 500, date: '2026-10-29', method: 'Cash' }, OCT_29);
  assert.equal(quote.gross, 9000);
  assert.equal(calculatePaymentAllocations(nextState).forMonth('seed-001', '2026-10').balanceDueCents, 0);
  assert.equal(advanceBalanceCents(nextState, 'seed-001'), 600000);
  assert.equal(prepaidUntilMonth(nextState, 'seed-001', OCT_29), '2026-12');
});

test('void (SISP-34) reverses the unused coverage AND the discount together', () => {
  const { state, payment } = pinState();
  // Void before any cycle consumes the coverage.
  const early = voidPayment(state, 'seed-001', '2026-10', payment.id, { voidReason: 'Customer changed mind' }).state;
  assert.equal(advanceBalanceCents(early, 'seed-001'), 0);
  assert.equal(prepaidUntilMonth(early, 'seed-001', OCT_29), null);
  assert.deepEqual(livePrepayRecords(early, 'seed-001'), []);
  assert.equal(computeLedgerBalance(early.customers[0]).creditCents, 0);
  // Void after November consumed its share: November reopens in full
  // and no orphan discount credit survives anywhere.
  let grown = generateMonthlyBillsThroughCurrentMonth(state, NOV_2);
  assert.equal(advanceBalanceCents(grown, 'seed-001'), 600000);
  const late = voidPayment(grown, 'seed-001', '2026-10', payment.id, { voidReason: 'Prepay refunded' }).state;
  const allocations = calculatePaymentAllocations(late);
  assert.equal(allocations.forMonth('seed-001', '2026-11').balanceDueCents, 300000);
  assert.equal(allocations.forMonth('seed-001', '2026-10').balanceDueCents, 0);
  assert.equal(advanceBalanceCents(late, 'seed-001'), 0);
  const doctor = computeLedgerBalance(late.customers[0]);
  assert.equal(doctor.balanceCents, 300000);
  assert.equal(doctor.creditCents, 0);
  assert.equal(doctor.discountsCents, 0);
});

test('guards: FREE, archived, bad months, bad discounts and a missing fee are all refused', () => {
  const base = octoberPaidState();
  // FREE connection: nothing to prepay.
  let withFree = addCustomer(base, 'Free Tester', OCT_29, { isFreeConnection: true });
  const freeId = withFree.customers.find(c => c.name === 'Free Tester').id;
  assert.throws(() => recordPrepay(withFree, freeId, { months: 3, date: '2026-10-29', method: 'Cash' }, OCT_29), /FREE connections have no bill to prepay/);
  // Archived customer.
  const archived = archiveCustomer(base, 'seed-001', OCT_29);
  assert.throws(() => recordPrepay(archived, 'seed-001', { months: 3, date: '2026-10-29', method: 'Cash' }, OCT_29), /Archived customers cannot record a prepay/);
  // Months outside the 2/3/6/12 picker.
  for (const months of [1, 4, 5, 24, 'three']) {
    assert.throws(() => recordPrepay(base, 'seed-001', { months, date: '2026-10-29', method: 'Cash' }, OCT_29), /Choose 2, 3, 6 or 12 months/);
  }
  // Discount must satisfy 0 <= discount < gross (gross is 9,000).
  assert.throws(() => recordPrepay(base, 'seed-001', { months: 3, discount: 9000, date: '2026-10-29', method: 'Cash' }, OCT_29), /less than the total prepay amount/);
  assert.throws(() => recordPrepay(base, 'seed-001', { months: 3, discount: 9500, date: '2026-10-29', method: 'Cash' }, OCT_29), /less than the total prepay amount/);
  assert.throws(() => recordPrepay(base, 'seed-001', { months: 3, discount: -1, date: '2026-10-29', method: 'Cash' }, OCT_29), /cannot be negative/);
  // A start month in the past is refused.
  assert.throws(() => recordPrepay(base, 'seed-001', { months: 3, startMonth: '2026-09', date: '2026-10-29', method: 'Cash' }, OCT_29), /current month or a later month/);
  // No package fee set: there is no rate to quote from.
  let noFee = createInitialState(['No Fee Tester']);
  noFee = generateMonthlyBillsThroughCurrentMonth(noFee, OCT_29);
  assert.throws(() => recordPrepay(noFee, 'seed-001', { months: 3, date: '2026-10-29', method: 'Cash' }, OCT_29), /Set the package fee before recording a prepay/);
  // The quote itself is pure and shares the same rules.
  assert.throws(() => prepayQuote(base.customers[0], { months: 4, startMonth: '2026-11' }), /Choose 2, 3, 6 or 12 months/);
});

test('zero-discount prepay works and stores no discount fields', () => {
  const { nextState, payment, quote } = recordPrepay(octoberPaidState(), 'seed-001', { months: 2, date: '2026-10-29', method: 'Cash' }, OCT_29);
  assert.equal(quote.gross, 6000);
  assert.equal(quote.netPaid, 6000);
  assert.equal(payment.amount, 6000);
  assert.equal('discount' in payment, false);
  assert.equal(advanceBalanceCents(nextState, 'seed-001'), 600000);
  assert.equal(prepaidUntilMonth(nextState, 'seed-001', OCT_29), '2026-12');
});

test('schema: prepay terms are kept only on a targeted advance with a valid triple — and survive storage + correction', () => {
  // Valid triple on a targeted advance: kept.
  const tagged = validatePayment({ date: '2026-10-29', amount: '8500', method: 'Cash', kind: 'advance', targetMonth: '2026-11', prepayMonths: 3, prepayGross: 9000, prepayRate: 3000 }, OCT_29);
  assert.deepEqual(prepayTermsOf(tagged), { months: 3, gross: 9000, rate: 3000, startMonth: '2026-11' });
  // Terms on a normal payment, an untargeted advance, or with an
  // off-picker month count are dropped whole — never stored raw.
  for (const fields of [
    { date: '2026-10-29', amount: '8500', method: 'Cash', targetMonth: '2026-11', prepayMonths: 3, prepayGross: 9000, prepayRate: 3000 },
    { date: '2026-10-29', amount: '8500', method: 'Cash', kind: 'advance', prepayMonths: 3, prepayGross: 9000, prepayRate: 3000 },
    { date: '2026-10-29', amount: '8500', method: 'Cash', kind: 'advance', targetMonth: '2026-11', prepayMonths: 4, prepayGross: 9000, prepayRate: 3000 },
    { date: '2026-10-29', amount: '8500', method: 'Cash', kind: 'advance', targetMonth: '2026-11', prepayMonths: 3, prepayGross: 0, prepayRate: 3000 }
  ]) {
    const cleaned = validatePayment(fields, OCT_29);
    assert.equal('prepayMonths' in cleaned, false);
    assert.equal(prepayTermsOf(cleaned), null);
  }
  // Storage round-trip keeps the terms (payments are not whitelisted
  // on load, and the backup merge deep-copies them).
  const { state, payment } = pinState();
  const storage = store();
  persistState(state, storage);
  const restored = readState(storage);
  const stored = billOf(restored, '2026-10').payments.find(p => p.id === payment.id);
  assert.deepEqual(prepayTermsOf(stored), { months: 3, gross: 9000, rate: 3000, startMonth: '2026-11' });
  // A correction (the form carries no prepay fields) restates the
  // amount without stripping the terms or the discount's coverage.
  const corrected = correctPayment(restored, 'seed-001', '2026-10', payment.id, { date: '2026-10-29', amount: '8400', method: 'JazzCash' }, OCT_29);
  const fixed = billOf(corrected, '2026-10').payments.find(p => p.id === payment.id);
  assert.equal(fixed.amount, 8400);
  assert.equal(fixed.discount, 500);
  assert.deepEqual(prepayTermsOf(fixed), { months: 3, gross: 9000, rate: 3000, startMonth: '2026-11' });
  assert.equal(advanceBalanceCents(corrected, 'seed-001'), 890000);
});

test('non-prepay payments keep the legacy discount behaviour exactly', () => {
  // Ordinary payment with a discount on a priced bill: the discount
  // applies to that bill and no credit is minted.
  let state = octoberState();
  state = addPayment(state, 'seed-001', '2026-10', { date: '2026-10-05', amount: '2500', discount: '500', discountReason: 'Goodwill', method: 'Cash' }, OCT_29);
  let allocations = calculatePaymentAllocations(state);
  assert.equal(allocations.forMonth('seed-001', '2026-10').balanceDueCents, 0);
  assert.equal(allocations.forMonth('seed-001', '2026-10').discountAppliedCents, 50000);
  assert.equal(advanceBalanceCents(state, 'seed-001'), 0);
  // A plain targeted advance WITH a discount (no prepay terms) also
  // keeps the same-month rule: discount settles the origin bill.
  let adv = recordAdvancePayment(octoberState(), 'seed-001', { amount: 2500, discount: 500, discountReason: 'Goodwill', date: '2026-10-29', method: 'Cash', targetMonth: '2026-11' }, OCT_29).nextState;
  allocations = calculatePaymentAllocations(adv);
  assert.equal(allocations.forMonth('seed-001', '2026-10').balanceDueCents, 0);
  assert.equal(advanceBalanceCents(adv, 'seed-001'), 0);
  // And the origin-bill discount cap still guards non-prepay records.
  assert.throws(
    () => recordAdvancePayment(octoberPaidState(), 'seed-001', { amount: 100, discount: 500, date: '2026-10-29', method: 'Cash', targetMonth: '2026-11' }, OCT_29),
    /Discount cannot exceed/
  );
});

test('prepay recorded against an unpriced bill still credits the full gross', () => {
  // The October bill exists but carries no price yet (fee workflow
  // pending): the whole receipt — cash plus discount coverage — is
  // unused credit, exactly like the engine's priced-bill rule.
  let state = octoberPaidState();
  state = { ...state, customers: state.customers.map(c => ({ ...c, bills: c.bills.map(b => b.month === '2026-10' ? { ...b, dueAmount: null } : b) })) };
  const { nextState, payment } = recordPrepay(state, 'seed-001', { months: 3, discount: 500, date: '2026-10-29', method: 'Cash' }, OCT_29);
  assert.equal(payment.amount, 8500);
  // 3,000 ordinary cash + 8,500 prepay cash + 500 discount coverage.
  assert.equal(advanceBalanceCents(nextState, 'seed-001'), 1200000);
  const ledger = calculatePaymentAllocations(nextState).byPaymentId.get(payment.id);
  assert.equal(ledger.prepayDiscountCreditCents, 50000);
  assert.equal(computeLedgerBalance(nextState.customers[0]).creditCents, 1200000);
});

test('receipt: gross, discount and cash print as separate lines; paidAmount stays net cash', () => {
  const { state, payment } = pinState();
  const customer = state.customers[0];
  const receipt = buildPaymentReceipt(customer, billOf(state, '2026-10'), payment);
  assert.deepEqual(receipt.prepay, { months: 3, gross: 9000, rate: 3000, startMonth: '2026-11', discount: 500, cashPaid: 8500 });
  assert.equal(receipt.paidAmount, 8500);
  assert.equal(receipt.discount, 500);
  for (const format of ['a4', 'thermal-80', 'thermal-58']) {
    const html = generatePaymentReceiptHtml(receipt, { format });
    assert.ok(html.includes('Prepay Coverage'), `${format} shows the coverage line`);
    assert.ok(html.includes('Prepay Discount'), `${format} shows the discount line`);
    assert.ok(html.includes('9,000'), `${format} shows the gross`);
    // The discount prints exactly once (generic row is suppressed).
    assert.equal((html.match(/Prepay Discount/g) || []).length, 1, `${format} prints the discount once`);
  }
  const png = buildPngReceiptModel(receipt, customer);
  assert.ok(png.financial.some(row => row.label.includes('Prepay Coverage') && row.value.includes('9,000')));
  assert.ok(png.financial.some(row => row.label.includes('Prepay Discount') && row.value.includes('500')));
  assert.ok(png.financial.some(row => row.label.includes('Amount Paid') && row.value.includes('8,500')));
  // A plain payment's receipt carries no prepay block at all.
  const plain = buildPaymentReceipt(customer, billOf(state, '2026-10'), billOf(state, '2026-10').payments[0]);
  assert.equal(plain.prepay, null);
});

test('i18n: every prepay string exists in both dictionaries with its params', () => {
  const keys = ['prepay_section_title', 'prepay_section_help', 'prepay_months_label', 'prepay_months_option', 'prepay_start_label', 'prepay_rate_line', 'prepay_discount_label', 'prepay_summary', 'prepay_save', 'prepay_recorded', 'prepay_until_suffix', 'prepaid_badge', 'prepay_free_blocked', 'prepay_no_fee'];
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
  }
  for (const lang of ['en', 'ur']) {
    assert.ok(TRANSLATIONS[lang].prepay_months_option.includes('{months}'), `${lang} months param`);
    assert.ok(TRANSLATIONS[lang].prepay_rate_line.includes('{amount}'), `${lang} rate param`);
    assert.ok(TRANSLATIONS[lang].prepay_summary.includes('{gross}') && TRANSLATIONS[lang].prepay_summary.includes('{discount}') && TRANSLATIONS[lang].prepay_summary.includes('{net}'), `${lang} summary params`);
    assert.ok(TRANSLATIONS[lang].prepay_until_suffix.includes('{month}'), `${lang} until param`);
    assert.ok(TRANSLATIONS[lang].prepaid_badge.includes('{month}'), `${lang} badge param`);
    assert.ok(TRANSLATIONS[lang].prepaid_badge.includes('🟢'), `${lang} badge carries the green dot`);
  }
});

test('wiring: dialog section, badge surfaces, token-only CSS, and no new build entry', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['prepayMonths', 'prepayStartMonth', 'prepayDiscount', 'prepaySaveBtn', 'prepayRateLine', 'prepaySummaryLine']) {
    assert.ok(html.includes(`id="${id}"`), `dialog has #${id}`);
  }
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './advance-prepay.js'"), 'app.js imports the prepay module');
  assert.ok(app.includes('recordPrepay(state, customerId'), 'dialog save routes to recordPrepay');
  assert.ok(app.includes('prepaidUntilBadgeHtml(state, customer)'), 'profile + card render the badge');
  const profileUi = readFileSync(new URL('../profile-ui.js', import.meta.url), 'utf8');
  assert.ok(profileUi.includes("from './advance-prepay.js'"), 'profile-ui derives the badge month from the module');
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const badgeRule = css.match(/\.prepaid-until-badge \{[^}]*\}/);
  assert.ok(badgeRule, 'badge rule exists');
  assert.ok(badgeRule[0].includes('var(--'), 'badge rule uses theme tokens');
  assert.ok(!/#[0-9a-fA-F]{3,8}/.test(badgeRule[0]), 'badge rule has no hard-coded hex (dark-mode safe)');
  const sectionRule = css.match(/\.prepay-section \{[^}]*\}/);
  assert.ok(sectionRule && !/#[0-9a-fA-F]{3,8}/.test(sectionRule[0]), 'prepay section uses tokens only');
  // Perf budget #219: advance-prepay.js is imported ONLY by app.js and
  // must not become a build entry of its own.
  const build = readFileSync(new URL('../build.mjs', import.meta.url), 'utf8');
  assert.ok(!build.includes("'advance-prepay.js'"), 'advance-prepay.js is not a build entry');
});
