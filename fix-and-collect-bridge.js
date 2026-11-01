/**
 * fix-and-collect-bridge.js — SISP-163: [🔧💰 Fix & Collect] badge on open
 * complaints for unpaid customers, a combined Resolve + Collect flow, and
 * automated-reminder suppression while a service fault is open.
 *
 * The field reality: a lineman is at the customer's door fixing their line
 * while the same customer still owes the month's bill. This module connects
 * the two facts the app already records — the complaint ledgers
 * (complaint-register.js CMP-* entries and complaint-tickets.js TKT-*
 * field tickets) and the billing engine's outstanding figure — without
 * inventing any new money math:
 *
 * - DUE FIGURE: fixCollectDuePkr derives a customer's total outstanding
 *   exactly the way dashboard-top-defaulters.js (the defaulter surface)
 *   does: Σ over the customer's bills of calculatePaymentAllocations'
 *   per-month balanceDueCents (with that surface's unpriced-bill fallback).
 *   FREE connections owe 0 by the owner's rule (they are never billed).
 *   Archived customers are derived like everyone else — an archived
 *   customer's open complaint with real dues still shows the truth.
 * - FAULT SET: a complaint suppresses reminders / counts as a "fix" only
 *   when it is a concrete SERVICE fault. From COMPLAINT_CATEGORIES, every
 *   category except the catch-all 'Other' names a real fault (fiber cut,
 *   charger off, splice loss, router config, CAT6, WAPDA power, main
 *   uplink) — there is no billing-dispute category in the register, and
 *   'Other' is deliberately unclassifiable, so it never suppresses.
 *   From TICKET_PRESETS, every preset is a service fault; a ticket with
 *   only a free-text customFault has no preset and is likewise
 *   unclassifiable, so it never suppresses.
 * - SUPPRESSION IS DERIVED, NEVER STORED: buildFaultSuppressedCustomerIds
 *   is rebuilt from the live ledgers on every call, so closing a ticket
 *   returns the customer to the Reminders Today queue on the next build
 *   with no flag to clear.
 * - THE FLOW: runResolveAndCollect sequences resolve → collect. The two
 *   acts are independent: the collect step's outcome (opened, skipped,
 *   unavailable, even throwing) can never un-resolve the complaint —
 *   there is deliberately no undo path in this helper.
 *
 * Pure helpers only (no storage, no DOM except the badge HTML string).
 * Imported by app.js and reminder-queue.js; NOT a build entry (the #219
 * dist budget stays at 25 bundled files).
 */

import { calculatePaymentAllocations, formatPKR } from './core.js';
import { AREA_OUTAGE_CUSTOMER_ID, COMPLAINT_CATEGORIES } from './complaint-register.js';
import { TICKET_PRESETS } from './complaint-tickets.js';
import { t } from './nav-language.js';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Register categories that are concrete service faults (all but 'Other'). */
export const FAULT_COMPLAINT_CATEGORIES = Object.freeze(
  COMPLAINT_CATEGORIES.filter((category) => category !== 'Other')
);

/** Ticket presets that are service faults (every shipped preset is one). */
export const FAULT_TICKET_PRESETS = Object.freeze([...TICKET_PRESETS]);

/** A complaint/ticket is "open" while Open or In Progress. */
export function isOpenComplaintStatus(status) {
  return status === 'Open' || status === 'In Progress';
}

/**
 * True when a register complaint is an OPEN service fault for a real
 * customer. Zone-wide AREA_OUTAGE entries have no single customer, so
 * they can never badge or suppress one customer's reminders.
 */
export function isFaultComplaint(complaint) {
  if (!complaint || !isOpenComplaintStatus(complaint.status)) return false;
  if (!complaint.customerId || String(complaint.customerId) === AREA_OUTAGE_CUSTOMER_ID) return false;
  return FAULT_COMPLAINT_CATEGORIES.includes(complaint.issueCategory);
}

/**
 * True when a field ticket is an OPEN service fault. Tickets whose fault
 * is only free text (customFault, no preset) are unclassifiable and
 * never count — the same honesty rule as the register's 'Other'.
 */
export function isFaultTicket(ticket) {
  if (!ticket || !isOpenComplaintStatus(ticket.status)) return false;
  if (!ticket.customerId) return false;
  return FAULT_TICKET_PRESETS.includes(ticket.faultPreset);
}

/**
 * The set of customer ids (as strings) with at least one open service
 * fault in either ledger. Derived fresh from the inputs; never stored.
 */
export function buildFaultSuppressedCustomerIds(complaints, tickets) {
  const ids = new Set();
  for (const complaint of Array.isArray(complaints) ? complaints : []) {
    if (isFaultComplaint(complaint)) ids.add(String(complaint.customerId));
  }
  for (const ticket of Array.isArray(tickets) ? tickets : []) {
    if (isFaultTicket(ticket)) ids.add(String(ticket.customerId));
  }
  return ids;
}

/** Convenience single-customer check over the same derived set. */
export function customerHasOpenFault(complaints, tickets, customerId) {
  if (customerId === null || customerId === undefined || customerId === '') return false;
  return buildFaultSuppressedCustomerIds(complaints, tickets).has(String(customerId));
}

/**
 * Total outstanding (PKR, whole rupees) for one customer, derived from
 * the payment-allocation engine exactly like the Top Defaulters surface:
 * per bill, the engine's balanceDueCents when priced, else the bill's
 * recorded due amount. FREE connections owe 0 (owner rule). Unknown
 * customers owe 0. Read-only: never mutates state.
 *
 * @param {Object} state - application state ({ customers: [...] })
 * @param {string|number} customerId
 * @param {Object} [allocations] - a precomputed calculatePaymentAllocations
 *   result, when the caller already has one (list renders).
 * @returns {number} PKR owed, >= 0
 */
export function fixCollectDuePkr(state, customerId, allocations = null) {
  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const customer = customers.find((c) => c && String(c.id) === String(customerId));
  if (!customer) return 0;
  if (customer.isFreeConnection) return 0;
  const alloc = allocations || calculatePaymentAllocations(state);
  let dueCents = 0;
  for (const bill of Array.isArray(customer.bills) ? customer.bills : []) {
    if (!bill) continue;
    const summary = alloc?.forMonth?.(customer.id, bill.month);
    const balanceDueCents = summary && summary.balanceDueCents !== null && summary.balanceDueCents !== undefined
      ? summary.balanceDueCents
      : Math.round(Number(bill.dueAmount || bill.amount || 0) * 100);
    if (balanceDueCents > 0) dueCents += balanceDueCents;
  }
  return Math.round(dueCents / 100);
}

/** The badge HTML for a due amount (empty string when nothing is owed). */
export function fixCollectBadgeHtml(duePkr) {
  const due = Number(duePkr);
  if (!Number.isFinite(due) || due <= 0) return '';
  return `<span class="fix-collect-badge">${escapeHtml(t('fcx_badge', null, { amount: formatPKR(due) }))}</span>`;
}

/**
 * Everything a complaint surface needs for one customer: null when no
 * badge should render (nothing owed), else { customerId, duePkr,
 * badgeHtml, collectLabel }. Hosts (app.js) compute this and hand it to
 * the complaint modals via callback, so the modals never import the
 * engine — complaint-tickets.js in particular imports nothing at all.
 * collectLabel is the resolve-form checkbox text (amount included), so
 * even that string is produced here, fully translated.
 */
export function fixCollectInfo(state, customerId, allocations = null) {
  const duePkr = fixCollectDuePkr(state, customerId, allocations);
  if (!(duePkr > 0)) return null;
  return {
    customerId: String(customerId),
    duePkr,
    badgeHtml: fixCollectBadgeHtml(duePkr),
    collectLabel: t('fcx_collect_checkbox', null, { amount: formatPKR(duePkr) })
  };
}

/**
 * Sequence a resolve and an optional bill collection as one operator
 * action, keeping the two acts independent:
 *
 * - resolve() runs first. If it throws, the error propagates and the
 *   collect step NEVER runs. If it returns false/null/undefined, the
 *   resolve counts as not done and the collect step never runs.
 * - launchCollect(entry) runs only after a successful resolve. Its
 *   outcome — returning false (operator skipped / collector
 *   unavailable) or even throwing — is reported as collectLaunched, and
 *   can NEVER un-resolve: this helper has no undo path by design.
 *
 * @param {Object} steps
 * @param {Function} steps.resolve - performs the resolve; returns the
 *   resolved entry (truthy) on success.
 * @param {Function} [steps.launchCollect] - opens collection for the
 *   resolved entry; return false when the collector did not open.
 * @returns {Promise<{resolved: boolean, collectLaunched: boolean, entry: *}>}
 */
export async function runResolveAndCollect({ resolve, launchCollect } = {}) {
  if (typeof resolve !== 'function') {
    throw new TypeError('runResolveAndCollect needs a resolve function.');
  }
  const entry = await resolve();
  if (entry === false || entry === null || entry === undefined) {
    return { resolved: false, collectLaunched: false, entry: null };
  }
  let collectLaunched = false;
  if (typeof launchCollect === 'function') {
    try {
      collectLaunched = (await launchCollect(entry)) !== false;
    } catch {
      collectLaunched = false;
    }
  }
  return { resolved: true, collectLaunched, entry };
}
