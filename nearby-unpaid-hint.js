/**
 * nearby-unpaid-hint.js — SISP-168: Same-Pole / Same-Splitter Nearby
 * Unpaid Neighbor Prompt in Field Mode.
 *
 * The moment a field collection is recorded, the collector is usually
 * still standing on the same stop: the same pole, the same splitter box
 * (DB-XX), or the same daisy chain often feeds two or three more houses.
 * This module answers ONE question, purely from recorded data: which
 * OTHER active subscribers near the just-paid customer still owe money,
 * so the collector can knock on those doors before moving on?
 *
 * Pure builder, DOM-free, read-only: buildNearbyUnpaidHints() derives
 * everything from the state it is given (the caller passes the
 * POST-payment state) and mutates nothing — the hints are session
 * display state in Field Mode, never persisted anywhere.
 *
 * Money truth: a candidate's dues are the allocation engine's own
 * figures — the sum of positive per-month balanceDueCents from
 * calculatePaymentAllocations(), exactly the math Field Mode's pending
 * list (getPendingCollectionCustomers) and fieldModeCustomerStatus()
 * use. No parallel dues math exists here. FREE connections carry no
 * priced bills, so their engine dues are 0 and they fall out naturally.
 *
 * Relations (compared against the JUST-PAID customer's recorded
 * fields):
 *   pole     — same non-empty poleNumber (the SISP-32 free-text pole /
 *              landmark field; trimmed, exact match after trim, the
 *              same discipline splitter-map.js applies to box ids).
 *   chain    — the candidate shares the paid customer's
 *              upstreamCustomerId chain: same upstream (siblings), the
 *              candidate is upstream or downstream of the paid
 *              customer, or both share an ancestor (incl. the same
 *              root). Downstream is walked with outage-impact.js's own
 *              traceDownstreamImpact() — never a forked traversal;
 *              outage-impact.js exports no upward walker, so ancestors
 *              are collected here with the same visited-set cycle
 *              guard traceDownstreamImpact / validateUpstreamLink use:
 *              a pre-existing upstream cycle stops the walk, never
 *              loops.
 *   splitter — same non-empty splitterBoxId.
 *
 * Ranking (spec): tier pole > chain > splitter; within a tier, dues
 * descending, then customerNumber ascending. A candidate matching
 * several tiers appears ONCE, at its best tier. At most 3 hints.
 *
 * Eligibility: active (not archived), engine dues > 0, and not
 * billing-paused for the current month per pause-billing.js's
 * isBillingPaused() — the SISP-8 month-pause helper, which covers the
 * paused window [pauseStartDate month, autoResumeDate month) AND any
 * month listed in pauseSkippedMonths (the resume flow stamps skipped
 * months there), so a house on a vacation hold is never hinted. The
 * just-paid customer is always excluded, even with a remainder due —
 * he was just served.
 */

import { calculatePaymentAllocations, monthsForHistory } from './core.js';
import { isBillingPaused } from './pause-billing.js';
import { traceDownstreamImpact } from './outage-impact.js';

/** Spec cap: at most 3 neighbour hints after one collection. */
export const NEARBY_HINT_LIMIT = 3;

const TIER_ORDER = { pole: 0, chain: 1, splitter: 2 };

const cleanText = (value) => String(value ?? '').trim();

/**
 * Every ancestor id above `customer` (its upstream, that house's
 * upstream, …), cycle-safe: the walk stops at an empty/dangling link
 * or when an id repeats (a pre-existing feeder cycle in recorded
 * data). The dangling id itself is included — two siblings whose
 * shared upstream record is missing still share that id.
 */
function ancestorIdsOf(byId, customer) {
  const ancestors = new Set();
  const visited = new Set([String(customer.id)]);
  let current = customer;
  while (current) {
    const upstreamId = cleanText(current.upstreamCustomerId);
    if (upstreamId === '') break;
    if (visited.has(upstreamId)) break;
    visited.add(upstreamId);
    ancestors.add(upstreamId);
    current = byId.get(upstreamId) ?? null;
  }
  return ancestors;
}

/**
 * The Field Mode lists' own dues figure for one customer: the sum of
 * the allocation engine's positive per-month balances (unpriced bills
 * carry a null balance and contribute nothing — the same rule
 * getPendingCollectionCustomers applies).
 */
function totalOutstandingCents(customer, allocations) {
  let total = 0;
  for (const bill of customer?.bills ?? []) {
    const balance = allocations.forMonth(customer.id, bill.month)?.balanceDueCents;
    if (typeof balance === 'number' && balance > 0) total += balance;
  }
  return total;
}

/**
 * Up to NEARBY_HINT_LIMIT unpaid neighbours of the just-paid customer.
 *
 * @param {object} state - ledger state AFTER the collection was
 *   recorded, so dues already reflect the payment.
 * @param {string} paidCustomerId - the customer who just paid.
 * @param {object} [allocations] - a calculatePaymentAllocations(state)
 *   result to share; computed here when omitted.
 * @param {Date} [referenceDate] - "today" for the current-month pause
 *   check (injectable for tests, the house pattern).
 * @returns {Array<{customerId, name, customerNumber, duesCents,
 *   relation: 'pole'|'chain'|'splitter', relationLabel: string}>}
 *   relationLabel is the shared key as recorded: the pole text for
 *   'pole', the box id for 'splitter', and the shared ancestor's
 *   customerNumber for 'chain' when that record exists ('' otherwise).
 */
export function buildNearbyUnpaidHints(state, paidCustomerId, allocations = null, referenceDate = new Date()) {
  const customers = state?.customers ?? [];
  const paid = customers.find((c) => String(c.id) === String(paidCustomerId));
  if (!paid) return [];
  const allocs = allocations ?? calculatePaymentAllocations(state);
  const currentMonth = monthsForHistory(referenceDate)[0];
  const byId = new Map(customers.map((c) => [String(c.id), c]));

  const paidPole = cleanText(paid.poleNumber);
  const paidBox = cleanText(paid.splitterBoxId);
  const paidUpstream = cleanText(paid.upstreamCustomerId);
  const paidAncestors = ancestorIdsOf(byId, paid);
  const paidDownstreamIds = new Set(
    traceDownstreamImpact(customers, paid.id).map((c) => String(c.id))
  );

  const hints = [];
  for (const candidate of customers) {
    if (String(candidate.id) === String(paid.id)) continue;
    if (candidate.archived) continue;

    let relation = null;
    let relationLabel = '';
    if (paidPole !== '' && cleanText(candidate.poleNumber) === paidPole) {
      relation = 'pole';
      relationLabel = paidPole;
    } else if (paidBox !== '' && cleanText(candidate.splitterBoxId) === paidBox) {
      relation = 'splitter';
      relationLabel = paidBox;
    }
    // A candidate can match several tiers; it is reported ONCE at its
    // BEST tier (pole > chain > splitter), so the chain check below
    // may still upgrade a splitter match — never the reverse.
    // Chain relation: sibling (same upstream id), candidate upstream
    // of the paid house, candidate downstream of it (walked by
    // traceDownstreamImpact), or a shared ancestor (incl. same root).
    const candidateId = String(candidate.id);
    const candidateUpstream = cleanText(candidate.upstreamCustomerId);
    let chainLabel = '';
    let chainRelated = false;
    if (paidUpstream !== '' && candidateUpstream === paidUpstream) {
      chainRelated = true;
      chainLabel = byId.get(paidUpstream)?.customerNumber ?? '';
    } else if (paidAncestors.has(candidateId)) {
      chainRelated = true;
      chainLabel = candidate.customerNumber ?? '';
    } else if (paidDownstreamIds.has(candidateId)) {
      chainRelated = true;
      chainLabel = paid.customerNumber ?? '';
    } else {
      const candidateAncestors = ancestorIdsOf(byId, candidate);
      for (const ancestorId of candidateAncestors) {
        if (paidAncestors.has(ancestorId)) {
          chainRelated = true;
          chainLabel = byId.get(ancestorId)?.customerNumber ?? '';
          break;
        }
      }
    }
    if (chainRelated && (relation === null || TIER_ORDER.chain < TIER_ORDER[relation])) {
      relation = 'chain';
      relationLabel = chainLabel;
    }
    if (relation === null) continue;

    const duesCents = totalOutstandingCents(candidate, allocs);
    if (!(duesCents > 0)) continue;
    if (isBillingPaused(candidate, currentMonth)) continue;

    hints.push({
      customerId: candidate.id,
      name: candidate.name,
      customerNumber: candidate.customerNumber,
      duesCents,
      relation,
      relationLabel: String(relationLabel ?? '')
    });
  }

  hints.sort((a, b) => {
    const tierDiff = TIER_ORDER[a.relation] - TIER_ORDER[b.relation];
    if (tierDiff !== 0) return tierDiff;
    if (b.duesCents !== a.duesCents) return b.duesCents - a.duesCents;
    const numA = Number(a.customerNumber);
    const numB = Number(b.customerNumber);
    if (Number.isFinite(numA) && Number.isFinite(numB)) return numA - numB;
    return String(a.customerNumber ?? '').localeCompare(String(b.customerNumber ?? ''));
  });
  return hints.slice(0, NEARBY_HINT_LIMIT);
}
