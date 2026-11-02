// M12: Khata Doctor Six-Credit Mirror Pin (test-only).
//
// The bill engine's priced path (core.js calculatePaymentAllocations)
// subtracts SIX bill-level credits in a fixed order, each exactly once
// and each Math.min-clamped to the remaining due:
//   depositOffsetAmount (SISP-50, additionally capped at the bill's
//   total charge at its position) -> creditTransferInAmount (SISP-111)
//   -> badDebtWriteOffAmount (SISP-64) -> referralCreditAmount
//   (SISP-40) -> concessionAmount (SISP-30) -> feederHostCreditAmount
//   (SISP-97).
// The Khata Doctor (qa-khata-doctor.js computeLedgerBalance) mirrors
// all six in its own ledger recomputation — it walks them in a
// different order, but because every credit is clamped to the
// remaining due, the NET DUE must be identical to the cent.
// Per-feature tests pinned each credit on each side in isolation;
// no test ever drove the full combination grid through BOTH sides.
// This pin generates synthetic fixture bills carrying every subset
// combination of the six credits (the full 2^6 grid), including
// over-claim amounts that must clamp, and pins engine net due ===
// Doctor net due === the hand-computed closed form
// max(0, charge - sum(credits) - payments) for every combination.
// Any divergence = STOP and report — never fix money behaviour
// inside a pin phase.
//
// Synthetic data only; zero shipped files changed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePaymentAllocations } from '../core.js';
import { computeLedgerBalance } from '../qa-khata-doctor.js';

const MONTH = '2026-10';

// The six credits, in the ENGINE's subtraction order. `moderate`
// values are distinct so each credit lands at a different position
// in the clamp chain; `over` values each exceed the whole bill on
// their own; `paisa` values carry fractional rupees to pin the
// cent-rounding seam (moneyCents / cents both Math.round(x * 100)).
const CREDITS = [
  { field: 'depositOffsetAmount', label: 'deposit offset (SISP-50)', moderate: 400, over: 5000, paisa: 150.50 },
  { field: 'creditTransferInAmount', label: 'credit transfer in (SISP-111)', moderate: 500, over: 6000, paisa: 250.75 },
  { field: 'badDebtWriteOffAmount', label: 'bad-debt write-off (SISP-64)', moderate: 600, over: 7000, paisa: 350.25 },
  { field: 'referralCreditAmount', label: 'referral credit (SISP-40)', moderate: 700, over: 8000, paisa: 450.50 },
  { field: 'concessionAmount', label: 'concession (SISP-30)', moderate: 800, over: 9000, paisa: 550.75 },
  { field: 'feederHostCreditAmount', label: 'feeder-host credit (SISP-97)', moderate: 900, over: 10000, paisa: 650.25 }
];

const centsOf = (value) => Math.round(Number(value || 0) * 100);

// Every subset of the six credits: mask 0 (no credits, the baseline
// sanity case) through mask 63 (all six at once).
const subsets = [];
for (let mask = 0; mask < 64; mask++) {
  subsets.push(CREDITS.filter((_, index) => (mask & (1 << index)) !== 0));
}

const billWith = (subset, amountKey, { dueAmount = 3000, lateFee = 0, shiftingFee = 0, payments = [] } = {}) => {
  const bill = {
    id: 'b-m12', month: MONTH, dueAmount, dueDate: '2026-10-05', status: 'pending',
    priceSnapshot: dueAmount, payments, generated: true, amountHistory: []
  };
  if (lateFee) bill.lateFee = lateFee;
  if (shiftingFee) bill.shiftingFee = shiftingFee;
  for (const credit of subset) bill[credit.field] = credit[amountKey];
  return bill;
};

const customerWith = (bill) => ({
  id: 'cust-m12', customerNumber: 912, name: 'M12 Mirror Customer', bills: [bill], installmentPlans: []
});

// A fresh fixture per side so neither recomputation can observe the
// other's run.
const engineDueCents = (makeBill) => {
  const customer = customerWith(makeBill());
  return calculatePaymentAllocations({ customers: [customer] }).forMonth(customer.id, MONTH).balanceDueCents;
};
const doctorDueCents = (makeBill) => computeLedgerBalance(customerWith(makeBill())).balanceCents;

// Sequential Math.min-clamping of non-negative credits against a
// shrinking remainder always lands on this closed form, in ANY
// subtraction order — the independent hand computation both sides
// must equal.
const expectedDueCents = (subset, amountKey, { dueAmount = 3000, lateFee = 0, shiftingFee = 0, paidCents = 0 } = {}) => {
  const chargeCents = centsOf(dueAmount) + centsOf(lateFee) + centsOf(shiftingFee);
  const creditsCents = subset.reduce((sum, credit) => sum + centsOf(credit[amountKey]), 0);
  return Math.max(0, chargeCents - creditsCents - paidCents);
};

const runGrid = (amountKey, options = {}) => {
  for (const subset of subsets) {
    const names = subset.map((credit) => credit.label).join(' + ') || '(no credits)';
    const makeBill = () => billWith(subset, amountKey, options);
    const expected = expectedDueCents(subset, amountKey, options);
    assert.equal(engineDueCents(makeBill), expected, `engine due for [${names}]`);
    assert.equal(doctorDueCents(makeBill), expected, `Khata Doctor due for [${names}]`);
  }
};

test('M12: moderate credits (sum Rs 3,900) over the full 2^6 grid on a Rs 3,000 bill — engine === Doctor === closed form', () => {
  runGrid('moderate');
});

test('M12: over-claim credits (each alone exceeds the bill) over the full 2^6 grid — every clamp fires identically on both sides', () => {
  runGrid('over');
});

test('M12: moderate credits on a small Rs 1,000 bill — mid-chain clamping agrees on both sides', () => {
  runGrid('moderate', { dueAmount: 1000, priceSnapshot: 1000 });
});

test('M12: moderate credits with late fee Rs 200 + shifting fee Rs 100 (charge Rs 3,300) — the fee-inclusive clamp base agrees', () => {
  runGrid('moderate', { lateFee: 200, shiftingFee: 100 });
});

test('M12: paisa-valued credits on a Rs 2,000 bill — cent rounding of every credit agrees to the cent', () => {
  runGrid('paisa', { dueAmount: 2000, priceSnapshot: 2000 });
});

test('M12: moderate credits plus one plain Rs 1,000 cash payment — credits then receipt settle identically on both sides', () => {
  const payments = [{ id: 'pay-m12', date: '2026-10-06', amount: 1000, method: 'Cash' }];
  runGrid('moderate', { payments, paidCents: 100000 });
});

test('M12: a deposit offset larger than the bill alone zeroes the bill on both sides (deposit cap pin)', () => {
  const subset = [CREDITS[0]];
  const makeBill = () => billWith(subset, 'over');
  assert.equal(engineDueCents(makeBill), 0);
  assert.equal(doctorDueCents(makeBill), 0);
});

test('M12: all six credits stacked past the charge leave zero due and zero phantom arrears on both sides', () => {
  const makeBill = () => billWith(CREDITS, 'over');
  assert.equal(engineDueCents(makeBill), 0);
  assert.equal(doctorDueCents(makeBill), 0);
});
