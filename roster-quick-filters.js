/**
 * roster-quick-filters.js — SISP-136: 1-tap financial & status filter
 * pills for the main customer roster.
 *
 * A horizontal pill bar above the roster (All Active, 🔴 Unpaid This
 * Month, ⚠️ 2+ Months Arrears, 🤝 Active Waada, 🟢 Paid, 💎 Advance
 * Credit, ⏸️ Paused, 📦 Active Kist). Every pill's membership, count and
 * PKR total is derived in ONE pass from the app's real sources — never a
 * second balance computation:
 *
 *   - core.js calculatePaymentAllocations summaries (the caller passes
 *     the SAME allocations object the roster render already computed):
 *     per-bill billAmountCents / balanceDueCents / applied cents, and the
 *     byPaymentId ledgers' unappliedCreditCents.
 *   - SISP-3 waada state via waada-queue.js getWaadaTier (the tier
 *     helper's own semantics decide what a "live promise" is).
 *   - SISP-8 pause state via pause-billing.js isBillingPaused.
 *   - SISP-4 kist state via installment-plan.js buildKistProgress (the
 *     profile progress-bar helper, fed the same allocations).
 *
 * Pill definitions (month = the roster's selected billing month):
 *   all     — every non-archived customer. Count only.
 *   unpaid  — the month's bill is priced and balanceDue > 0 while the
 *             engine applied NOTHING toward it (same-month receipts +
 *             carried credit + discounts == 0). A partial payer is NOT
 *             unpaid. Total = Σ the month's balanceDue.
 *   paid    — the month's bill is priced and balanceDue == 0 (settled by
 *             cash, credit, discounts or bill waiver/offset stamps,
 *             exactly as the engine derives). Total = Σ settled amount
 *             (billAmount − balanceDue = the full bill for members).
 *   arrears — balanceDue > 0 on bills from ≥ 2 distinct billed months.
 *             Total = Σ total outstanding balance across all months.
 *   waada   — getWaadaTier(...) === 'promised': a promise is recorded,
 *             the customer still owes money, and the promise date has
 *             not passed. Broken promises and promises on a settled
 *             ledger (tier null) are NOT active waada. Total = Σ the
 *             recorded promiseAmount (0 when none was recorded).
 *   credit  — the engine still holds unapplied credit for the customer
 *             (Σ byPaymentId unappliedCreditCents > 0). Total = that Σ.
 *   paused  — isBillingPaused(customer, month). Count only.
 *   kist    — an active installment plan with remaining due > 0 per
 *             buildKistProgress. Total = Σ remaining kist due.
 *
 * FREE customers carry no bills, so they fall out of every money pill
 * naturally and count only in All Active.
 *
 * This module is PURE: it reads records and returns models. It writes
 * nothing, mutates nothing, and adds no storage keys. The summary is
 * rebuilt on every roster render, so a payment recorded in Quick
 * Collect moves the pills on the next render — no cached counters.
 */
import { getWaadaTier, getWaadaTodayString, WAADA_TIERS } from './waada-queue.js';
import { isBillingPaused } from './pause-billing.js';
import { buildKistProgress } from './installment-plan.js';

export const ROSTER_PILL_IDS = Object.freeze(['all', 'unpaid', 'arrears', 'waada', 'paid', 'credit', 'paused', 'kist']);

/** Rendering metadata for the bar: label keys live in nav-language.js. */
export const ROSTER_PILL_DEFS = Object.freeze([
  { id: 'all', emoji: '', labelKey: 'cust_pill_all', hasTotal: false },
  { id: 'unpaid', emoji: '🔴', labelKey: 'cust_pill_unpaid', hasTotal: true },
  { id: 'arrears', emoji: '⚠️', labelKey: 'cust_pill_arrears', hasTotal: true },
  { id: 'waada', emoji: '🤝', labelKey: 'cust_pill_waada', hasTotal: true },
  { id: 'paid', emoji: '🟢', labelKey: 'cust_pill_paid', hasTotal: true },
  { id: 'credit', emoji: '💎', labelKey: 'cust_pill_credit', hasTotal: true },
  { id: 'paused', emoji: '⏸️', labelKey: 'cust_pill_paused', hasTotal: false },
  { id: 'kist', emoji: '📦', labelKey: 'cust_pill_kist', hasTotal: true }
]);

/** Unknown or blank pill ids fall back to the unfiltered roster: 'all'. */
export function normalizeRosterPill(pillId) {
  const id = String(pillId ?? '').trim().toLowerCase();
  return ROSTER_PILL_IDS.includes(id) ? id : 'all';
}

const centsOf = (value) => Math.round(Number(value || 0) * 100);

/**
 * One engine pass over a customer list (the roster's currently filtered
 * ACTIVE pool — archived records are skipped even if handed in, because
 * every pill describes the active roster).
 *
 * @param {Array} customers candidate customers (archived are ignored)
 * @param {object} allocations result of core.calculatePaymentAllocations
 * @param {{month?: string, todayStr?: string}} options month = the
 *   roster's selected billing month ('YYYY-MM'); todayStr = PKT today
 *   ('YYYY-MM-DD') for the waada tier, injectable for tests.
 * @returns {{month: string|null, pills: Object<string, {count: number,
 *   totalCents: number|null, memberIds: Set<string>}>}}
 */
export function buildRosterPillSummary(customers, allocations, { month = null, todayStr = null } = {}) {
  const pills = {};
  for (const def of ROSTER_PILL_DEFS) {
    pills[def.id] = { count: 0, totalCents: def.hasTotal ? 0 : null, memberIds: new Set() };
  }
  const summary = { month: month ?? null, pills };
  const list = Array.isArray(customers) ? customers : [];
  if (!allocations || typeof allocations.forMonth !== 'function') return summary;
  const today = todayStr ?? getWaadaTodayString();

  const add = (pillId, customerId, totalCents = 0) => {
    const pill = pills[pillId];
    if (pill.memberIds.has(customerId)) return;
    pill.memberIds.add(customerId);
    pill.count += 1;
    if (pill.totalCents !== null) pill.totalCents += totalCents;
  };

  // Unapplied credit per customer, from the engine's own payment
  // ledgers — the same source buildMonthlyReport reads for creditPending.
  const creditByCustomer = new Map();
  if (allocations.byPaymentId instanceof Map) {
    for (const ledger of allocations.byPaymentId.values()) {
      if (ledger && ledger.unappliedCreditCents > 0) {
        creditByCustomer.set(ledger.customerId, (creditByCustomer.get(ledger.customerId) ?? 0) + ledger.unappliedCreditCents);
      }
    }
  }

  for (const customer of list) {
    if (!customer || customer.archived) continue;
    add('all', customer.id);

    let totalOutstandingCents = 0;
    let dueMonthCount = 0;
    for (const bill of Array.isArray(customer.bills) ? customer.bills : []) {
      const billSummary = bill ? allocations.forMonth(customer.id, bill.month) : null;
      // Unpriced bills carry balanceDueCents === null — nothing is owed
      // on them yet, so they can never make a month "due".
      if (!billSummary || billSummary.balanceDueCents === null || billSummary.balanceDueCents === undefined) continue;
      if (billSummary.balanceDueCents > 0) {
        totalOutstandingCents += billSummary.balanceDueCents;
        dueMonthCount += 1;
      }
    }

    const monthSummary = month ? allocations.forMonth(customer.id, month) : null;
    if (monthSummary && monthSummary.billAmountCents !== null && monthSummary.billAmountCents !== undefined) {
      // "Paid toward this bill" = what the engine applied to it:
      // same-month receipts + carried-forward credit + discounts. A
      // ticket-charge portion of a receipt is not bill money (SISP-43)
      // and deposit-offset stamps are not payments, so neither counts.
      const appliedCents = (monthSummary.sameMonthAppliedCents ?? 0)
        + (monthSummary.creditAppliedCents ?? 0)
        + (monthSummary.discountAppliedCents ?? 0);
      if (monthSummary.balanceDueCents > 0 && appliedCents === 0) {
        add('unpaid', customer.id, monthSummary.balanceDueCents);
      }
      if (monthSummary.balanceDueCents === 0) {
        add('paid', customer.id, monthSummary.billAmountCents - monthSummary.balanceDueCents);
      }
    }

    if (dueMonthCount >= 2) add('arrears', customer.id, totalOutstandingCents);

    // SISP-3: the tier helper gets the customer's total outstanding
    // balance in PKR, exactly as tierWaadaQueue supplies it. Only the
    // 'promised' tier is a live waada: 'broken' has lapsed, null means
    // nothing is owed (settled/cleared), 'active' means no promise.
    if (getWaadaTier(customer, totalOutstandingCents / 100, today) === WAADA_TIERS.PROMISED) {
      const promised = Number(customer.promiseAmount);
      add('waada', customer.id, Number.isFinite(promised) && promised > 0 ? centsOf(promised) : 0);
    }

    const creditCents = creditByCustomer.get(customer.id) ?? 0;
    if (creditCents > 0) add('credit', customer.id, creditCents);

    if (month && isBillingPaused(customer, month)) add('paused', customer.id);

    const kistRemainingCents = buildKistProgress(customer, allocations).plans
      .filter((plan) => plan.status === 'active' && plan.remainingAmount > 0)
      .reduce((sum, plan) => sum + centsOf(plan.remainingAmount), 0);
    if (kistRemainingCents > 0) add('kist', customer.id, kistRemainingCents);
  }
  return summary;
}

/** Member id set for one pill (empty set for an unknown pill/summary). */
export function rosterPillMemberIds(summary, pillId) {
  const pill = summary?.pills?.[normalizeRosterPill(pillId)];
  return pill?.memberIds instanceof Set ? pill.memberIds : new Set();
}

/**
 * Narrow a customer list to one pill's members. 'all' returns the list
 * unchanged (a copy). Order is preserved; the input is never mutated.
 */
export function applyRosterPillFilter(customers, summary, pillId) {
  const list = Array.isArray(customers) ? customers : [];
  if (normalizeRosterPill(pillId) === 'all') return list.slice();
  const memberIds = rosterPillMemberIds(summary, pillId);
  return list.filter((customer) => customer && memberIds.has(customer.id));
}
