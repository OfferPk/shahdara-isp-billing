/**
 * revenue-stream-breakdown.js — SISP-164: 4-Stream Monthly Collection
 * Breakdown (ماہانہ آمدنی کی 4 اقسام).
 *
 * Partitions one month's collected PKR into:
 *   (1) Current Month Package Bills
 *   (2) Recovered Prior-Month Arrears
 *   (3) Hardware Kist Installments
 *   (4) New Connection / Shifting Fees
 *   (+) Other — ticket charges, late fees & advance credit (the
 *       remainder the four named streams honestly do not cover)
 * so that streams 1–4 + Other == the month's total EXACTLY (integer
 * cents). The partition base is "collections + recorded connection
 * fees": non-voided payment amounts dated in the month, plus the
 * connection fees recorded on customer records whose join month is
 * the month (connection fees are their own records in this app, not
 * payments — see installation-cost.js / core.js customerJoinMonth).
 *
 * SOURCES OF TRUTH (never a re-derived FIFO):
 *   - The ticket-charge portion of a payment comes from the core
 *     engine's per-payment ledger (calculatePaymentAllocations →
 *     byPaymentId → ticketChargeCents).
 *   - The arrears / package / kist attribution of the rest comes from
 *     the shipped FIFO attribution (billing-cycle.js
 *     fifoAllocationForPayment — the same split receipts print).
 *     That helper does NOT skip voided payments on its own, while the
 *     core engine excludes them from its ledger; the FIFO helper is
 *     therefore fed the engine's non-voided view of each bill, so both
 *     views see the same payment set.
 *   - Shifting fees ride inside bills as bill.shiftingFee
 *     (relocation-log.js stamps them onto a bill). FIFO buckets do not
 *     model them, so the cash a payment leaves beyond its FIFO
 *     buckets first covers the origin bill's still-uncovered shifting
 *     fee (payments in the bill's array order — the FIFO order) and
 *     only the excess after that falls into Other.
 *
 * RULES (pinned by tests/revenue-stream-breakdown.test.js):
 *   1. A collection belongs to the month of its payment DATE (the
 *      P&L income convention in dashboard-pnl.js).
 *   2. Voided payments (SISP-34) contribute NOTHING anywhere: the core
 *      ledger omits them and the FIFO view filters them out.
 *   3. Discounts are not cash. FIFO attributes a payment's
 *      amount + discount across the buckets; the partition walks the
 *      buckets in FIFO fill order (arrears, then package/kist per the
 *      payment's own Prioritize-Kist toggle) assigning CASH first, so
 *      bucket room the discount occupies never enters a stream.
 *   4. Bucket → stream: arrears bucket → stream 2 (it always covers
 *      bills earlier than the origin bill); kist bucket → stream 3;
 *      package bucket → stream 1, or stream 2 when the origin bill's
 *      month is earlier than the collection month (a prior month's
 *      bill settled late). Cash left beyond every FIFO bucket covers
 *      the origin bill's shifting fee (→ stream 4) and then falls to
 *      Other (late fees and advance/unapplied credit live there —
 *      including excess the core engine carries forward to later
 *      bills, which at collection time was advance credit).
 *   5. FIFO buckets are gross of bill-level waiver offsets (deposit /
 *      referral / concession / feeder-host credits): where such an
 *      offset settles part of a bill, the partition still attributes
 *      the collected cash to the buckets it was collected against,
 *      exactly as the receipt's FIFO split does. The ledger offers no
 *      finer per-bucket split for offsets.
 *   6. A shifting fee left unpaid into later months is recovered
 *      through the arrears bucket thereafter (arrearsAndAdvance folds
 *      earlier bills' whole balances, fee included, into one figure)
 *      — it counts as stream 2 then, not stream 4.
 *
 * This module is a PURE builder: it reads state and writes nothing.
 * Tests use synthetic data only.
 */

import { calculatePaymentAllocations, customerJoinMonth, formatPKR } from './core.js';
import { fifoAllocationForPayment } from './billing-cycle.js';
import { t } from './nav-language.js';

const centsOf = (value) => Math.round(Number(value || 0) * 100);
const rupeesOf = (cents) => cents / 100;

function emptyStreams() {
  return { currentCents: 0, arrearsCents: 0, kistCents: 0, shiftingCents: 0, connectionCents: 0, otherCents: 0 };
}

/**
 * Split ONE non-voided payment's cash across the streams.
 * `shiftingLeftCents` is the origin bill's shifting fee not yet covered
 * by earlier payments on that bill; the returned `shiftingCents` is the
 * part of THIS payment that covers it.
 * Returns integer cents per bucket; the parts always sum to the
 * payment's cash amount.
 */
function splitPaymentCash({ customerView, billView, payment, ledger, month, shiftingLeftCents }) {
  const cashCents = centsOf(payment.amount);
  const ticketCents = ledger ? Number(ledger.ticketChargeCents || 0) : 0;
  const billCashCents = Math.max(0, cashCents - ticketCents);
  const parts = { currentCents: 0, arrearsCents: 0, kistCents: 0, shiftingCents: 0, otherCents: ticketCents };

  let attributedCents = 0;
  const fifo = fifoAllocationForPayment(customerView, billView, payment.id);
  if (fifo?.allocation) {
    const buckets = {
      arrears: centsOf(fifo.allocation.toArrears),
      package: centsOf(fifo.allocation.toPackage),
      kist: centsOf(fifo.allocation.toKist)
    };
    // FIFO fill order: arrears first; the payment's own toggle swaps
    // package and kist. Cash occupies the buckets first (rule 3).
    const order = fifo.allocation.prioritizeKistFirst === true
      ? ['arrears', 'kist', 'package']
      : ['arrears', 'package', 'kist'];
    let remainingCash = billCashCents;
    const cashBucket = { arrears: 0, package: 0, kist: 0 };
    for (const key of order) {
      const take = Math.min(Math.max(0, buckets[key]), remainingCash);
      cashBucket[key] = take;
      remainingCash -= take;
    }
    attributedCents = billCashCents - remainingCash;
    parts.arrearsCents += cashBucket.arrears;
    parts.kistCents += cashBucket.kist;
    if (billView.month < month) parts.arrearsCents += cashBucket.package;
    else parts.currentCents += cashBucket.package;
  }

  // Cash beyond every FIFO bucket: shifting fee first, then Other.
  const leftoverCents = billCashCents - attributedCents;
  if (leftoverCents > 0) {
    const shiftingTake = Math.min(leftoverCents, Math.max(0, shiftingLeftCents));
    parts.shiftingCents += shiftingTake;
    parts.otherCents += leftoverCents - shiftingTake;
  }
  return parts;
}

const sharePct = (partCents, totalCents) => (totalCents > 0 ? Math.round((partCents / totalCents) * 1000) / 10 : 0);

/**
 * The 4-stream breakdown for one month ('YYYY-MM').
 * Pure: state is read, never mutated.
 */
export function buildRevenueStreamBreakdown(state, month) {
  const totals = emptyStreams();
  let paymentCount = 0;
  const customers = Array.isArray(state?.customers) ? state.customers : [];

  // Stream 4 (recorded fees): connection fees are customer records,
  // not payments — they join the partition in the customer's join
  // month, and the partition base grows by the same amount.
  for (const customer of customers) {
    const fee = Number(customer?.connectionFee);
    if (Number.isFinite(fee) && fee > 0 && customerJoinMonth(customer) === month) {
      totals.connectionCents += centsOf(fee);
    }
  }

  const allocations = calculatePaymentAllocations(state ?? { customers: [] });

  for (const customer of customers) {
    const bills = Array.isArray(customer?.bills) ? customer.bills : [];
    if (!bills.length) continue;
    // The engine's non-voided view of this customer (rule 2).
    const liveBills = bills.map((bill) => ({
      ...bill,
      payments: (Array.isArray(bill?.payments) ? bill.payments : []).filter((payment) => payment && payment.voided !== true)
    }));
    const customerView = { ...customer, bills: liveBills };
    for (const bill of liveBills) {
      if (!bill.payments.length) continue;
      // An unpriced bill carries no attributable shifting fee in the
      // engine (its summary reports none) — its cash is all credit.
      const priced = Number.isFinite(Number(bill.dueAmount)) && Number(bill.dueAmount) > 0;
      let shiftingLeftCents = priced ? centsOf(bill.shiftingFee || 0) : 0;
      for (const payment of bill.payments) {
        const ledger = allocations.byPaymentId.get(payment.id) ?? null;
        const parts = splitPaymentCash({ customerView, billView: bill, payment, ledger, month, shiftingLeftCents });
        shiftingLeftCents -= parts.shiftingCents;
        if (typeof payment.date === 'string' && payment.date.slice(0, 7) === month) {
          totals.currentCents += parts.currentCents;
          totals.arrearsCents += parts.arrearsCents;
          totals.kistCents += parts.kistCents;
          totals.shiftingCents += parts.shiftingCents;
          totals.otherCents += parts.otherCents;
          paymentCount += 1;
        }
      }
    }
  }

  const feesCents = totals.shiftingCents + totals.connectionCents;
  const collectionsCents = totals.currentCents + totals.arrearsCents + totals.kistCents + totals.shiftingCents + totals.otherCents;
  const totalCents = collectionsCents + totals.connectionCents;
  return {
    month,
    currentCents: totals.currentCents,
    arrearsCents: totals.arrearsCents,
    kistCents: totals.kistCents,
    feesCents,
    shiftingCents: totals.shiftingCents,
    connectionCents: totals.connectionCents,
    otherCents: totals.otherCents,
    collectionsCents,
    totalCents,
    paymentCount,
    shares: {
      current: sharePct(totals.currentCents, totalCents),
      arrears: sharePct(totals.arrearsCents, totalCents),
      kist: sharePct(totals.kistCents, totalCents),
      fees: sharePct(feesCents, totalCents),
      other: sharePct(totals.otherCents, totalCents)
    }
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * Card HTML for the P&L modal: one row per stream (+ Other + Total),
 * each with PKR and its % share of the month total. Shares are rounded
 * independently to 1 decimal, so they may sum to 99.9–100.1.
 */
export function revenueStreamCardHtml(state, month, lang = null) {
  const data = buildRevenueStreamBreakdown(state, month);
  const rows = [
    { key: 'current', label: t('revstream_current', lang), cents: data.currentCents, share: data.shares.current },
    { key: 'arrears', label: t('revstream_arrears', lang), cents: data.arrearsCents, share: data.shares.arrears },
    { key: 'kist', label: t('revstream_kist', lang), cents: data.kistCents, share: data.shares.kist },
    { key: 'fees', label: t('revstream_fees', lang), cents: data.feesCents, share: data.shares.fees },
    { key: 'other', label: t('revstream_other', lang), cents: data.otherCents, share: data.shares.other }
  ];
  const rowHtml = rows.map((row) => `
      <div class="revstream-row">
        <span class="revstream-label">${escapeHtml(row.label)}</span>
        <span class="revstream-figures"><strong>${escapeHtml(formatPKR(rupeesOf(row.cents)))}</strong><span class="revstream-share">${row.share.toFixed(1)}%</span></span>
      </div>`).join('');
  return `
  <section class="revstream-card" aria-label="${escapeHtml(t('revstream_title', lang))}">
    <h4 class="revstream-title">${escapeHtml(t('revstream_title', lang))}</h4>
    ${rowHtml}
    <div class="revstream-row revstream-total">
      <span class="revstream-label">${escapeHtml(t('revstream_total', lang))}</span>
      <span class="revstream-figures"><strong>${escapeHtml(formatPKR(rupeesOf(data.totalCents)))}</strong></span>
    </div>
  </section>`;
}
