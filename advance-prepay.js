/**
 * advance-prepay.js — SISP-61: Customer Multi-Month Advance Prepay &
 * Discount Engine (the remainder of SISP-61; the month-targeting core
 * shipped earlier as PR #498).
 *
 * The offer: a customer pays several months up front — 2, 3, 6 or 12 —
 * and may be given an upfront discount for doing so. Example (the spec
 * pin): a Rs. 3,000 package prepaid for 3 months is Rs. 9,000 of
 * coverage; with a Rs. 500 discount the customer hands over Rs. 8,500
 * cash and is still credited the FULL Rs. 9,000, so the next three
 * monthly cycles clear to Rs. 0 net due.
 *
 * Mechanism — ONE targeted advance payment (built on the shipped
 * advance machinery, PR #488 + PR #498), never per-month slices:
 *   - the payment's `amount` is the CASH actually received (netPaid).
 *     That is the only figure any cash surface can ever show —
 *     receipts, Transactions, method totals, Roznamcha/P&L and the
 *     Advance Held card all read payment.amount, so the gross can
 *     never leak into a "collected" figure (CASH TRUTH);
 *   - the payment's `discount` is the upfront discount, labelled
 *     'Prepay discount', and the record carries its audited terms
 *     (prepayMonths / prepayGross / prepayRate, sanitized by
 *     validatePayment, read via core's prepayTermsOf);
 *   - the allocation engine converts a prepay's discount into
 *     RESERVED pending credit under the payment's targetMonth instead
 *     of applying it against the origin bill (where the ordinary
 *     discount rule would let the remainder vanish). Cash excess +
 *     discount therefore ride forward together as one reserved credit
 *     of exactly the gross, released at the start month by the PR #498
 *     remainder rule (COVERAGE TRUTH). Per-month slice records were
 *     rejected: the bill generator never prices an existing unpriced
 *     bill, so slices parked on future bills would never take effect,
 *     and a dozen slice receipts would corrupt every cash total.
 *   - voiding the payment (SISP-34) removes the whole record from the
 *     engine, so unused coverage and the discount reverse together —
 *     no orphan discount credit can survive a void.
 *
 * Coverage follows the CREDIT (money), not a promised month count:
 * if the package rate rises mid-prepay, the same credit covers fewer
 * months, and the Prepaid Until badge below — derived from the live
 * allocation engine plus the price schedule — shrinks to match what
 * the engine will actually do.
 */
import { calculatePaymentAllocations, monthsForHistory, prepayTermsOf, PREPAY_MONTH_OPTIONS } from './core.js';
import { recordAdvancePayment, defaultAdvanceTargetMonth } from './advance-payment.js';
import { applicablePriceForMonth } from './billing-cycle.js';

export { PREPAY_MONTH_OPTIONS };
export const PREPAY_DISCOUNT_REASON = 'Prepay discount';

const validMonthString = (value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value ?? ''));
const roundMoney = (value) => Math.round(Number(value) * 100) / 100;

function addMonths(month, count) {
  const [year, mon] = String(month).split('-').map(Number);
  const total = year * 12 + (mon - 1) + count;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/**
 * Price a prepay without recording anything: the rate is read from the
 * customer's real plan data (applicablePriceForMonth — the same source
 * the bill generator uses), never free-typed. Throws on any input the
 * recorder must refuse, so the dialog and the tests share one rule set.
 */
export function prepayQuote(customer, { months, startMonth, discount = 0 } = {}) {
  const monthCount = Number(months);
  if (!PREPAY_MONTH_OPTIONS.includes(monthCount)) throw new Error('Choose 2, 3, 6 or 12 months for a prepay.');
  if (!validMonthString(startMonth)) throw new Error('Choose the month the prepay starts from.');
  const rate = applicablePriceForMonth(customer, startMonth);
  if (rate === null) throw new Error('Set the package fee before recording a prepay.');
  const gross = roundMoney(rate * monthCount);
  const discountAmount = discount === undefined || discount === null || discount === '' ? 0 : Number(discount);
  if (!Number.isFinite(discountAmount) || discountAmount < 0) throw new Error('Discount cannot be negative.');
  if (discountAmount >= gross) throw new Error('Discount must be less than the total prepay amount.');
  const cleanDiscount = roundMoney(discountAmount);
  return {
    months: monthCount,
    startMonth,
    endMonth: addMonths(startMonth, monthCount - 1),
    rate,
    gross,
    discount: cleanDiscount,
    netPaid: roundMoney(gross - cleanDiscount)
  };
}

/**
 * Record a multi-month prepay as one targeted advance payment (see the
 * header for the bookkeeping). fields: { months, startMonth?, discount?,
 * date, method, paidBy?, note?, transactionId? } — date/method follow
 * the normal advance rules via recordAdvancePayment → addPayment.
 * Returns { nextState, payment, month, quote, prepaidUntil }.
 */
export function recordPrepay(state, customerId, fields = {}, referenceDate = new Date()) {
  const customer = (state?.customers ?? []).find((entry) => entry?.id === customerId);
  if (!customer) throw new Error('Customer not found.');
  if (customer.archived) throw new Error('Archived customers cannot record a prepay. Unarchive the customer first.');
  if (customer.isFreeConnection) throw new Error('FREE connections have no bill to prepay.');
  const currentMonth = monthsForHistory(referenceDate)[0];
  const startMonth = fields.startMonth || defaultAdvanceTargetMonth(referenceDate);
  if (!validMonthString(startMonth) || startMonth < currentMonth) throw new Error('Prepay must start from the current month or a later month.');
  const quote = prepayQuote(customer, { months: fields.months, startMonth, discount: fields.discount });
  const { nextState, payment, month } = recordAdvancePayment(state, customerId, {
    date: fields.date,
    amount: quote.netPaid,
    method: fields.method,
    paidBy: fields.paidBy,
    note: fields.note,
    transactionId: fields.transactionId,
    targetMonth: quote.startMonth,
    ...(quote.discount > 0 ? { discount: quote.discount, discountReason: PREPAY_DISCOUNT_REASON } : {}),
    prepayMonths: quote.months,
    prepayGross: quote.gross,
    prepayRate: quote.rate
  }, referenceDate);
  return { nextState, payment, month, quote, prepaidUntil: prepaidUntilMonth(nextState, customerId, referenceDate) };
}

/** Non-voided prepay records on the customer (voided ones are history). */
export function livePrepayRecords(state, customerId) {
  const customer = (state?.customers ?? []).find((entry) => entry?.id === customerId);
  if (!customer) return [];
  const records = [];
  for (const bill of customer.bills ?? []) {
    for (const payment of bill?.payments ?? []) {
      if (payment?.voided === true) continue;
      const terms = prepayTermsOf(payment);
      if (terms) records.push({ payment, terms, originMonth: bill.month });
    }
  }
  return records.sort((a, b) => a.terms.startMonth.localeCompare(b.terms.startMonth) || a.payment.date.localeCompare(b.payment.date));
}

/**
 * The last month the customer's advance coverage fully pays for —
 * derived from LIVE data only, never from the promised month count:
 * walk forward from the earliest live prepay's start month; a month
 * counts as covered when its priced bill's engine balance is Rs. 0, or
 * (for a month with no priced bill yet) when the still-unapplied
 * credit the engine reports — respecting each credit's month
 * reservation — can pay that month's scheduled package price in full.
 * The walk stops at the first month coverage cannot fully pay, and
 * the badge month is only returned while it is the current month or
 * later: a badge that outlives its coverage is a defect. Because the
 * walk spends the actual credit pool against actual prices, a
 * mid-prepay rate rise shrinks the result exactly as the engine will.
 */
export function prepaidUntilMonth(state, customerId, referenceDate = new Date()) {
  const customer = (state?.customers ?? []).find((entry) => entry?.id === customerId);
  if (!customer || customer.isFreeConnection) return null;
  const records = livePrepayRecords(state, customerId);
  if (records.length === 0) return null;
  const allocations = calculatePaymentAllocations(state);
  const billsByMonth = new Map((customer.bills ?? []).filter(Boolean).map((bill) => [bill.month, bill]));
  const pool = [...allocations.byPaymentId.values()]
    .filter((ledger) => ledger.customerId === customerId && ledger.unappliedCreditCents > 0)
    .map((ledger) => ({ remainingCents: ledger.unappliedCreditCents, targetMonth: ledger.targetMonth ?? null }));
  let until = null;
  let month = records[0].terms.startMonth;
  for (let step = 0; step < 25; step += 1) {
    const bill = billsByMonth.get(month);
    const summary = bill ? allocations.forMonth(customerId, month) : null;
    if (summary && summary.billAmountCents !== null) {
      if (summary.balanceDueCents === null || summary.balanceDueCents > 0) break;
      until = month;
    } else {
      const price = applicablePriceForMonth(customer, month);
      if (price === null) break;
      const priceCents = Math.round(price * 100);
      let need = priceCents;
      for (const entry of pool) {
        if (need <= 0) break;
        if (entry.targetMonth && entry.targetMonth > month) continue;
        const take = Math.min(entry.remainingCents, need);
        entry.remainingCents -= take;
        need -= take;
      }
      if (need > 0) break;
      until = month;
    }
    month = addMonths(month, 1);
  }
  const currentMonth = monthsForHistory(referenceDate)[0];
  return until !== null && until >= currentMonth ? until : null;
}
