/*
 * Plan 463 — dues, status, and last payment on each customer search
 * result row.
 *
 * A search result used to show only a name (with the area, the phone,
 * and the current month's billing tag), so the operator had to open
 * each profile to learn the two things that matter at the counter:
 * does this customer owe anything, and are they overdue — and when
 * did they last pay. This module is the missing piece: one
 * enrichment per result row, read from that customer's own records
 * and nothing else.
 *
 * The enrichment carries three things, and the row shows all three:
 *
 * - dues in cents — the sheet's own figure, the allocation engine's
 *   positive bill balances summed over the customer's bills. A
 *   manual baqaya is a separate record the sheet does not display,
 *   so it is not part of this figure; the enrichment and the sheet
 *   agree exactly, the same rule the status filter uses.
 * - the account status in plain words — the dues state first
 *   (Overdue, Due, or Paid up, from the app's own rules), then
 *   Suspended when the customer holds an open suspension record,
 *   then New when the customer was added in the current month.
 *   The states are not mutually exclusive, and the labels do not
 *   pretend they are.
 * - the last payment date — the latest non-voided payment on any of
 *   the customer's bills, with a strict calendar date and a positive
 *   amount; a voided payment, a payment with no usable date, or a
 *   zero payment is never the last payment. No payment on record
 *   reads as no payment, never a guessed date.
 *
 * The module is pure and reads only: it takes a customer record and
 * the context the sheet already computes (the allocation engine, the
 * open suspension ids, the current month, and the reference date)
 * and returns the enrichment. It never changes any customer, bill,
 * payment, or suspension record, adds no new field, and keeps no
 * store.
 */

import {
  customerStatusDuesCents,
  customerHasOverdueBill,
  customerIsSuspended,
  customerIsNew,
} from './customer-status-filter.js';
import { normalizeLedgerDay, formatLedgerDay } from './ledger-single-day.js';

/** Escapes HTML characters for safe template string interpolation. */
function escapeSearchResultEnrichmentHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

/**
 * The dues figure the search row shows for one customer, in cents:
 * the sheet's own figure, the allocation engine's positive bill
 * balances summed over the customer's bills. A manual baqaya is a
 * separate record the sheet does not display, so it is never part
 * of this figure; the enrichment and the sheet agree exactly.
 */
export function searchResultDuesCents(customer, allocations) {
  return customerStatusDuesCents(customer, allocations);
}

/**
 * The last payment date for one customer, as the recorded
 * YYYY-MM-DD string, or null when no payment on record qualifies:
 * the latest non-voided payment on any of the customer's bills with
 * a strict calendar date and a positive amount. A voided payment, a
 * payment with no usable date, or a zero payment is never the last
 * payment, and a missing record reads as no payment, never a guess.
 */
export function searchResultLastPaymentDate(customer) {
  if (!customer || typeof customer !== 'object') return null;
  const bills = Array.isArray(customer.bills) ? customer.bills : [];
  let latest = null;
  for (const bill of bills) {
    const payments = Array.isArray(bill?.payments) ? bill.payments : [];
    for (const payment of payments) {
      if (!payment || typeof payment !== 'object') continue;
      if (payment.voided === true) continue;
      const date = normalizeLedgerDay(payment.date);
      if (!date) continue;
      const amount = Number(payment.amount);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      if (!latest || date >= latest) latest = date;
    }
  }
  return latest;
}

/**
 * The account status in plain words, in display order: the dues
 * state first (Overdue when a bill still owes past its due date,
 * Due when money is owed but nothing is past due, Paid up when
 * nothing is owed), then Suspended when the customer holds an open
 * suspension record, then New when the customer was added in the
 * current month. The context carries what the sheet already
 * computes: the allocation engine, the open suspension ids, the
 * current month, and the reference date. A missing record has no
 * status at all.
 */
export function searchResultAccountStatusLabels(customer, context = {}) {
  if (!customer || typeof customer !== 'object') return [];
  const allocations = context?.allocations ?? null;
  const labels = [];
  if (customerHasOverdueBill(customer, allocations, context?.referenceDate)) {
    labels.push('Overdue');
  } else if (searchResultDuesCents(customer, allocations) > 0) {
    labels.push('Due');
  } else {
    labels.push('Paid up');
  }
  if (customerIsSuspended(customer, context?.suspendedCustomerIds)) labels.push('Suspended');
  if (customerIsNew(customer, context?.currentMonth)) labels.push('New');
  return labels;
}

/**
 * The whole enrichment for one search result row: the dues in cents,
 * the account status labels in display order, and the last payment
 * date (or null). One call, one object — the row renders all three
 * from it and nothing else.
 */
export function searchResultEnrichment(customer, context = {}) {
  const allocations = context?.allocations ?? null;
  return {
    duesCents: searchResultDuesCents(customer, allocations),
    statusLabels: searchResultAccountStatusLabels(customer, context),
    lastPaymentDate: searchResultLastPaymentDate(customer),
  };
}

/**
 * The enrichment line for a search result row, as HTML: the account
 * status in plain words, then the last payment date — "Last payment:
 * 5 Nov 2026" — or "No payment recorded" when no payment on record
 * qualifies. The line reuses the row's own meta-row styling, so no
 * new class is introduced. A row with no status labels renders
 * nothing rather than a half-empty line.
 */
export function searchResultEnrichmentHtml(enrichment) {
  const labels = Array.isArray(enrichment?.statusLabels) ? enrichment.statusLabels : [];
  if (labels.length === 0) return '';
  const status = labels.map((label) => escapeSearchResultEnrichmentHtml(label)).join(' · ');
  const day = enrichment?.lastPaymentDate ? formatLedgerDay(enrichment.lastPaymentDate) : '';
  const last = day
    ? `Last payment: ${escapeSearchResultEnrichmentHtml(day)}`
    : 'No payment recorded';
  return `<div class="fcs-meta-row"><span>${status}</span><span> · ${last}</span></div>`;
}
