// Plan P — Billing clarity: arrears, advance, concession, deposit labels.
//
// PRESENTATION ONLY. This module never changes a bill, a payment, or any
// total. Every figure is derived from the same stored data and the same
// allocation engine the rest of the app already uses:
//   - the package/kist split comes from the bill's own kist lines,
//   - previous arrears come from billing-cycle.js arrearsAndAdvance
//     (the sum of earlier months' allocation balances),
//   - advance consumed / cash paid / payment discount come from the
//     allocation summary for this bill month,
//   - concession, deposit offset and the other bill-field credits are
//     the bill's own audited fields, clamped in the allocation engine's
//     order (deposit, credit transfer, bad-debt write-off, referral,
//     concession, feeder-host) so a stamped waiver can never make the
//     displayed deductions exceed the bill itself.
//
// Reconciliation identity (in cents, so no float drift):
//   gross  = package + kist + late fee + shifting fee + previous arrears
//   net    = gross - (waivers + advance consumed + cash paid + discount)
//          = previous arrears + this month's allocation balance
// The second equality holds because the engine clamps every deduction
// to what is still due, in the same order, before cash/discount are
// applied. A breakdown therefore always sums to the shown total, and
// the shown total never moves: the engine's balance is untouched.

import { calculatePaymentAllocations, formatPKR } from './core.js';
import { arrearsAndAdvance } from './billing-cycle.js';
import { billKistTotal } from './installment-plan.js';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const centsOf = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
};
const rupeesOf = (centsValue) => centsValue / 100;

export const BILL_CLARITY_LABELS = Object.freeze({
  package: 'Monthly package',
  kist: 'Kist (installments this month)',
  lateFee: 'Late fee',
  shiftingFee: 'Shifting fee',
  previousArrears: 'Arrears — Sabiqa Baqaya',
  grossTotal: 'Total due',
  concession: 'Concession — Reaayat',
  depositOffset: 'Deposit offset — Security deposit se kata',
  referralCredit: 'Referral credit — Hamsaya credit',
  feederHostCredit: 'Feeder host credit — Bijli credit',
  creditTransferIn: 'Credit transfer in',
  badDebtWriteOff: 'Bad-debt write-off',
  advanceConsumed: 'Advance consumed — Advance se kata',
  cashPaid: 'Cash received this month',
  discountApplied: 'Payment discount',
  netBalance: 'Balance due — Baqi'
});

/**
 * Pure, read-only bill breakdown for one bill month. Returns null for a
 * missing/unpriced bill (no amount to explain), never throws for messy
 * stored data: unknown fields count as zero.
 */
export function billClarityBreakdown(customer, bill, allocations = null) {
  if (!customer || !bill || !MONTH_RE.test(String(bill.month ?? ''))) return null;
  const due = Number(bill.dueAmount);
  if (!Number.isFinite(due) || due <= 0) return null;

  const kistCents = centsOf(billKistTotal(bill));
  const packageCents = Math.max(0, Math.round(due * 100) - kistCents);
  const lateFeeCents = centsOf(bill.lateFee);
  const shiftingFeeCents = centsOf(bill.shiftingFee);
  const previousArrearsCents = centsOf(arrearsAndAdvance(customer, bill.month).previousArrears);

  const summary = allocations?.forMonth?.(customer.id, bill.month)
    ?? calculatePaymentAllocations({ customers: [customer] }).forMonth(customer.id, bill.month);
  const advanceConsumedCents = summary?.creditAppliedCents > 0 ? summary.creditAppliedCents : 0;
  const cashPaidCents = summary?.sameMonthAppliedCents > 0 ? summary.sameMonthAppliedCents : 0;
  const discountAppliedCents = summary?.discountAppliedCents > 0 ? summary.discountAppliedCents : 0;
  const allocationBalanceCents = typeof summary?.balanceDueCents === 'number' ? summary.balanceDueCents : null;

  // Waivers, clamped in allocation-engine order so the displayed
  // deduction can never exceed the bill it settles.
  let remainingCents = Math.round(due * 100) + lateFeeCents + shiftingFeeCents;
  const clampWaiver = (value) => {
    const taken = Math.min(centsOf(value), remainingCents);
    remainingCents -= taken;
    return taken;
  };
  const depositOffsetCents = clampWaiver(bill.depositOffsetAmount);
  const creditTransferInCents = clampWaiver(bill.creditTransferInAmount);
  const badDebtWriteOffCents = clampWaiver(bill.badDebtWriteOffAmount);
  const referralCreditCents = clampWaiver(bill.referralCreditAmount);
  const concessionCents = clampWaiver(bill.concessionAmount);
  const feederHostCreditCents = clampWaiver(bill.feederHostCreditAmount);
  const otherCreditsCents = referralCreditCents + feederHostCreditCents
    + creditTransferInCents + badDebtWriteOffCents;

  const grossCents = packageCents + kistCents + lateFeeCents + shiftingFeeCents + previousArrearsCents;
  const deductionsCents = concessionCents + depositOffsetCents + otherCreditsCents
    + advanceConsumedCents + cashPaidCents + discountAppliedCents;
  const netCents = Math.max(0, grossCents - deductionsCents);
  const reconcilesToAllocation = allocationBalanceCents === null
    ? null
    : netCents === previousArrearsCents + allocationBalanceCents;

  const line = (key, amountCents, role) => ({
    key, label: BILL_CLARITY_LABELS[key], amount: rupeesOf(amountCents), role
  });
  const lines = [
    line('package', packageCents, 'charge'),
    ...(kistCents > 0 ? [line('kist', kistCents, 'charge')] : []),
    ...(lateFeeCents > 0 ? [line('lateFee', lateFeeCents, 'charge')] : []),
    ...(shiftingFeeCents > 0 ? [line('shiftingFee', shiftingFeeCents, 'charge')] : []),
    ...(previousArrearsCents > 0 ? [line('previousArrears', previousArrearsCents, 'charge')] : []),
    line('grossTotal', grossCents, 'total'),
    ...(concessionCents > 0 ? [line('concession', concessionCents, 'deduction')] : []),
    ...(depositOffsetCents > 0 ? [line('depositOffset', depositOffsetCents, 'deduction')] : []),
    ...(referralCreditCents > 0 ? [line('referralCredit', referralCreditCents, 'deduction')] : []),
    ...(feederHostCreditCents > 0 ? [line('feederHostCredit', feederHostCreditCents, 'deduction')] : []),
    ...(creditTransferInCents > 0 ? [line('creditTransferIn', creditTransferInCents, 'deduction')] : []),
    ...(badDebtWriteOffCents > 0 ? [line('badDebtWriteOff', badDebtWriteOffCents, 'deduction')] : []),
    ...(advanceConsumedCents > 0 ? [line('advanceConsumed', advanceConsumedCents, 'deduction')] : []),
    ...(cashPaidCents > 0 ? [line('cashPaid', cashPaidCents, 'deduction')] : []),
    ...(discountAppliedCents > 0 ? [line('discountApplied', discountAppliedCents, 'deduction')] : []),
    line('netBalance', netCents, 'net')
  ];

  return {
    month: bill.month,
    packageAmount: rupeesOf(packageCents),
    kistAmount: rupeesOf(kistCents),
    lateFeeAmount: rupeesOf(lateFeeCents),
    shiftingFeeAmount: rupeesOf(shiftingFeeCents),
    previousArrears: rupeesOf(previousArrearsCents),
    grossTotal: rupeesOf(grossCents),
    concessionAmount: rupeesOf(concessionCents),
    concessionReason: typeof bill.concessionReason === 'string' ? bill.concessionReason : '',
    depositOffsetAmount: rupeesOf(depositOffsetCents),
    depositOffsetReason: typeof bill.depositOffsetReason === 'string' ? bill.depositOffsetReason : '',
    referralCreditAmount: rupeesOf(referralCreditCents),
    feederHostCreditAmount: rupeesOf(feederHostCreditCents),
    creditTransferInAmount: rupeesOf(creditTransferInCents),
    badDebtWriteOffAmount: rupeesOf(badDebtWriteOffCents),
    otherCreditsAmount: rupeesOf(otherCreditsCents),
    advanceConsumed: rupeesOf(advanceConsumedCents),
    cashPaid: rupeesOf(cashPaidCents),
    discountApplied: rupeesOf(discountAppliedCents),
    deductionsTotal: rupeesOf(deductionsCents),
    netBalance: rupeesOf(netCents),
    allocationBalance: allocationBalanceCents === null ? null : rupeesOf(allocationBalanceCents),
    reconcilesToAllocation,
    lines
  };
}

/** Plain-text breakdown lines, in the house receipt style. */
export function billClarityTextLines(breakdown) {
  if (!breakdown) return [];
  return breakdown.lines.map((entry) => {
    if (entry.role === 'total') return `Kul Qabil-e-Ada (Total Due): ${formatPKR(entry.amount)}`;
    if (entry.role === 'net') return `Baqi Rehta (Balance): ${formatPKR(entry.amount)}`;
    if (entry.role === 'deduction') return `${entry.label}: -${formatPKR(entry.amount)}`;
    return `${entry.label}: ${formatPKR(entry.amount)}`;
  });
}

/**
 * Per-bill breakdowns for a whole customer, newest month first, skipping
 * unpriced bills. The statement renderer consumes this list so the printed
 * statement carries exactly the same breakdown the profile shows.
 */
export function customerBillClarityBreakdowns(customer, allocations = null) {
  if (!customer) return [];
  const owned = allocations ?? calculatePaymentAllocations({ customers: [customer] });
  return [...(customer.bills ?? [])]
    .filter((bill) => bill && MONTH_RE.test(String(bill.month ?? '')))
    .sort((a, b) => String(b.month).localeCompare(String(a.month)))
    .map((bill) => billClarityBreakdown(customer, bill, owned))
    .filter((breakdown) => breakdown !== null);
}
