/**
 * loose-change-credit.test.js — SISP-116: "Khula Paisa / Loose Change"
 * Next-Month Advance Credit Chip.
 *
 * Pins:
 *  - the round-up rule: owed -> next multiples of Rs 100 / 500 / 1,000
 *    (all real PKR denominations), deduped, smallest tender first, and
 *    only while 0 < change < tendered;
 *  - the SPEC PIN: owing Rs 2,850 and tendering Rs 3,000 with "Keep
 *    Change as Advance" clears the due to Rs 0 and leaves derived
 *    advance credit of exactly Rs 150 — plus the spec-text example
 *    Rs 2,870 -> Rs 3,000 -> Rs 130;
 *  - the money design: the credit is the allocation engine's DERIVED
 *    unappliedCreditCents (the figure advanceBalanceCents sums). The
 *    payment record itself is byte-identical in shape to a manually
 *    typed overpayment (no stamp, no kind, no parallel balance), cash
 *    totals count the full tendered Rs 3,000, the Khata Doctor agrees
 *    with the engine, and voiding the payment (SISP-34) removes the
 *    credit exactly — no orphan credit;
 *  - excess that settles a LATER bill is dues money, not change: only
 *    the leftover after every generated bill reports as credit;
 *  - both figures print: paidAmount stays the full tender on the A4 /
 *    thermal-80 / thermal-58 / PNG receipts plus the Quick Collect
 *    card and WhatsApp draft, with the new "+Rs 150" credit line; an
 *    exact payment prints no line and reports 0;
 *  - Field Mode: collectFieldModeLooseChange records through the same
 *    recorder, refuses non-suggestion tenders and zero-dues entries;
 *  - i18n: every khula_* key exists in BOTH dictionaries and every
 *    t('khula_...') call in the wired modules resolves;
 *  - wiring: the QC chip host exists in index.html and the chip CSS is
 *    token-only (no hex) in components.css.
 * Synthetic data only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createInitialState, updateCustomerProfile, generateMonthlyBillsThroughCurrentMonth,
  addPayment, calculatePaymentAllocations, derivedBillStatus
} from '../core.js';
import { advanceBalance, advanceBalanceCents } from '../advance-payment.js';
import { computeLedgerBalance } from '../qa-khata-doctor.js';
import { voidPayment } from '../payment-void-audit.js';
import {
  executeQuickCollection, renderQuickCollectReceiptCardHtml, formatQuickCollectWhatsAppReceipt,
  getPendingCollectionCustomers
} from '../nav-quick-collect.js';
import { collectFieldModeLooseChange, fieldModeCustomerStatus } from '../field-mode.js';
import { buildPaymentReceipt, generatePaymentReceiptHtml } from '../receipt.js';
import { buildPngReceiptModel } from '../png-receipt.js';
import { PKR_DENOMINATIONS } from '../pkr-notes.js';
import {
  LOOSE_CHANGE_STEPS, looseChangeSuggestions, isLooseChangeTender,
  looseChangeCreditCents, looseChangeChipsMarkup
} from '../loose-change-credit.js';
import { TRANSLATIONS } from '../nav-language.js';

const OCT_29 = new Date(2026, 9, 29, 12);
const NOV_2 = new Date(2026, 10, 2, 12);

/** One synthetic customer whose October 2026 bill is `fee` PKR. */
function stateWithFee(fee) {
  let state = createInitialState(['Khula Tester']);
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: String(fee) }, OCT_29);
  state = generateMonthlyBillsThroughCurrentMonth(state, OCT_29);
  return state;
}

const customerOf = (state) => state.customers[0];
const billOf = (state, month) => customerOf(state).bills.find(b => b.month === month);

/** Records the chip collection: owe `fee`, tender 3,000 cash in Quick Collect. */
function chipCollect(fee, tendered = 3000) {
  const state = stateWithFee(fee);
  return executeQuickCollection(state, {
    customerId: 'seed-001', month: '2026-10', amount: tendered, date: '2026-10-29', method: 'Cash'
  }, OCT_29);
}

// ---------------------------------------------------------------------------
// Round-up rule
// ---------------------------------------------------------------------------

test('suggestions: round up to the next Rs 100 / 500 / 1,000 multiples, deduped', () => {
  assert.deepEqual(looseChangeSuggestions(2850), [
    { tendered: 2900, change: 50 },
    { tendered: 3000, change: 150 }
  ]);
  assert.deepEqual(looseChangeSuggestions(2870), [
    { tendered: 2900, change: 30 },
    { tendered: 3000, change: 130 }
  ]);
  assert.deepEqual(looseChangeSuggestions(90), [
    { tendered: 100, change: 10 },
    { tendered: 500, change: 410 },
    { tendered: 1000, change: 910 }
  ]);
  // Already-round amounts and non-amounts suggest nothing.
  assert.deepEqual(looseChangeSuggestions(3000), []);
  assert.deepEqual(looseChangeSuggestions(0), []);
  assert.deepEqual(looseChangeSuggestions(-100), []);
  assert.deepEqual(looseChangeSuggestions('abc'), []);
  // Every step is a real circulating PKR note denomination.
  for (const step of LOOSE_CHANGE_STEPS) assert.ok(PKR_DENOMINATIONS.includes(step), `Rs ${step} is a note`);
});

test('isLooseChangeTender accepts only the chip\u2019s own suggestions', () => {
  assert.equal(isLooseChangeTender(2850, 3000), true);
  assert.equal(isLooseChangeTender(2850, 2900), true);
  assert.equal(isLooseChangeTender(2850, 2950), false);
  assert.equal(isLooseChangeTender(2850, 2850), false);
  assert.equal(isLooseChangeTender(0, 100), false);
});

test('chips markup: empty when nothing to suggest, tender data on each chip', () => {
  const label = (tendered, change) => `Pay ${tendered} keep ${change}`;
  assert.equal(looseChangeChipsMarkup(3000, label), '');
  assert.equal(looseChangeChipsMarkup(0, label), '');
  const markup = looseChangeChipsMarkup(2850, label);
  assert.match(markup, /data-loose-tender="2900"/);
  assert.match(markup, /data-loose-tender="3000"/);
  assert.match(markup, /Pay 3000 keep 150/);
  assert.equal(looseChangeCreditCents(null), 0);
  assert.equal(looseChangeCreditCents({ unappliedCreditCents: 15000 }), 15000);
  assert.equal(looseChangeCreditCents({ unappliedCreditCents: -5 }), 0);
});

// ---------------------------------------------------------------------------
// SPEC PIN — end to end through the existing recorder
// ---------------------------------------------------------------------------

test('SPEC PIN: owe 2,850, tender 3,000 -> due 0 and derived advance credit exactly 150', () => {
  const { nextState, receipt } = chipCollect(2850);
  const allocations = calculatePaymentAllocations(nextState);
  const summary = allocations.forMonth('seed-001', '2026-10');
  assert.equal(summary.balanceDueCents, 0);
  assert.equal(derivedBillStatus(customerOf(nextState), billOf(nextState, '2026-10'), allocations), 'paid');
  // The derived figure that carries the 150: engine unapplied credit,
  // summed by advanceBalanceCents — NOT a stored balance anywhere.
  assert.equal(advanceBalanceCents(nextState, 'seed-001'), 15000);
  assert.equal(advanceBalance(nextState, 'seed-001'), 150);
  assert.equal(receipt.advanceCreditGenerated, 150);
  assert.equal(receipt.amount, 3000);
  assert.equal(receipt.isSettled, true);
});

test('SPEC example: owe 2,870, tender 3,000 -> change kept is exactly 130', () => {
  const { nextState, receipt } = chipCollect(2870);
  assert.equal(advanceBalance(nextState, 'seed-001'), 130);
  assert.equal(receipt.advanceCreditGenerated, 130);
});

test('the payment record is a plain overpayment — no stamp, no kind, cash totals count the full tender', () => {
  const { nextState, receipt } = chipCollect(2850);
  const payment = billOf(nextState, '2026-10').payments.at(-1);
  assert.equal(payment.id, receipt.paymentId);
  assert.equal(payment.amount, 3000);
  assert.equal('kind' in payment, false);
  assert.equal('looseChange' in payment, false);
  assert.equal('advanceCredit' in payment, false);
  // A manually typed overpayment of the same amount yields the
  // identical derived figure (the chip is a shortcut, not a behaviour).
  const manual = executeQuickCollection(stateWithFee(2850), {
    customerId: 'seed-001', month: '2026-10', amount: 3000, date: '2026-10-29', method: 'Cash'
  }, OCT_29);
  assert.equal(manual.receipt.advanceCreditGenerated, 150);
  // Method/cash truth: the Doctor's payments total is the full tender.
  const doctor = computeLedgerBalance(customerOf(nextState));
  assert.equal(doctor.paymentsCents, 300000);
});

test('Khata Doctor agrees with the engine after a chip payment', () => {
  const { nextState } = chipCollect(2850);
  const doctor = computeLedgerBalance(customerOf(nextState));
  assert.equal(doctor.balanceCents, 0);
  assert.equal(doctor.creditCents, 15000);
});

test('voiding the chip payment removes the credit exactly — no orphan credit', () => {
  const { nextState, receipt } = chipCollect(2850);
  const { state: voided } = voidPayment(nextState, 'seed-001', '2026-10', receipt.paymentId, { voidReason: 'test void' });
  const allocations = calculatePaymentAllocations(voided);
  assert.equal(allocations.forMonth('seed-001', '2026-10').balanceDueCents, 285000);
  assert.equal(advanceBalanceCents(voided, 'seed-001'), 0);
  const doctor = computeLedgerBalance(customerOf(voided));
  assert.equal(doctor.balanceCents, 285000);
  assert.equal(doctor.creditCents, 0);
  // And the re-derived receipt for the voided payment reports no credit.
  const bill = billOf(voided, '2026-10');
  const rebuilt = buildPaymentReceipt(customerOf(voided), bill, bill.payments.at(-1));
  assert.equal(rebuilt.looseChangeCredit, 0);
});

test('excess that settles a later bill is dues money, not change — only the leftover is credit', () => {
  // Oct + Nov bills of Rs 1,000 each; paying Rs 2,500 onto October
  // settles both and keeps only Rs 500 as advance credit.
  let state = createInitialState(['Do Mah Tester']);
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: '1000' }, OCT_29);
  state = generateMonthlyBillsThroughCurrentMonth(state, NOV_2);
  state = addPayment(state, 'seed-001', '2026-10', { date: '2026-11-02', amount: '2500', method: 'Cash' }, NOV_2);
  const customer = customerOf(state);
  const bill = billOf(state, '2026-10');
  const receipt = buildPaymentReceipt(customer, bill, bill.payments.at(-1));
  assert.equal(receipt.looseChangeCredit, 500);
  assert.equal(advanceBalance(state, 'seed-001'), 500);
});

// ---------------------------------------------------------------------------
// Receipt printing — both figures, every layout
// ---------------------------------------------------------------------------

test('receipts print BOTH figures: full tender received + change kept as advance credit', () => {
  const { nextState, receipt: qcReceipt } = chipCollect(2850);
  const customer = customerOf(nextState);
  const bill = billOf(nextState, '2026-10');
  const receipt = buildPaymentReceipt(customer, bill, bill.payments.at(-1));
  assert.equal(receipt.paidAmount, 3000);
  assert.equal(receipt.looseChangeCredit, 150);
  assert.equal(receipt.status, 'PAID');
  for (const format of ['a4', 'thermal-80', 'thermal-58']) {
    const html = generatePaymentReceiptHtml(receipt, { format });
    assert.ok(html.includes('Change Kept as Advance Credit'), `${format} shows the credit line`);
    assert.ok(html.includes('PKR 150'), `${format} shows Rs 150`);
    assert.ok(html.includes('PKR 3,000'), `${format} shows the full Rs 3,000 received`);
  }
  const model = buildPngReceiptModel(receipt, customer);
  const row = model.financial.find(r => r.label.includes('Change Kept as Advance Credit'));
  assert.ok(row, 'PNG model carries the credit row');
  assert.ok(row.value.includes('150'));
  // Quick Collect card + WhatsApp draft carry the same line.
  const card = renderQuickCollectReceiptCardHtml(qcReceipt);
  assert.ok(card.includes('Change Kept as Advance Credit'));
  assert.ok(card.includes('PKR 150'));
  const wa = formatQuickCollectWhatsAppReceipt(qcReceipt);
  assert.ok(wa.text.includes('Change Kept as Advance Credit'));
  assert.ok(wa.text.includes('PKR 150'));
  assert.ok(wa.text.includes('PKR 3,000'));
});

test('an exact payment reports 0 and prints no credit line anywhere', () => {
  const { nextState, receipt: qcReceipt } = executeQuickCollection(stateWithFee(2850), {
    customerId: 'seed-001', month: '2026-10', amount: 2850, date: '2026-10-29', method: 'Cash'
  }, OCT_29);
  assert.equal(qcReceipt.advanceCreditGenerated, 0);
  const customer = customerOf(nextState);
  const bill = billOf(nextState, '2026-10');
  const receipt = buildPaymentReceipt(customer, bill, bill.payments.at(-1));
  assert.equal(receipt.looseChangeCredit, 0);
  for (const format of ['a4', 'thermal-80', 'thermal-58']) {
    assert.ok(!generatePaymentReceiptHtml(receipt, { format }).includes('Change Kept as Advance Credit'), format);
  }
  assert.ok(!renderQuickCollectReceiptCardHtml(qcReceipt).includes('Change Kept as Advance Credit'));
  assert.ok(!formatQuickCollectWhatsAppReceipt(qcReceipt).text.includes('Advance Credit'));
});

// ---------------------------------------------------------------------------
// Field Mode
// ---------------------------------------------------------------------------

test('Field Mode loose-change collection settles dues and derives the same credit', () => {
  const state = stateWithFee(2850);
  const entry = getPendingCollectionCustomers(state, '', 'all-dues', OCT_29).find(e => e.id === 'seed-001');
  assert.equal(entry.totalDues, 2850);
  const { nextState, receipt } = collectFieldModeLooseChange(state, entry, 'Cash', 3000, OCT_29);
  assert.equal(receipt.advanceCreditGenerated, 150);
  const status = fieldModeCustomerStatus(nextState, 'seed-001');
  assert.equal(status.totalDues, 0);
  assert.equal(status.advanceCredit, 150);
  assert.equal(status.key, 'advance');
});

test('Field Mode refuses non-suggestion tenders and zero-dues entries', () => {
  const state = stateWithFee(2850);
  const entry = getPendingCollectionCustomers(state, '', 'all-dues', OCT_29).find(e => e.id === 'seed-001');
  assert.throws(() => collectFieldModeLooseChange(state, entry, 'Cash', 2950, OCT_29), /round-note/);
  assert.throws(() => collectFieldModeLooseChange(state, entry, 'Cash', 2850, OCT_29), /round-note/);
  assert.throws(() => collectFieldModeLooseChange(state, { ...entry, totalDues: 0 }, 'Cash', 3000, OCT_29), /No pending balance/);
});

// ---------------------------------------------------------------------------
// i18n + wiring
// ---------------------------------------------------------------------------

test('i18n: every khula_* key exists in both dictionaries and every wired t() call resolves', () => {
  for (const key of ['khula_chip', 'khula_credit_row']) {
    assert.ok(TRANSLATIONS.en[key], `en ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `ur ${key}`);
    assert.notEqual(TRANSLATIONS.en[key], key);
    assert.notEqual(TRANSLATIONS.ur[key], key);
  }
  assert.ok(TRANSLATIONS.en.khula_chip.includes('{tendered}') && TRANSLATIONS.en.khula_chip.includes('{change}'));
  assert.ok(TRANSLATIONS.ur.khula_chip.includes('{tendered}') && TRANSLATIONS.ur.khula_chip.includes('{change}'));
  for (const file of ['nav-quick-collect.js', 'field-mode.js']) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    const used = [...source.matchAll(/t\('(khula_[a-z_]+)'/g)].map(m => m[1]);
    assert.ok(used.length > 0, `${file} uses khula keys`);
    for (const key of used) {
      assert.ok(TRANSLATIONS.en[key] && TRANSLATIONS.ur[key], `${file} t('${key}') resolves in both dictionaries`);
    }
  }
});

test('wiring: QC chip host in index.html, FM chip styles token-only in components.css', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="quickCollectLooseChangeChips"'));
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const block = css.slice(css.indexOf('SISP-116: khula-paisa'), css.indexOf('.field-mode-waada-date'));
  assert.ok(block.includes('.loose-change-chip'));
  assert.ok(block.includes('.field-mode-loose-chip'));
  assert.ok(block.includes('var(--color-pending)'));
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'no hex colours in the SISP-116 CSS block');
});
